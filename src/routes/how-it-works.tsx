import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/how-it-works')({
  component: HowItWorks,
  head: () => ({
    meta: [{ title: 'DocPro — How It Works' }],
  }),
})

const steps = [
  {
    layer: 'Layer 1',
    title: 'Knowledge Engine',
    desc: 'Upload, process, and index your documents into an AI-ready knowledge base.',
    step: '01',
    color: 'blue',
    items: [
      {
        title: 'Upload Your Documents',
        desc: 'Upload PDF, Word (.docx), Excel (.xlsx), or plain text (.txt) files. Drag and drop or browse from your computer. Files up to your plan limit.',
      },
      {
        title: 'Auto-Processing',
        desc: 'DocPro automatically parses each document — extracting text, tables, and metadata. Documents are split into intelligent semantic chunks optimized for retrieval.',
      },
      {
        title: 'Vector Indexing',
        desc: 'Each chunk is converted into a vector embedding using state-of-the-art embedding models. Your knowledge is now searchable by meaning, not just keywords.',
      },
      {
        title: 'Knowledge Management',
        desc: 'Organize your knowledge with categories and tags. View processing status, update documents, or delete outdated knowledge — all from the dashboard.',
      },
    ],
  },
  {
    layer: 'Layer 2',
    title: 'AI Agent',
    desc: 'Create AI Agents connected to your knowledge base — the brain behind the answers.',
    step: '02',
    color: 'emerald',
    items: [
      {
        title: 'Create an Agent',
        desc: 'An Agent is a knowledge unit tied to one or more knowledge bases. Configure its behavior, tone, and response style from the dashboard.',
      },
      {
        title: 'Query Understanding',
        desc: 'When a question comes in, the Agent embeds the query and finds the most semantically relevant chunks from your knowledge base — not just keyword matches.',
      },
      {
        title: 'RAG Generation',
        desc: 'The Agent feeds the retrieved chunks to the AI model, which formulates a precise answer using only your source documents. No external data, no hallucinations.',
      },
      {
        title: 'Source Citations',
        desc: 'Every answer includes direct citations — page numbers, clauses, sections. Click to verify. Every answer is auditable and transparent.',
      },
    ],
  },
  {
    layer: 'Layer 3',
    title: 'Distribution',
    desc: 'Deploy your Agent across any channel — your customers access knowledge under your brand.',
    step: '03',
    color: 'indigo',
    items: [
      {
        title: 'Choose Your Channels',
        desc: 'Select where your knowledge should appear: Website Widget, REST API, WhatsApp, Telegram, Slack, Discord, Microsoft Teams, or MCP Server.',
      },
      {
        title: 'White-Label Widget',
        desc: 'Embed a fully branded widget on your website. Custom logo, welcome text, color themes — your customers see your brand, not DocPro.',
      },
      {
        title: 'API Integration',
        desc: 'Integrate your knowledge base into any application via REST API. Query, search, and retrieve answers programmatically.',
      },
      {
        title: 'Chat & Agent Access',
        desc: 'Connect your knowledge to chat platforms your audience already uses — or expose it via MCP Server for AI agents. One knowledge base, infinite reach.',
      },
    ],
  },
]

const colorClasses = {
  blue: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500/20',
    num: 'text-blue-500/10',
    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/20',
    num: 'text-emerald-500/10',
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  indigo: {
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-600 dark:text-indigo-400',
    border: 'border-indigo-500/20',
    num: 'text-indigo-500/10',
    badge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  },
}

