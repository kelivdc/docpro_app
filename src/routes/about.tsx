import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
  head: () => ({
    meta: [{ title: 'DocPro — About' }],
  }),
})

function About() {
  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-2">Tentang</p>
        <h1 className="display-title mb-3 text-4xl font-bold text-[var(--fg)] sm:text-5xl">
          Tentang DocPro
        </h1>
        <p className="m-0 max-w-3xl text-base leading-8 text-[var(--fg-soft)]">
          DocPro membantu tim menemukan jawaban dari dokumen mereka lewat tanya
          jawab bahasa natural. Kami membangun fondasi yang aman, cepat, dan
          mudah dikembangkan sesuai kebutuhan Anda.
        </p>
      </section>
    </main>
  )
}
