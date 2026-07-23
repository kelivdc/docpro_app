// Shared types for the Document Intelligence Pipeline.
// Generic across all industries — structure is detected, never hard-coded per domain.

export type BlockType =
  | 'title'
  | 'subtitle'
  | 'heading'
  | 'subheading'
  | 'chapter'
  | 'section'
  | 'subsection'
  | 'pasal' // legal article
  | 'ayat' // legal verse/clause
  | 'paragraph'
  | 'bullet_list'
  | 'numbered_list'
  | 'table'
  | 'code_block'
  | 'quote'

export interface StructureBlock {
  id: string
  type: BlockType
  content: string
  page?: number
  // Hierarchy: ids of ancestors, root -> immediate parent.
  parentId: string | null
  childIds: string[]
  level: number // heading depth (0 = title/document root)
  // Bounding metadata for retrieval context.
  heading?: string
  section?: string
  subsection?: string
  parentHeading?: string
  title?: string
  language?: string
}

export interface DocStructure {
  title: string | null
  language: string
  blocks: StructureBlock[]
  // fast lookup
  byId: Map<string, StructureBlock>
}

export interface ChunkMeta {
  documentId: string
  ownerId: string
  filename?: string | null
  page?: number | null
  title?: string | null
  heading?: string | null
  subHeading?: string | null
  section?: string | null
  subsection?: string | null
  parentHeading?: string | null
  parentId?: string | null
  chunkIndex: number
  totalChunks: number
  language: string
}

export interface IntelligentChunk extends ChunkMeta {
  id: string
  ownerId: string
  // full hierarchical heading path, e.g. "BAB IV > Pasal 24"
  headingPath: string
  content: string
  embedding?: number[]
  category?: string | null
  path?: string | null
}

// A retrieved chunk with similarity score (shared by all vector stores).
export interface QueryHit extends ChunkMeta {
  id: string
  content: string
  score: number
  headingPath?: string | null
  category?: string | null
  path?: string | null
}

export interface IntelligenceScore {
  structureDetection: number // %
  headingDetection: number // %
  tableDetection: number // %
  ocrConfidence: number // %
  metadataCompleteness: number // %
  overall: number // %
  // true when overall < threshold and a fallback parser was applied
  usedFallback: boolean
  notes: string[]
}

export interface ParseResult {
  text: string
  pages?: number
  // raw extracted blocks for structure detection (tables/code/lists preserved)
  rawBlocks?: Array<{ type: BlockType; content: string; page?: number }>
  ocrConfidence?: number // 1 = native text, <1 = likely scanned/OCR
}

// Strategy/plugin interface: a Parser turns a buffer into ParseResult.
export interface Parser {
  readonly name: string
  supports(mime: string, filename: string): boolean
  parse(buffer: Buffer, filename: string): Promise<ParseResult>
}
