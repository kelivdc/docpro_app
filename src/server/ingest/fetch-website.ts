const ENTITY_RE = /&(?:amp|lt|gt|quot|apos|#(\d+));/g

function decodeEntities(text: string): string {
  return text.replace(ENTITY_RE, (_m, num) => {
    if (num) return String.fromCodePoint(parseInt(num, 10))
    const map: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
    return map[_m.slice(1, -1)] || _m
  })
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

export interface FetchedPage {
  title: string
  text: string
}

export async function fetchWebsite(url: string): Promise<FetchedPage> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; DocProBot/1.0; +https://docpro.nexonace.com)',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  const html = await res.text()
  const text = htmlToText(html).slice(0, 200_000)

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? decodeEntities(titleMatch[1].trim()) : new URL(url).hostname

  return { title, text }
}
