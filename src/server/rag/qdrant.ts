import type { IntelligentChunk, QueryHit } from '../ingest/types'
import type { VectorStore } from './vector-store'

// Qdrant-backed vector store (used when QDRANT_URL is configured).
// Payload stores the full Document Intelligence metadata per spec:
//   document_id, filename, page, title, heading, section, parent, chunk,
//   chunk_index, total_chunks
//
// Collection layout: one collection per tenant schema, points keyed by chunk id.

interface QdrantPoint {
  id: string
  vector: number[]
  payload: Record<string, unknown>
}

export class QdrantVectorStore implements VectorStore {
  constructor(
    private baseUrl: string,
    private collection: string, // tenant schema name
    private apiKey?: string,
  ) {}

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.apiKey) h['api-key'] = this.apiKey
    return h
  }

  private url(path: string): string {
    return `${this.baseUrl.replace(/\/$/, '')}${path}`
  }

  private async ensureCollection(dim: number): Promise<void> {
    const res = await fetch(this.url(`/collections/${this.collection}`), {
      headers: this.headers(),
    })
    if (res.status === 404) {
      await fetch(this.url(`/collections/${this.collection}`), {
        method: 'PUT',
        headers: this.headers(),
        body: JSON.stringify({
          vectors: { size: dim, distance: 'Cosine' },
        }),
      })
    }
  }

  async upsert(
    chunks: Array<IntelligentChunk & { embedding: number[] }>,
  ): Promise<void> {
    if (chunks.length === 0) return
    const dim = chunks[0].embedding.length
    await this.ensureCollection(dim)
    const points: QdrantPoint[] = chunks.map((c) => ({
      id: c.id,
      vector: c.embedding,
      payload: {
        document_id: c.documentId,
        owner_id: c.ownerId,
        filename: c.filename,
        page: c.page ?? null,
        title: c.title ?? null,
        heading: c.heading ?? null,
        section: c.section ?? null,
        subsection: c.subsection ?? null,
        parent: c.parentId ?? null,
        parent_heading: c.parentHeading ?? null,
        heading_path: c.headingPath ?? null,
        chunk: c.content,
        chunk_index: c.chunkIndex,
        total_chunks: c.totalChunks,
        language: c.language,
        category: c.category ?? null,
        path: c.path ?? null,
      },
    }))
    const res = await fetch(this.url(`/collections/${this.collection}/points`), {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify({ points }),
    })
    if (!res.ok) {
      throw new Error(`Qdrant upsert failed: ${res.status} ${await res.text()}`)
    }
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
    const limit = opts?.limit ?? 6
    const must: unknown[] = [{ key: 'owner_id', match: { value: ownerId } }]
    if (opts?.category) must.push({ key: 'category', match: { value: opts.category } })
    if (opts?.path) must.push({ key: 'path', match: { value: opts.path } })
    if (opts?.focusDocIds?.length)
      must.push({ key: 'document_id', match: { any: opts.focusDocIds } })
    if (opts?.focusParentIds?.length)
      must.push({ key: 'parent_id', match: { any: opts.focusParentIds } })

    const res = await fetch(this.url(`/collections/${this.collection}/points/query`), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        query: embedding,
        limit: limit * 4, // fetch extra for parent expansion
        with_payload: true,
        query_filter: { must },
      }),
    })
    if (!res.ok) {
      throw new Error(`Qdrant query failed: ${res.status} ${await res.text()}`)
    }
    const data = (await res.json()) as { points?: Array<{ id: string; score: number; payload: any }> }
    const raw = (data.points ?? []).slice(0, limit).map((p) => toHit(p))
    if (!opts?.expandParents) return raw

    // Expand: pull siblings sharing the same parent_id / document_id.
    const parentIds = raw.map((r) => r.parentId).filter(Boolean) as string[]
    const docIds = [...new Set(raw.map((r) => r.documentId))]
    if (!parentIds.length && !docIds.length) return raw
    const expRes = await fetch(this.url(`/collections/${this.collection}/points/scroll`), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        with_payload: true,
        limit: 100,
        filter: {
          should: [
            ...parentIds.map((id) => ({ key: 'parent', match: { value: id } })),
            ...docIds.map((id) => ({ key: 'document_id', match: { value: id } })),
          ],
        },
      }),
    })
    if (!expRes.ok) return raw
    const exp = (await expRes.json()) as { points?: Array<{ id: string; payload: any }> }
    const have = new Set(raw.map((r) => r.id))
    const expanded: QueryHit[] = [...raw]
    for (const p of exp.points ?? []) {
      const hit = toHit({ id: p.id, score: 0.999, payload: p.payload })
      if (!have.has(hit.id)) {
        expanded.push(hit)
        have.add(hit.id)
      }
    }
    return expanded
  }

  async deleteByDocument(documentId: string): Promise<void> {
    await fetch(this.url(`/collections/${this.collection}/points/delete`), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        points_selector: { filter: { must: [{ key: 'document_id', match: { value: documentId } }] } },
      }),
    })
  }
}

function toHit(p: { id: string; score: number; payload: any }): QueryHit {
  const pl = p.payload ?? {}
  return {
    id: String(p.id),
    documentId: pl.document_id,
    ownerId: pl.owner_id,
    chunkIndex: pl.chunk_index ?? 0,
    content: pl.chunk ?? '',
    category: pl.category ?? null,
    path: pl.path ?? null,
    title: pl.title ?? null,
    heading: pl.heading ?? null,
    subHeading: pl.subsection ?? null,
    section: pl.section ?? null,
    subsection: pl.subsection ?? null,
    parentHeading: pl.parent_heading ?? null,
    parentId: pl.parent ?? null,
    headingPath: pl.heading_path ?? null,
    page: pl.page ?? null,
    language: pl.language ?? 'id',
    totalChunks: pl.total_chunks ?? 1,
    score: Number(p.score),
  }
}
