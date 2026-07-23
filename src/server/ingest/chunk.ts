export interface TextChunk {
  index: number
  content: string
}

// Sentence/paragraph-aware chunking with overlap (AD-8).
const CHUNK_TOKENS = 800
const OVERLAP_TOKENS = 80

function splitSentences(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/(?<=[.!?]\s)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export function chunkText(text: string): TextChunk[] {
  const clean = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim()
  if (!clean) return []

  // Split into paragraphs first; if a paragraph is huge, break into sentences.
  const rawParagraphs = clean.split(/\n{1,}/).filter((p) => p.trim().length > 0)
  const units: string[] = []
  for (const para of rawParagraphs) {
    const paraTokens = para.split(/\s+/).length
    if (paraTokens > CHUNK_TOKENS) {
      units.push(...splitSentences(para))
    } else {
      units.push(para)
    }
  }

  const chunks: TextChunk[] = []
  let current = ''
  let currentTokens = 0
  let index = 0

  const push = (c: string) => {
    const trimmed = c.trim()
    if (trimmed.length > 0) chunks.push({ index: index++, content: trimmed })
  }

  for (const unit of units) {
    const tokens = unit.split(/\s+/).length
    if (currentTokens + tokens > CHUNK_TOKENS && current.length > 0) {
      push(current)
      const tailWords = current.split(/\s+/).slice(-OVERLAP_TOKENS).join(' ')
      current = tailWords ? tailWords + '\n' : ''
      currentTokens = tailWords ? tailWords.split(/\s+/).length : 0
    }
    current += (current ? '\n' : '') + unit
    currentTokens += tokens
  }
  if (current.trim()) push(current)

  return chunks
}