function HowItWorks() {
  return (
    <main>
      <section className="relative overflow-hidden pt-20 pb-16 md:py-28">
        <div className="glow-effect bg-blue-500/20 dark:bg-blue-600/10 w-[500px] h-[500px] -top-60 -right-20" />
        <div className="max-w-[1240px] mx-auto px-6 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3">How It Works</div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] text-[var(--fg)]">
              From Documents to<br className="hidden sm:inline" />
              <span className="bg-[var(--grad-brand)] bg-clip-text text-transparent">Distributed Knowledge</span>
            </h1>
            <p className="mt-5 text-lg text-[var(--fg-soft)] leading-relaxed max-w-2xl mx-auto">
              Three layers. One platform. Your documents become AI knowledge accessible anywhere.
            </p>
          </div>
        </div>
      </section>

      {steps.map((s) => {
        const c = colorClasses[s.color as keyof typeof colorClasses]
        return (
          <section key={s.layer} className="py-16 lg:py-24 border-t border-[var(--border)]">
            <div className="max-w-[1240px] mx-auto px-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
                <div className="lg:col-span-5">
                  <div className="sticky top-28">
                    <span className={`text-xs font-extrabold ${c.text} uppercase tracking-widest`}>{s.layer}</span>
                    <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--fg)] mt-2">{s.title}</h2>
                    <p className="mt-4 text-[var(--mutfg)] leading-relaxed">{s.desc}</p>
                    <div className={`mt-8 h-1 w-16 rounded-full ${c.bg}`} />
                  </div>
                </div>
                <div className="lg:col-span-7 space-y-8">
                  {s.items.map((item, i) => (
                    <div key={item.title} className={`card-premium p-6 border ${c.border} relative overflow-hidden`} style={{ background: 'var(--card-bg)' }}>
                      <span className={`absolute top-4 right-6 text-6xl font-black ${c.num} pointer-events-none select-none`}>0{i + 1}</span>
                      <div className="flex gap-4">
                        <div className={`h-10 w-10 rounded-xl ${c.bg} ${c.text} flex items-center justify-center shrink-0 mt-0.5`}>
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-[var(--fg)]">{item.title}</h3>
                          <p className="mt-1.5 text-sm text-[var(--mutfg)] leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )
      })}

      {/* Two Models Summary */}
      <section className="py-16 lg:py-24 border-t border-[var(--border)]" style={{ background: 'color-mix(in oklab, var(--muted) 10%, transparent)' }}>
        <div className="max-w-[1240px] mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--fg)]">Two Ways to Use DocPro</h2>
            <p className="mt-4 text-[var(--mutfg)] text-sm sm:text-base leading-relaxed">Same platform. Two operating models.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="card-premium p-8 text-left" style={{ background: 'var(--card-bg)' }}>
              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-5">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </div>
              <h3 className="text-xl font-bold text-[var(--fg)]">Own Use</h3>
              <p className="mt-2 text-sm text-[var(--mutfg)] leading-relaxed">
                Upload your documents and use the built-in AI Chat in the DocPro dashboard. Ask questions, extract insights, explore your knowledge. Perfect for personal use, internal teams, or customer-facing knowledge.
              </p>
            </div>
            <div className="card-premium p-8 text-left" style={{ background: 'var(--card-bg)' }}>
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-5">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
              </div>
              <h3 className="text-xl font-bold text-[var(--fg)]">Provider Model</h3>
              <p className="mt-2 text-sm text-[var(--mutfg)] leading-relaxed">
                Deploy your knowledge as a white-label Widget on your website, or via API, WhatsApp, Telegram, and more. Your customers get answers from your knowledge base under your brand. Become a knowledge provider without building RAG infrastructure.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 border-t border-[var(--border)]" style={{ background: 'var(--card-bg)' }}>
        <div className="max-w-[1240px] mx-auto px-6">
          <div className="relative overflow-hidden rounded-[32px] px-10 py-16 lg:p-20 text-center text-white shadow-2xl" style={{ background: 'linear-gradient(135deg, #1E1B4B 0%, #2563EB 100%)' }}>
            <div className="absolute -right-20 -top-20 w-80 h-80 bg-blue-500/30 rounded-full blur-3xl pointer-events-none" />
            <div className="relative max-w-2xl mx-auto flex flex-col items-center">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">Ready to Get Started?</h2>
              <p className="mt-5 text-white/80 text-sm sm:text-base max-w-lg leading-relaxed">Upload your first document in minutes. Free plan available, no credit card.</p>
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
