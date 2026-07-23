import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/faq')({
  component: FAQ,
  head: () => ({
    meta: [{ title: 'DocPro — FAQ' }],
  }),
})

const faqs = [
  {
    q: 'What is DocPro?',
    a: 'DocPro is an AI Knowledge Platform — not a chatbot. Upload your documents, and DocPro processes them into a searchable knowledge base. You can then interact via built-in AI Chat in the dashboard, or deploy your knowledge across multiple channels (Website Widget, API, WhatsApp, Telegram, and more) as a white-label solution.',
  },
  {
    q: 'Is my knowledge secure and private on DocPro?',
    a: 'Data security is our top priority. All knowledge is encrypted at rest (AES-256) and in transit (SSL/TLS). DocPro guarantees your knowledge content is confidential and <b>never</b> used to train external public AI models.',
  },
  {
    q: 'What document formats does DocPro support?',
    a: 'DocPro supports standard business text files including PDF (.pdf), Microsoft Word (.docx), Excel (.xlsx), and plain text (.txt). Your knowledge is automatically parsed and metadata is extracted after upload.',
  },
  {
    q: 'How accurate are DocPro AI answers?',
    a: 'Highly accurate. We use state-of-the-art Retrieval-Augmented Generation (RAG) architecture. Our AI formulates answers <b>only based on your knowledge source text</b> (not external knowledge) and always includes citations from the source as instant verification.',
  },
  {
    q: 'What is the difference between Own Use and Provider Model?',
    a: '<b>Own Use:</b> You upload your documents and use the built-in AI Chat in the DocPro dashboard for yourself or your team. Perfect for personal knowledge management or internal teams.<br/><br/><b>Provider Model:</b> You deploy your knowledge as a white-label Widget on your website, or via API/chat apps. Your customers interact with it under <b>your brand</b>. Ideal for businesses and agencies.',
  },
  {
    q: 'What channels can I deploy my knowledge to?',
    a: 'DocPro supports multiple distribution channels: Website Widget (embed on any site), REST API (programmatic access), WhatsApp, Telegram, Slack, Discord, Microsoft Teams, and MCP Server (AI agent protocol). More channels coming.',
  },
  {
    q: 'Can I white-label the widget?',
    a: 'Yes. The widget supports custom logo, welcome text, and color themes. Your customers see your brand, not DocPro. Custom domain support is coming soon.',
  },
  {
    q: 'How does pricing work?',
    a: 'DocPro uses a token-based pricing model. Each plan includes a monthly token allocation. Tokens are consumed when your knowledge base is queried — whether through the dashboard AI Chat or via deployed channels. See our <a href="/pricing" class="text-blue-600 dark:text-blue-400 underline">Pricing page</a> for details.',
  },
  {
    q: 'Is there a free plan?',
    a: 'Yes. The free plan includes 50 MB storage with a max file size of 5 MB per file. You can freely try AI Q&A and metadata extraction with no time limit and no credit card required.',
  },
  {
    q: 'Can I share my knowledge or chat with others?',
    a: 'Yes. You can share knowledge or AI chat links securely with your team. Set link expiry dates and access limits for full control.',
  },
  {
    q: 'Do you offer on-premise deployment?',
    a: 'Yes, we offer custom on-premise deployment for organizations with specific security or compliance requirements. Contact our sales team for details.',
  },
  {
    q: 'What happens if I exceed my token limit?',
    a: 'You will be notified when you approach your limit. You can upgrade your plan for a higher token allocation, or wait until the next billing cycle for your tokens to reset.',
  },
]

function FAQ() {
  const [faqOpen, setFaqOpen] = useState<number | null>(null)

  return (
    <main>
      <section className="relative overflow-hidden pt-20 pb-16 md:py-28">
        <div className="glow-effect bg-blue-500/20 dark:bg-blue-600/10 w-[500px] h-[500px] -top-60 -right-20" />
        <div className="max-w-[820px] mx-auto px-6 relative">
          <div className="text-center mb-16">
            <div className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3">FAQ</div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.1] text-[var(--fg)]">
              Frequently Asked Questions
            </h1>
            <p className="mt-4 text-lg text-[var(--fg-soft)] leading-relaxed">
              Everything you need to know about DocPro.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="border border-[var(--border)] rounded-2xl transition-all duration-300"
                style={{ background: 'color-mix(in oklab, var(--muted) 20%, transparent)' }}
              >
                <button
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left font-bold text-sm sm:text-base text-[var(--fg)] focus:outline-none"
                  aria-expanded={faqOpen === i}
                >
                  <span>{faq.q}</span>
                  <svg
                    className={`w-5 h-5 text-[var(--mutfg)] shrink-0 transition-transform duration-200 ${faqOpen === i ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {faqOpen === i && (
                  <div className="px-5 pb-5 text-xs sm:text-sm text-[var(--mutfg)] leading-relaxed" dangerouslySetInnerHTML={{ __html: faq.a }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 border-t border-[var(--border)]" style={{ background: 'var(--card-bg)' }}>
        <div className="max-w-[1240px] mx-auto px-6">
          <div className="relative overflow-hidden rounded-[32px] px-10 py-16 lg:p-20 text-center text-white shadow-2xl" style={{ background: 'linear-gradient(135deg, #1E1B4B 0%, #2563EB 100%)' }}>
            <div className="absolute -right-20 -top-20 w-80 h-80 bg-blue-500/30 rounded-full blur-3xl pointer-events-none" />
            <div className="relative max-w-2xl mx-auto flex flex-col items-center">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">Still Have Questions?</h2>
              <p className="mt-5 text-white/80 text-sm sm:text-base max-w-lg leading-relaxed">Contact our team and we'll get back to you.</p>
              <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                <Link
                  to="/register"
                  className="bg-white text-[#1d4ed8] hover:bg-neutral-100 rounded-xl px-7 py-4 text-base font-bold shadow-lg shadow-white/5 inline-flex items-center justify-center gap-2 w-full sm:w-auto hover:-translate-y-0.5 transition-all duration-200"
                  style={{ color: '#1d4ed8' }}
                >
                  Get started free
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </Link>
                <Link
                  to="/pricing"
                  className="border border-white/20 hover:border-white/40 text-white rounded-xl px-7 py-4 text-base font-semibold inline-flex items-center justify-center w-full sm:w-auto hover:bg-white/5 transition-all duration-200"
                >
                  View Pricing
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
