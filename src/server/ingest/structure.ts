import { randomUUID } from 'crypto'
import type { BlockType, DocStructure, StructureBlock } from './types'

// Document Structure Detection.
//
// Generic, deterministic structural analysis — works for ANY industry document
// (legal, HR, engineering, academic, medical, government, business...) without
// domain-specific rules. Detection is purely structural:
//   - headings (markdown #, ALL-CAPS short lines, numbered "1.2.3")
//   - BAB / Pasal / Ayat (legal) and Chapter / Section / Article (generic)
//   - bullet & numbered lists, tables, code blocks, quotes
//
// A pluggable `StructureDetector` interface lets an LLM-based detector be added
// later without touching this code (same strategy pattern as parsers).

export interface StructureDetector {
  readonly name: string
  detect(text: string, opts?: { pages?: number }): DocStructure
}

// Heuristics ----------------------------------------------------------------

const RE_HEADING_MARKDOWN = /^(#{1,6})\s+(.*)$/
const RE_CHAPTER_ID = /^(bab|chapter|bagian|part(e)?|annex|lampiran)\b/i
const RE_PASAL_ID = /^(pasal|article|artikel|clause)\b/i
const RE_AYAT_ID = /^(ayat|verse|point|butir| huruf)\b/i
const RE_NUMBERED_SECTION = /^(\d+)(\.\d+)*\.?\s+\S/
const RE_BULLET = /^([-*•‣◦]|\d+[.)])\s+\S/
const RE_TABLE_ROW = /^[|\t]|^\S+\s*\|\s*\S/ // contains pipe / tab separators
const RE_CODE_FENCE = /^```/
const RE_QUOTE = /^>\s+\S/
const RE_ALLCAPS = /^[A-Z][A-Z\s\d.,:()\-\/]{4,}$/

function classifyLine(line: string): BlockType | null {
  const t = line.trim()
  if (!t) return null
  if (RE_CODE_FENCE.test(t)) return 'code_block'
  if (RE_QUOTE.test(t)) return 'quote'
  if (RE_HEADING_MARKDOWN.test(t)) return 'heading'
  if (RE_CHAPTER_ID.test(t)) return 'chapter'
  if (RE_PASAL_ID.test(t)) return 'pasal'
  if (RE_AYAT_ID.test(t)) return 'ayat'
  if (RE_NUMBERED_SECTION.test(t)) return 'section'
  if (RE_BULLET.test(t)) return 'bullet_list'
  if (RE_TABLE_ROW.test(t)) return 'table'
  if (RE_ALLCAPS.test(t)) return 'heading'
  return null
}

function detectLanguage(text: string): string {
  // Very light heuristic: presence of common Indonesian/legal words.
  const lower = text.toLowerCase()
  const idMarkers = ['pasal', 'ayat', 'bab', 'undang', 'dengan', 'dan', 'yang', 'untuk']
  const score = idMarkers.filter((w) => lower.includes(w)).length
  return score >= 2 ? 'id' : 'en'
}

function buildHierarchy(blocks: StructureBlock[]): void {
  // Assign parent by nearest preceding "container" block of higher-or-equal
  // structural precedence. Precedence helps nest Pasal under BAB, Ayat under Pasal.
  const PRECEDENCE: Record<BlockType, number> = {
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
  const stack: StructureBlock[] = []
  for (const b of blocks) {
    const myPrec = PRECEDENCE[b.type]
    while (stack.length && PRECEDENCE[stack[stack.length - 1].type] >= myPrec) stack.pop()
    const parent = stack[stack.length - 1] ?? null
    b.parentId = parent ? parent.id : null
    b.level = parent ? parent.level + 1 : 0
    if (parent) parent.childIds.push(b.id)
    // propagate heading/section context down the tree
    b.heading = parent?.heading ?? (b.type === 'heading' || b.type === 'chapter' ? b.content : undefined)
    b.section = parent?.section ?? (b.type === 'section' ? b.content : undefined)
    b.subsection = parent?.subsection ?? (b.type === 'subsection' ? b.content : undefined)
    b.parentHeading = parent?.content ?? undefined
    b.title = parent?.title ?? undefined
    stack.push(b)
  }
}

export class HeuristicStructureDetector implements StructureDetector {
  name = 'heuristic'

  detect(text: string, _opts?: { pages?: number }): DocStructure {
    const language = detectLanguage(text)
    const blocks: StructureBlock[] = []
    const lines = text.replace(/\r\n/g, '\n').split('\n')

    let inCode = false
    let codeBuf: string[] = []
    let title: string | null = null
    let firstNonEmpty = true

    const flushCode = () => {
      if (codeBuf.length) {
        blocks.push(this.make('code_block', codeBuf.join('\n')))
        codeBuf = []
      }
      inCode = false
    }

    for (const raw of lines) {
      const line = raw
      if (RE_CODE_FENCE.test(line.trim())) {
        if (inCode) flushCode()
        else {
          inCode = true
          codeBuf = []
        }
        continue
      }
      if (inCode) {
        codeBuf.push(line)
        continue
      }

      const type = classifyLine(line)
      const content = line.trim()

      // Treat the first substantial non-heading line as a candidate document title
      // only when no explicit heading/title seen yet.
      if (!type && firstNonEmpty && !title && content.length > 8 && content.length < 160) {
        title = content
        blocks.push(this.make('title', content))
        firstNonEmpty = false
        continue
      }
      if (type) firstNonEmpty = false

      if (type === 'table') {
        blocks.push(this.make('table', content))
      } else if (type === 'bullet_list') {
        blocks.push(this.make('bullet_list', content))
      } else if (type === 'quote') {
        blocks.push(this.make('quote', content.replace(/^>\s?/, '')))
      } else if (type) {
        blocks.push(this.make(type, content))
      } else if (content) {
        blocks.push(this.make('paragraph', content))
      }
    }
    if (inCode) flushCode()

    buildHierarchy(blocks)
    const byId = new Map(blocks.map((b) => [b.id, b]))

    return { title, language, blocks, byId }
  }

  private make(type: BlockType, content: string): StructureBlock {
    return {
      id: randomUUID(),
      type,
      content,
      parentId: null,
      childIds: [],
      level: 0,
    }
  }
}

export const defaultStructureDetector = new HeuristicStructureDetector()
