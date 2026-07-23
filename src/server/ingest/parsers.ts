import type { Parser, ParseResult } from './types'

// Parsers are pluggable strategies. Add a new file + register it in `parsers/index.ts`
// to support a new format — no changes needed in the pipeline.

export class TxtParser implements Parser {
  name = 'txt'
  supports(mime: string, filename: string): boolean {
    return filename.toLowerCase().endsWith('.txt') || mime === 'text/plain' || mime === 'text/markdown'
  }
  async parse(buffer: Buffer, _filename: string): Promise<ParseResult> {
    return { text: buffer.toString('utf-8'), ocrConfidence: 1 }
  }
}

export class MdParser implements Parser {
  name = 'markdown'
  supports(_mime: string, filename: string): boolean {
    return filename.toLowerCase().endsWith('.md') || filename.toLowerCase().endsWith('.markdown')
  }
  async parse(buffer: Buffer, _filename: string): Promise<ParseResult> {
    return { text: buffer.toString('utf-8'), ocrConfidence: 1 }
  }
}

export class DocxParser implements Parser {
  name = 'docx'
  supports(mime: string, filename: string): boolean {
    return filename.toLowerCase().endsWith('.docx') || mime.includes('wordprocessingml')
  }
  async parse(buffer: Buffer, _filename: string): Promise<ParseResult> {
    const mammoth = (await import('mammoth')).default
    const out = await mammoth.extractRawText({ buffer })
    return { text: out.value, ocrConfidence: 1 }
  }
}

export class XlsxParser implements Parser {
  name = 'xlsx'
  supports(mime: string, filename: string): boolean {
    return (
      filename.toLowerCase().endsWith('.xlsx') ||
      filename.toLowerCase().endsWith('.xls') ||
      mime.includes('spreadsheetml')
    )
  }
  async parse(buffer: Buffer, _filename: string): Promise<ParseResult> {
    const XLSX = await import('xlsx')
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const blocks: ParseResult['rawBlocks'] = []
    let text = ''
    for (const name of wb.SheetNames) {
      const sheet = wb.Sheets[name]
      const sheetText = XLSX.utils.sheet_to_txt(sheet)
      text += `\n=== ${name} ===\n${sheetText}`
      blocks.push({ type: 'table', content: `=== ${name} ===\n${sheetText}` })
    }
    return { text, rawBlocks: blocks, ocrConfidence: 1 }
  }
}

export class PdfParser implements Parser {
  name = 'pdf'
  supports(mime: string, filename: string): boolean {
    return filename.toLowerCase().endsWith('.pdf') || mime === 'application/pdf'
  }
  async parse(buffer: Buffer, _filename: string): Promise<ParseResult> {
    let text = ''
    let numpages: number | undefined

    // Primary: try pdf-parse
    try {
      const createRequire = await import('node:module').then((m) => m.createRequire)
      const require = createRequire(import.meta.url)
      const mod = require('pdf-parse') as
        | ((b: Buffer) => Promise<{ text?: string; numpages?: number }>)
        | { default?: (b: Buffer) => Promise<{ text?: string; numpages?: number }> }
      const pdfParse = (typeof mod === 'function' ? mod : mod.default) as (
        b: Buffer,
      ) => Promise<{ text?: string; numpages?: number }>
      const out = await pdfParse(buffer)
      text = out.text ?? ''
      numpages = out.numpages
    } catch {
      // fall through to pdftotext
    }

    // Detect raw PDF internals instead of real text
    const isGarbage = text.includes('endobj') || text.includes('endstream') || /^\s*%PDF-/m.test(text)

    if (!text.trim() || isGarbage) {
      // Fallback: pdftotext (poppler-utils) is much more reliable for complex PDFs
      try {
        const { execFile } = await import('node:child_process')
        const { mkdtempSync, writeFileSync } = await import('node:fs')
        const { join } = await import('node:path')
        const { tmpdir } = await import('node:os')
        const dir = mkdtempSync(join(tmpdir(), 'pdf-'))
        const pdfPath = join(dir, 'input.pdf')
        writeFileSync(pdfPath, buffer)
        const stdout = await new Promise<string>((resolve, reject) => {
          execFile('pdftotext', [pdfPath, '-'], { maxBuffer: 100 * 1024 * 1024 }, (err, out) => {
            if (err) reject(err)
            else resolve(out ?? '')
          })
        })
        text = stdout
        // pdftotext doesn't give page count directly, use approximate from form feeds
        numpages = (text.match(/\f/g) || []).length + 1
      } catch {
        // both methods failed — keep whatever text we have
      }
    }

    const ocrConfidence = text.trim().length > 0 ? 1 : 0.3
    return { text, pages: numpages, ocrConfidence }
  }
}

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.tiff', '.tif', '.bmp']
const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/tiff', 'image/bmp']

export class ImageParser implements Parser {
  name = 'image'
  supports(mime: string, filename: string): boolean {
    const lower = filename.toLowerCase()
    return IMAGE_EXTS.some((e) => lower.endsWith(e)) || IMAGE_MIMES.includes(mime)
  }
  async parse(buffer: Buffer, filename: string): Promise<ParseResult> {
    const Tesseract = await import('tesseract.js')
    const { data } = await Tesseract.recognize(buffer, 'eng', {
      logger: () => {}, // suppress progress logs
    })
    return { text: data.text, ocrConfidence: data.confidence / 100 }
  }
}
