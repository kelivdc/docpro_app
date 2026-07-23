import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/features')({
  component: Features,
  head: () => ({
    meta: [{ title: 'DocPro — Features' }],
  }),
})

const features = [
  {
    section: 'Knowledge Engine',
    desc: 'Upload, process, and manage your documents — the foundation of your AI knowledge base.',
    items: [
      {
        title: 'Multi-Format Upload',
        desc: 'Upload PDF, Word (.docx), Excel (.xlsx), and plain text (.txt) files. Your documents are automatically parsed, chunked, and vectorized.',
        icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
      },
      {
        title: 'Auto Chunking & Vectorization',
        desc: 'Documents are intelligently split into semantic chunks and converted to vector embeddings for fast, accurate retrieval.',
        icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4',
      },
      {
        title: 'AI Metadata Extraction',
        desc: 'Automatically extract key information — dates, parties, financial values, categories — from every document you upload.',
        icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      },
      {
        title: 'Smart Categorization',
        desc: 'Organize knowledge with categories and tags. AI understands relationships between documents for higher accuracy.',
        icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
      },
    ],
  },
  {
    section: 'AI Chat & Retrieval',
    desc: 'Ask anything and get precise answers sourced from your knowledge base.',
    items: [
      {
        title: 'RAG-Powered Q&A',
        desc: 'State-of-the-art Retrieval-Augmented Generation. AI answers are formulated only from your documents, not external data.',
        icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
      },
      {
        title: 'Source Citations',
        desc: 'Every answer includes links to the exact source — page numbers, clauses, and sections. Verify any answer instantly.',
        icon: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      },
      {
        title: 'Dashboard AI Chat',
        desc: 'Built-in conversational interface in your DocPro dashboard. Ask questions, explore knowledge, get insights — all without leaving the platform.',
        icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
      },
      {
        title: 'Contextual Understanding',
        desc: 'AI understands document structure, relationships between clauses, and can compare multiple documents in a single conversation.',
        icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
      },
    ],
  },
  {
    section: 'Multi-Channel Distribution',
    desc: 'Deploy your knowledge across every channel your audience uses.',
    items: [
      {
        title: 'White-Label Website Widget',
        desc: 'Embed a fully branded AI knowledge widget on your website. Custom logo, welcome text, color themes — your customers see your brand.',
        icon: 'M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
      },
      {
        title: 'REST API',
        desc: 'Integrate your knowledge base into any application via a clean REST API. Query, search, and retrieve answers programmatically.',
        icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
      },
      {
        title: 'Chat Apps',
        desc: 'Connect your knowledge to WhatsApp, Telegram, Slack, Discord, and Microsoft Teams. Meet your users where they already are.',
        icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
      },
      {
        title: 'MCP Server',
        desc: 'Expose your knowledge through the Model Context Protocol — enabling AI agents and future AI tools to access your knowledge directly.',
        icon: 'M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4',
      },
    ],
  },
  {
    section: 'Security & Control',
    desc: 'Your data is yours. Enterprise-grade security, full control over access and sharing.',
    items: [
      {
        title: 'End-to-End Encryption',
        desc: 'Data encrypted at rest (AES-256) and in transit (SSL/TLS). Your knowledge is never used to train public AI models.',
        icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
      },
      {
        title: 'Secure Sharing',
        desc: 'Share knowledge or AI chat links with expiry dates and access limits. Full control over who sees what.',
        icon: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z',
      },
      {
        title: 'Dual Model: Own & Provider',
        desc: 'Use DocPro for your own organization or become a knowledge provider for your clients — all on one platform, under your brand.',
        icon: 'M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15',
      },
      {
        title: 'Token Usage Control',
        desc: 'Monitor and control token usage per plan. Pay only for what you use with transparent pricing.',
        icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      },
    ],
  },
]

function FeatureCard({ title, desc, icon }: { title: string; desc: string; icon: string }) {
  return (
    <div className="card-premium p-6 relative overflow-hidden group" style={{ background: 'var(--card-bg)' }}>
      <div className="absolute -right-8 -top-8 w-24 h-24 bg-blue-500/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-300" />
      <div className="h-12 w-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-sm shrink-0">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <h3 className="mt-5 text-lg font-bold text-[var(--fg)]">{title}</h3>
      <p className="mt-2 text-sm text-[var(--mutfg)] leading-relaxed">{desc}</p>
    </div>
  )
}

function Features() {
  return (
    <main>
      <section className="relative overflow-hidden pt-20 pb-16 md:py-28">
        <div className="absolute inset-0 opacity-100 pointer-events-none" style={{
          backgroundSize: '50px 50px',
          backgroundImage:
            'linear-gradient(to right, var(--line) 1px, transparent 1px), linear-gradient(to bottom, var(--line) 1px, transparent 1px)',
          maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 85%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 85%)',
        }} />
        <div className="glow-effect bg-blue-500/20 dark:bg-blue-600/10 w-[500px] h-[500px] -top-60 -right-20" />
        <div className="max-w-[1240px] mx-auto px-6 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3">Features</div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] text-[var(--fg)]">
              Everything You Need for<br className="hidden sm:inline" />
              <span className="bg-[var(--grad-brand)] bg-clip-text text-transparent">AI Knowledge</span>
            </h1>
            <p className="mt-5 text-lg text-[var(--fg-soft)] leading-relaxed max-w-2xl mx-auto">
              DocPro is not a chatbot. It's a knowledge infrastructure platform — from document upload to multi-channel distribution.
            </p>
          </div>
        </div>
      </section>

      {features.map((group) => (
        <section key={group.section} className="py-16 lg:py-24 border-t border-[var(--border)]" style={{ background: 'var(--card-bg)' }}>
          <div className="max-w-[1240px] mx-auto px-6">
            <div className="max-w-2xl mb-12">
              <div className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3">{group.section}</div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--fg)]">{group.desc}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {group.items.map((item) => (
                <FeatureCard key={item.title} {...item} />
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="py-20 border-t border-[var(--border)]" style={{ background: 'var(--card-bg)' }}>
        <div className="max-w-[1240px] mx-auto px-6">
          <div className="relative overflow-hidden rounded-[32px] px-10 py-16 lg:p-20 text-center text-white shadow-2xl" style={{ background: 'linear-gradient(135deg, #1E1B4B 0%, #2563EB 100%)' }}>
            <div className="absolute -right-20 -top-20 w-80 h-80 bg-blue-500/30 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="relative max-w-2xl mx-auto flex flex-col items-center">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">Ready to Build Your<br />Knowledge Infrastructure?</h2>
              <p className="mt-5 text-white/80 text-sm sm:text-base max-w-lg leading-relaxed">Start for free. No credit card required. Upgrade when you grow.</p>
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
