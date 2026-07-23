import { createFileRoute } from '@tanstack/react-router'
import { textToSpeech, TtsUnavailableError } from '../../server/rag/tts'

export const Route = createFileRoute('/api/tts')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const text = url.searchParams.get('text')
        const rate = Number(url.searchParams.get('rate') ?? '150') || 150
        if (!text || text.trim().length === 0) {
          return new Response('Missing text', { status: 400 })
        }
        try {
          const res = await textToSpeech(text.slice(0, 2000), rate)
          return new Response(new Uint8Array(res.audio), {
            status: 200,
            headers: {
              'Content-Type': res.mime,
              'Cache-Control': 'public, max-age=3600',
            },
          })
        } catch (e) {
          const msg = e instanceof TtsUnavailableError ? e.message : 'TTS gagal'
          return new Response(msg, { status: 501 })
        }
      },
    },
  },
})
