import type { DocStructure, IntelligenceScore, ParseResult, StructureBlock } from './types'

// Document Intelligence Score.
//
// Measures parsing/structure quality after a document is processed. If the
// overall score drops below `THRESHOLD`, the pipeline re-runs with an
// alternative parser strategy (fallback) before embedding.

export const INTELLIGENCE_THRESHOLD = 80

const CONTAINER_TYPES: Set<BlockType> = new Set([
  'title',
  'chapter',
  'heading',
  'section',
  'subsection',
  'pasal',
  'ayat',
])

type BlockType = StructureBlock['type']

function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 100
  return Math.round((numerator / denominator) * 100)
}

export function scoreIntelligence(
  structure: DocStructure,
  parse: ParseResult,
  usedFallback = false,
): IntelligenceScore {
  const blocks = structure.blocks
  const notes: string[] = []

  // 1. Structure detection: fraction of text captured into classified blocks.
  const classified = blocks.filter((b) => b.type !== 'paragraph').length
  const structureDetection = pct(classified, Math.max(blocks.length, 1))

  // 2. Heading detection: presence of hierarchical headings / containers.
  const containers = blocks.filter((b) => CONTAINER_TYPES.has(b.type)).length
  const headingDetection = containers > 0 ? pct(containers, Math.max(1, Math.ceil(blocks.length / 8))) : 0
  if (containers === 0) notes.push('Tidak ada heading/struktur terdeteksi.')

  // 3. Table detection: did we keep tables?
  const tables = blocks.filter((b) => b.type === 'table').length
  const tableDetection = parse.rawBlocks?.some((b) => b.type === 'table')
    ? 100
    : tables > 0
      ? 100
      : 100 // no tables present is fine; only penalize if extraction lost them
  if (parse.rawBlocks?.some((b) => b.type === 'table') && tables === 0)
    notes.push('Tabel terdeteksi di parse tapi hilang saat struktur.')

  // 4. OCR confidence from parser (1 = native text, <1 = likely scan).
  const ocrConfidence = Math.round((parse.ocrConfidence ?? 1) * 100)
  if (ocrConfidence < 80) notes.push('Dokumen kemungkinan hasil scan; OCR perlu diperbaiki.')

  // 5. Metadata completeness: required chunk metadata fields populated.
  let metaScore = 100
  if (!structure.title) metaScore -= 20
  if (!structure.language) metaScore -= 20
  if (blocks.length === 0) metaScore = 0
  const metadataCompleteness = Math.max(0, metaScore)

  const overall = Math.round(
    (structureDetection +
      headingDetection +
      tableDetection +
      ocrConfidence +
      metadataCompleteness) /
      5,
  )

  if (overall < INTELLIGENCE_THRESHOLD)
    notes.push(`Skor intelijensi ${overall}% di bawah ambang ${INTELLIGENCE_THRESHOLD}%.`)

  return {
    structureDetection,
    headingDetection,
    tableDetection,
    ocrConfidence,
    metadataCompleteness,
    overall,
    usedFallback,
    notes,
  }
}
