import { createRequire } from 'node:module'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'

const require = createRequire(import.meta.url)
const pdfParseMod = require('pdf-parse') as
  | ((b: Buffer) => Promise<{ text?: string; numpages?: number }>)
  | { default?: (b: Buffer) => Promise<{ text?: string; numpages?: number }> }
const pdfParse = (
  typeof pdfParseMod === 'function' ? pdfParseMod : pdfParseMod.default
) as (b: Buffer) => Promise<{ text?: string; numpages?: number }>

export interface ParsedText {
  text: string
  pages?: number
}

// AR: support Word/PDF/Excel/Text (FR-1). Returns plain text for chunking.
export async function parseDocument(
  buffer: Buffer,
  mime: string,
  filename: string,
): Promise<ParsedText> {
  const lower = filename.toLowerCase()

  if (lower.endsWith('.txt') || mime === 'text/plain') {
    return { text: buffer.toString('utf-8') }
  }

  if (lower.endsWith('.pdf') || mime === 'application/pdf') {
    const out = await pdfParse(buffer)
    return { text: out.text ?? '', pages: out.numpages }
  }

  if (lower.endsWith('.docx') || mime.includes('wordprocessingml')) {
    const out = await mammoth.extractRawText({ buffer })
    return { text: out.value }
  }

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || mime.includes('spreadsheetml')) {
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const text = wb.SheetNames.map((name) => {
      const sheet = wb.Sheets[name]
      return `=== ${name} ===\n${XLSX.utils.sheet_to_txt(sheet)}`
    }).join('\n')
    return { text }
  }

  // fallback: try as text
  return { text: buffer.toString('utf-8') }
}
