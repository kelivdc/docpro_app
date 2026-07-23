import type { IntelligentChunk, QueryHit } from '../ingest/types'

export interface ChunkRecord {
  id: string
  documentId: string
  ownerId: string
  chunkIndex: number
  content: string
  category?: string | null
  path?: string | null
  // Document Intelligence metadata
  title?: string | null
  heading?: string | null
  subHeading?: string | null
  section?: string | null
  subsection?: string | null
  parentHeading?: string | null
  parentId?: string | null
  headingPath?: string | null
  page?: number | null
  language?: string
  totalChunks?: number
}

export interface VectorStore {
  upsert(chunks: Array<IntelligentChunk & { embedding: number[] }>): Promise<void>
  query(
    ownerId: string,
    embedding: number[],
    opts?: {
      limit?: number
      category?: string
      path?: string
      includeHidden?: boolean
      includeExpired?: boolean
      expandParents?: boolean
      // When set, restrict the base candidates to these documents/parents
      // (used after reranking so parent/child expansion keeps full units).
      focusDocIds?: string[]
      focusParentIds?: string[]
    },
  ): Promise<QueryHit[]>
  deleteByDocument(documentId: string): Promise<void>
}

// AD-4 / AD-8: pgvector-backed store inside the tenant schema.
// Embedding stored as vector(1536); queried via cosine distance.
// Now metadata-aware (Document Intelligence fields) + optional parent expansion.
export class PgVectorStore implements VectorStore {
  constructor(
    private pool: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> },
    private schemaName: string,
  ) {}

  private vec(arr: number[]): string {
    return `[${arr.join(',')}]`
  }

  async upsert(
    chunks: Array<IntelligentChunk & { embedding: number[] }>,
  ): Promise<void> {
    if (chunks.length === 0) return
    const s = this.schemaName
    const values: unknown[] = []
    const lines: string[] = []
    chunks.forEach((c, i) => {
      const base = i * 18
      lines.push(
        `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11},$${base + 12},$${base + 13},$${base + 14},$${base + 15},$${base + 16},$${base + 17},$${base + 18})`,
      )
      values.push(
        c.id,
        c.documentId,
        c.ownerId,
        c.filename ?? null,
        c.chunkIndex,
        c.content,
        this.vec(c.embedding),
        c.category ?? null,
        c.path ?? null,
        c.title ?? null,
        c.heading ?? null,
        c.subHeading ?? null,
        c.section ?? null,
        c.subsection ?? null,
        c.parentHeading ?? null,
        c.parentId ?? null,
        c.headingPath ?? null,
        c.language ?? 'id',
      )
    })
    const sql = `
      INSERT INTO ${s}.chunks
        (id, document_id, owner_id, filename, chunk_index, content, embedding, category, path,
         title, heading, sub_heading, section, subsection, parent_heading, parent_id, heading_path, language)
      VALUES ${lines.join(',')}
      ON CONFLICT (id) DO UPDATE SET
        content = EXCLUDED.content,
        embedding = EXCLUDED.embedding,
        category = EXCLUDED.category,
        path = EXCLUDED.path,
        title = EXCLUDED.title,
        heading = EXCLUDED.heading,
        sub_heading = EXCLUDED.sub_heading,
        section = EXCLUDED.section,
        subsection = EXCLUDED.subsection,
        parent_heading = EXCLUDED.parent_heading,
        parent_id = EXCLUDED.parent_id,
        heading_path = EXCLUDED.heading_path,
        language = EXCLUDED.language
    `
    await this.pool.query(sql, values)
  }

  async query(
    ownerId: string,
    embedding: number[],
    opts?: {
      limit?: number
      category?: string
      path?: string
      includeHidden?: boolean
      includeExpired?: boolean
      expandParents?: boolean
      focusDocIds?: string[]
      focusParentIds?: string[]
    },
  ): Promise<QueryHit[]> {
    const s = this.schemaName
    const limit = opts?.limit ?? 6
    const conditions = [
      `c.owner_id = $1`,
      `c.embedding IS NOT NULL`,
      // Exclude hidden/expired chunks by default (FR-5.1 / AR-7)
      opts?.includeHidden ? `d.hidden = true OR d.hidden = false` : `d.hidden = false`,
      opts?.includeExpired
        ? `(d.expired = true OR d.expired = false)`
        : `(d.expired = false AND (d.expired_at IS NULL OR d.expired_at > now()))`,
    ]
    const params: unknown[] = [ownerId]
    if (opts?.category) {
      params.push(opts.category)
      conditions.push(`c.category = $${params.length}`)
    }
    if (opts?.path) {
      params.push(opts.path)
      conditions.push(`c.path = $${params.length}`)
    }
    if (opts?.focusDocIds?.length) {
      params.push(opts.focusDocIds)
      conditions.push(`c.document_id = ANY($${params.length}::text[])`)
    }
    if (opts?.focusParentIds?.length) {
      params.push(opts.focusParentIds)
      conditions.push(`c.parent_id = ANY($${params.length}::text[])`)
    }
    params.push(this.vec(embedding))
    const embParam = `$${params.length}`
    params.push(limit)
    const sql = `
      SELECT c.id, c.document_id, c.owner_id, c.filename, c.chunk_index, c.content, c.category, c.path,
             c.title, c.heading, c.sub_heading, c.section, c.subsection, c.parent_heading,
             c.parent_id, c.heading_path, c.page, c.language, c.total_chunks,
             1 - (c.embedding <=> ${embParam}::vector) AS score
      FROM ${s}.chunks c
      JOIN ${s}.documents d ON d.id = c.document_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY c.embedding <=> ${embParam}::vector
      LIMIT $${params.length}
    `
    const res = await this.pool.query(sql, params)
    let rows = res.rows.map((r) => mapRow(r))

    // Parent/child expansion: pull the full logical unit (e.g. "Pasal 11" ->
    // heading + ayat) by fetching chunks that share a parent_id with any
    // retrieved chunk, plus the parent chunks themselves. Expansion is scoped
    // to parent_id ONLY (never to the whole document) so the context window
    // stays bounded.
    if (opts?.expandParents && rows.length > 0) {
      const parentIds = rows.map((r) => r.parentId).filter(Boolean) as string[]
      // Include each retrieved chunk's own id so its children (parent_id = id)
      // are also pulled in.
      const unitIds = [...new Set([...parentIds, ...rows.map((r) => r.id)])]
      if (unitIds.length) {
        const expParams: unknown[] = [ownerId, unitIds]
        const expSql = `
          SELECT c.id, c.document_id, c.owner_id, c.filename, c.chunk_index, c.content, c.category, c.path,
                 c.title, c.heading, c.sub_heading, c.section, c.subsection, c.parent_heading,
                 c.parent_id, c.heading_path, c.page, c.language, c.total_chunks,
                 0.999 AS score
          FROM ${s}.chunks c
          JOIN ${s}.documents d ON d.id = c.document_id
          WHERE c.owner_id = $1 AND (
            c.parent_id = ANY($${expParams.length}::text[])
            OR c.id = ANY($${expParams.length}::text[])
          )
        `
        const exp = await this.pool.query(expSql, expParams)
        const have = new Set(rows.map((r) => r.id))
        for (const r of exp.rows.map(mapRow)) {
          if (!have.has(r.id)) {
            rows.push(r)
            have.add(r.id)
          }
        }
      }
    }

    return rows
  }

  async deleteByDocument(documentId: string): Promise<void> {
    await this.pool.query(`DELETE FROM ${this.schemaName}.chunks WHERE document_id = $1`, [
      documentId,
    ])
  }
}

function mapRow(r: any): QueryHit {
  return {
    id: r.id,
    documentId: r.document_id,
    ownerId: r.owner_id,
    filename: r.filename ?? null,
    chunkIndex: r.chunk_index,
    content: r.content,
    category: r.category,
    path: r.path,
    title: r.title,
    heading: r.heading,
    subHeading: r.sub_heading,
    section: r.section,
    subsection: r.subsection,
    parentHeading: r.parent_heading,
    parentId: r.parent_id,
    headingPath: r.heading_path,
    page: r.page,
    language: r.language,
    totalChunks: r.total_chunks,
    score: Number(r.score),
  }
}
