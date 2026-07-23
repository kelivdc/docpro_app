import type { Parser } from './types'
import { TxtParser, MdParser, DocxParser, XlsxParser, PdfParser, ImageParser } from './parsers'

// Registry of parsers (strategy pattern). Order matters: more specific first.
const REGISTRY: Parser[] = [
  new PdfParser(),
  new DocxParser(),
  new XlsxParser(),
  new ImageParser(),
  new MdParser(),
  new TxtParser(),
]

export function getParser(mime: string, filename: string): Parser {
  const found = REGISTRY.find((p) => p.supports(mime, filename))
  if (found) return found
  // Generic fallback: treat as UTF-8 text.
  return new TxtParser()
}

export function listParsers(): string[] {
  return REGISTRY.map((p) => p.name)
}
