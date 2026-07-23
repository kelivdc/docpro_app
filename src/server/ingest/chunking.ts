import type { DocStructure, IntelligentChunk, StructureBlock } from './types'
import { randomUUID } from 'crypto'

// Smart Chunking: chunks follow the detected document structure instead of a
// blind fixed token window. Priority order (per spec):
//   1. Heading  2. Section  3. Subsection  4. Paragraph
//   5. Semantic split  6. Fixed token chunk (fallback)
//
// Structural containers (chapter/heading/section/pasal/ayat) and their children
// are grouped into ONE chunk when they fit, so "Pasal 24 + Ayat 1 + Ayat 2" stay
// together and retrieval can return the whole logical unit.

const FALLBACK_MAX_TOKENS = 800
const FALLBACK_OVERLAP = 80
const SEMANTIC_MAX_TOKENS = 600

function tokens(s: string): number {
  return s.split(/\s+/).filter(Boolean).length
}

function headingPathOf(b: StructureBlock): string {
  // Reconstruct human-readable hierarchy from the block's propagated context.
  const parts = [b.title, b.heading, b.section, b.subsection].filter(Boolean) as string[]
  return parts.join(' > ')
}

// Precedence of structural containers (higher = deeper/narrower).
const BLOCK_PRECEDENCE: Record<string, number> = {
  title: 0,
  subtitle: 1,
  subheading: 1,
  chapter: 2,
  heading: 2,
  section: 3,
  subsection: 4,
  pasal: 3,
  ayat: 5,
  paragraph: 6,
  bullet_list: 6,
  numbered_list: 6,
  table: 6,
  code_block: 6,
  quote: 6,
}

// Group contiguous blocks into chunk units following structure.
// A new unit starts only when a *peer or higher* container begins (e.g. a new
// Pasal, Chapter, Section) — children (Ayat) stay grouped under their parent
// Pasal so "Pasal 24 + Ayat 1 + Ayat 2" becomes ONE chunk.
function groupUnits(structure: DocStructure): StructureBlock[][] {
  const units: StructureBlock[][] = []
  let current: StructureBlock[] = []
  let currentTokens = 0
  let anchorPrec = Infinity // precedence of the unit's top container

  const flush = () => {
    if (current.length) {
      units.push(current)
      current = []
      currentTokens = 0
      anchorPrec = Infinity
    }
  }

  const isContainer = (b: StructureBlock) =>
    ['title', 'chapter', 'heading', 'section', 'subsection', 'pasal'].includes(b.type)

  for (const b of structure.blocks) {
    const t = tokens(b.content)
    const prec = BLOCK_PRECEDENCE[b.type] ?? 6

    // Start a new unit when a peer/higher container begins (but not for deeper
    // children like ayat which belong to the current pasal/section).
    if (current.length > 0 && isContainer(b) && prec <= anchorPrec) flush()
    if (currentTokens + t > SEMANTIC_MAX_TOKENS && current.length > 0) flush()

    if (current.length === 0 && isContainer(b)) anchorPrec = prec
    current.push(b)
    currentTokens += t
  }
  flush()
  return units
}

function fallbackChunk(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return []
  const words = clean.split(/\s+/)
  const out: string[] = []
  for (let i = 0; i < words.length; i += FALLBACK_MAX_TOKENS - FALLBACK_OVERLAP) {
    out.push(words.slice(i, i + FALLBACK_MAX_TOKENS).join(' '))
  }
  return out
}

export function smartChunk(
  structure: DocStructure,
  base: { documentId: string; ownerId: string; filename: string; language: string },
): IntelligentChunk[] {
  const totalChunks = structure.blocks.length
  const chunks: IntelligentChunk[] = []
  let index = 0

  for (const unit of groupUnits(structure)) {
    const content = unit.map((b) => b.content).join('\n')
    const top = unit[0]
    const headingPath = headingPathOf(top)

    // If a unit is still too large (e.g. one huge paragraph), fall back to fixed split.
    if (tokens(content) > FALLBACK_MAX_TOKENS) {
      const parts = fallbackChunk(content)
      for (const part of parts) {
        chunks.push(buildChunk(part, top, headingPath, index++, totalChunks, base))
      }
      continue
    }

    chunks.push(buildChunk(content, top, headingPath, index++, totalChunks, base))
  }

  if (chunks.length === 0) {
    // Absolute fallback: the raw text as a single chunk.
    chunks.push(
      buildChunk(
        structure.blocks.map((b) => b.content).join('\n') || ' ',
        structure.blocks[0] ?? ({ content: '' } as StructureBlock),
        '',
        0,
        1,
        base,
      ),
    )
  }

  return chunks
}

function buildChunk(
  content: string,
  top: StructureBlock,
  headingPath: string,
  index: number,
  total: number,
  base: {
    documentId: string
    ownerId: string
    filename: string
    language: string
    category?: string | null
    path?: string | null
  },
): IntelligentChunk {
  return {
    id: randomUUID(),
    ownerId: base.ownerId,
    documentId: base.documentId,
    filename: base.filename,
    page: top.page,
    title: top.title ?? null,
    heading: top.heading ?? null,
    subHeading: top.subsection ?? null,
    section: top.section ?? null,
    subsection: top.subsection ?? null,
    parentHeading: top.parentHeading ?? null,
    parentId: top.parentId ?? null,
    headingPath,
    chunkIndex: index,
    totalChunks: total,
    language: base.language,
    category: base.category ?? null,
    path: base.path ?? null,
    content,
  }
}
