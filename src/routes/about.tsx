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
        <p className="island-kicker mb-2">About</p>
        <h1 className="display-title mb-3 text-4xl font-bold text-[var(--fg)] sm:text-5xl">
          About DocPro
        </h1>
        <p className="m-0 max-w-3xl text-base leading-8 text-[var(--fg-soft)]">
          DocPro helps teams find answers from their documents through natural
          language Q&amp;A. We build a secure, fast, and easily extensible
          foundation tailored to your needs.
        </p>
      </section>
    </main>
  )
}
