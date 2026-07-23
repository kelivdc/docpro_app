import { spawn } from 'node:child_process'

// AD-10 / AD-13: TTS output. TTS hanya membacakan teks jawaban,
// BUKAN sources/path (AD-13).
//
// Engine priority (server-side, reliable & cross-browser):
//   1. Google Translate TTS — natural neural-ish voice, used when network
//      is available (same engine the QMS display uses).
//   2. espeak-ng  — offline fallback, installed on this server, `id` voice.
//   3. edge-tts   — optional higher-quality cloud voice when installed.
export interface TtsResult {
  audio: Buffer
  mime: string
}

export class TtsUnavailableError extends Error {
  constructor() {
    super('TTS tidak tersedia di server ini.')
    this.name = 'TtsUnavailableError'
  }
}

// Synthesize via Google Translate TTS (natural voice). Requires network.
async function googleTts(text: string): Promise<TtsResult> {
  const url =
    'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=id&q=' +
    encodeURIComponent(text)
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
  })
  if (!res.ok) throw new TtsUnavailableError()
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length === 0) throw new TtsUnavailableError()
  return { audio: buf, mime: 'audio/mpeg' }
}

// Synthesize with espeak-ng (offline, Indonesian voice).
function espeakTts(text: string, rate = 150): Promise<TtsResult> {
  let proc: ReturnType<typeof spawn>
  try {
    proc = spawn('espeak-ng', ['-v', 'id', '-s', String(rate), '--stdout'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch {
    return Promise.reject(new TtsUnavailableError())
  }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const errChunks: Buffer[] = []
    proc.stdin!.write(text)
    proc.stdin!.end()
    proc.stdout!.on('data', (c) => chunks.push(c as Buffer))
    proc.stderr!.on('data', (c) => errChunks.push(c as Buffer))
    proc.on('error', () => reject(new TtsUnavailableError()))
    proc.on('close', (code) => {
      if (code !== 0) {
        const msg = Buffer.concat(errChunks).toString().slice(0, 200)
        reject(new Error(`espeak-ng gagal: ${msg}`))
        return
      }
      if (chunks.length === 0) {
        reject(new TtsUnavailableError())
        return
      }
      resolve({ audio: Buffer.concat(chunks), mime: 'audio/wav' })
    })
  })
}

// Synthesize with edge-tts (cloud, higher quality) when available.
function edgeTts(text: string, voice = 'id-ID-ArdiNeural'): Promise<TtsResult> {
  let proc: ReturnType<typeof spawn>
  try {
    proc = spawn(
      'edge-tts',
      ['--voice', voice, '--text', text, '--format', 'mp3', '--write-media', '-'],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    )
  } catch {
    return Promise.reject(new TtsUnavailableError())
  }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const errChunks: Buffer[] = []
    proc.stdout!.on('data', (c) => chunks.push(c as Buffer))
    proc.stderr!.on('data', (c) => errChunks.push(c as Buffer))
    proc.on('error', () => reject(new TtsUnavailableError()))
    proc.on('close', (code) => {
      if (code !== 0) {
        const msg = Buffer.concat(errChunks).toString().slice(0, 200)
        if (msg.includes('command') || msg.toLowerCase().includes('not found')) {
          reject(new TtsUnavailableError())
        } else {
          reject(new Error(`EdgeTTS gagal: ${msg}`))
        }
        return
      }
      resolve({ audio: Buffer.concat(chunks), mime: 'audio/mpeg' })
    })
  })
}

// Engine priority: Google TTS (natural) → espeak-ng (offline) → edge-tts.
// We attempt each engine directly (catching failures) rather than pre-checking
// availability, since availability probes are unreliable in the SSR context.
export async function textToSpeech(text: string, rate = 150): Promise<TtsResult> {
  try {
    return await googleTts(text)
  } catch (e) {
    if (!(e instanceof TtsUnavailableError)) throw e
  }
  try {
    return await espeakTts(text, rate)
  } catch (e) {
    if (!(e instanceof TtsUnavailableError)) throw e
  }
  try {
    return await edgeTts(text)
  } catch (e) {
    if (!(e instanceof TtsUnavailableError)) throw e
  }
  throw new TtsUnavailableError()
}
