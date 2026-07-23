import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'

export const Route = createFileRoute('/')({
  component: App,
  head: () => ({
    meta: [{ title: 'DocPro — AI Knowledge Platform' }],
  }),
})

const qaPairs: Record<string, { docName: string; answer: string; citations: string[] }> = {
  "What are the NDA terms?": {
    docName: "NDA_Partnership.docx",
    answer: 'Based on <b class="text-blue-600 dark:text-blue-400">NDA_Partnership.docx</b>, the parties bound by this confidentiality agreement are <b class="font-bold text-[var(--fg)]">DocPro Global Inc.</b> (as Disclosing Party) and <b class="font-bold text-[var(--fg)]">PT Solusi Digital Indonesia</b> (as Receiving Party). The NDA was signed on June 10, 2026.',
    citations: ["Section 1.1 (Parties)", "Signature (Page 5)"],
  },
  "Find overdue invoices": {
    docName: "Invoice_Sejahtera.pdf",
    answer: 'Based on <b class="text-blue-600 dark:text-blue-400">Invoice_Sejahtera.pdf</b>:<br/><br/>There is a payment due on <b class="text-red-600 font-bold">June 30, 2026</b> for <b class="font-bold text-[var(--fg)]">IDR 12,500,000</b> from CV Sejahtera Abadi with status <b class="text-red-600 font-bold">UNPAID</b>.',
    citations: ["Invoice Table (Page 1)", "Payment Terms (Page 2)"],
  },
}

function App() {
  const [faqOpen, setFaqOpen] = useState<number | null>(null)
  const defaultChat: { role: string; html: string }[] = [
    {
      role: 'user',
      html: 'What does the confidentiality clause in NDA_Partnership.docx cover?',
    },
    {
      role: 'ai',
      html: `<p class="text-[var(--fg)] font-medium">Based on <b class="text-blue-600 dark:text-blue-400">NDA_Partnership.docx</b>, the confidentiality clause binds both parties to not disclose business, technical, or financial information to third parties without written consent. Valid for <b class="font-bold text-[var(--fg)]">5 years</b> from signing (June 10, 2026).</p><div class="mt-3.5 flex flex-wrap gap-2"><a class="inline-flex items-center gap-1.5 text-[10px] bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold rounded-full px-3 py-1.5 border border-blue-500/10 transition-colors duration-150" href="#"><svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 0 01-2-2V5a2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 0 01-2 2z"/></svg>Section 3.1 (Confidentiality)</a><a class="inline-flex items-center gap-1.5 text-[10px] bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold rounded-full px-3 py-1.5 border border-blue-500/10 transition-colors duration-150" href="#"><svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 0 01-2-2V5a2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 0 01-2 2z"/></svg>Duration (Page 2)</a></div>`,
    },
  ]

  const [chatMessages, setChatMessages] = useState<{ role: string; html: string }[]>(defaultChat)
  const [chatTyping, setChatTyping] = useState(false)
  const [simState, setSimState] = useState<'drop' | 'uploading' | 'processing' | 'success'>('drop')
  const [simProgress, setSimProgress] = useState(0)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, chatTyping])

  useEffect(() => {
    const timer1 = setTimeout(() => setSimState('uploading'), 2500)
    return () => clearTimeout(timer1)
  }, [])

  useEffect(() => {
    if (simState !== 'uploading') return
    let p = 0
    const interval = setInterval(() => {
      p += 4
      setSimProgress(p)
      if (p >= 100) {
        clearInterval(interval)
        setTimeout(() => setSimState('processing'), 400)
        setTimeout(() => setSimState('success'), 2900)
      }
    }, 70)
    return () => clearInterval(interval)
  }, [simState])

  useEffect(() => {
    if (simState !== 'success') return
    const t = setTimeout(() => {
      setSimProgress(0)
      setSimState('drop')
    }, 5000)
    return () => clearTimeout(t)
  }, [simState])

  function handleSuggestion(q: string) {
    const qa = qaPairs[q]
    if (!qa) return
    setChatTyping(true)
    setChatMessages((prev) => [...prev, { role: 'user', html: q }])
    setTimeout(() => {
      setChatTyping(false)
      const citationsHtml = qa.citations
        .map(
          (c) =>
            `<a class="inline-flex items-center gap-1.5 text-[10px] bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold rounded-full px-3 py-1.5 border border-blue-500/10 transition-colors duration-150" href="#">
              <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              ${c}
            </a>`
        )
        .join('')
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          html: `<p class="text-[var(--fg)] font-medium">${qa.answer}</p><div class="mt-3.5 flex flex-wrap gap-2">${citationsHtml}</div>`,
        },
      ])
    }, 1800)
  }

  const faqs = [
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
      q: 'Is there a free plan?',
      a: 'Yes. The free plan includes 50 MB storage with a max file size of 5 MB per file. You can freely try AI Q&A and metadata extraction with no time limit and no credit card required.',
    },
  ]

  const channels = [
    { name: 'Website Widget', desc: 'Embed on any site' },
    { name: 'REST API', desc: 'Integrate anywhere' },
    { name: 'WhatsApp', desc: 'Chat interface' },
    { name: 'Telegram', desc: 'Bot integration' },
    { name: 'Slack', desc: 'Team workspace' },
    { name: 'Discord', desc: 'Community server' },
    { name: 'MCP Server', desc: 'AI agent protocol' },
  ]

  return (
    <main>
      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden pt-12 pb-24 md:py-32">
        <div className="absolute inset-0 opacity-100 pointer-events-none" style={{
          backgroundSize: '50px 50px',
          backgroundImage:
            'linear-gradient(to right, var(--line) 1px, transparent 1px), linear-gradient(to bottom, var(--line) 1px, transparent 1px)',
          maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 85%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 85%)',
        }} />
        <div className="glow-effect bg-blue-500/20 dark:bg-blue-600/10 w-[500px] h-[500px] -top-60 -right-20" />
        <div className="glow-effect bg-emerald-400/20 dark:bg-emerald-500/10 w-[450px] h-[450px] top-60 -left-40" />

        <div className="max-w-[1240px] mx-auto px-6 relative">
          <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 dark:from-blue-500/10 dark:to-indigo-500/10 border border-blue-500/15 rounded-full px-3.5 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 mb-8 shadow-sm hover:scale-105 transition-transform duration-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              AI Knowledge Platform
              <span className="text-indigo-600 dark:text-indigo-400 font-bold ml-1.5">Learn more →</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] text-[var(--fg)]">
              Turn your documents into<br className="hidden sm:inline" />
              <span className="bg-[var(--grad-brand)] bg-clip-text text-transparent">AI Knowledge.</span>
            </h1>

            <p className="mt-6 text-lg md:text-xl text-[var(--fg-soft)] leading-relaxed max-w-2xl mx-auto">
              Upload contracts, invoices, policies — get instant answers with source citations.
              Distribute your knowledge across websites, chat apps, and APIs. One platform, infinite reach.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
              <Link
                to="/register"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl px-7 py-4 text-base font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 inline-flex items-center justify-center gap-2.5 w-full sm:w-auto hover:-translate-y-0.5 transition-all duration-200"
                style={{ color: '#fff' }}
              >
                Get started free
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </Link>
              <Link
                to="/how-it-works"
                className="border border-[var(--border)] bg-[var(--card-bg)] hover:bg-[var(--muted)] text-[var(--fg)] rounded-xl px-7 py-4 text-base font-semibold inline-flex items-center justify-center gap-2.5 w-full sm:w-auto hover:-translate-y-0.5 transition-all duration-200"
              >
                <svg className="w-5 h-5 text-[var(--mutfg)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" /></svg>
                See how it works
              </Link>
            </div>

            <p className="mt-5 text-xs text-[var(--mutfg)] font-medium">Start in 2 minutes · 50 MB free storage · No credit card</p>

        </div>

        {/* CHAT PREVIEW */}
        <div className="mt-16 max-w-5xl mx-auto">
            <div className="card-premium p-0 overflow-hidden border border-[var(--border)] shadow-2xl relative" style={{ background: 'var(--card-bg)' }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]" style={{ background: 'color-mix(in oklab, var(--muted) 40%, transparent)' }}>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-[#FF5F56]" />
                  <span className="h-3 w-3 rounded-full bg-[#FFBD2E]" />
                  <span className="h-3 w-3 rounded-full bg-[#27C93F]" />
                  <span className="ml-4 text-xs font-semibold text-[var(--mutfg)] font-mono tracking-wider">docpro.ai/knowledge</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-[11px] font-medium text-[var(--mutfg)]">Live Preview</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 min-h-[420px]">
                <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-[var(--border)] p-4" style={{ background: 'color-mix(in oklab, var(--muted) 20%, transparent)' }}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-[var(--fg)] uppercase tracking-wider">Knowledge Sources (4)</span>
                    <span className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold px-2 py-0.5 rounded-full border border-blue-500/10">Indexed</span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { name: 'Contract_PT_ABC.docx', size: '1.4 MB', cat: 'Legal', color: 'blue' },
                      { name: 'Invoice_Sejahtera.pdf', size: '842 KB', cat: 'Finance', color: 'emerald' },
                      { name: 'Leave_Policy_2026.pdf', size: '1.1 MB', cat: 'HR', color: 'purple' },
                      { name: 'NDA_Partnership.docx', size: '540 KB', cat: 'Legal', color: 'blue' },
                    ].map((f, i) => (
                      <div
                        key={f.name}
                        className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all duration-200 ${
                          i === 0
                            ? 'border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10'
                            : 'border-[var(--border)] hover:bg-[var(--muted)]/40'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                            f.cat === 'Legal' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                            f.cat === 'Finance' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                            'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                          }`}>
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          </div>
                          <div className="text-left min-w-0">
                            <p className="text-xs font-bold text-[var(--fg)] truncate">{f.name}</p>
                            <p className="text-[10px] text-[var(--mutfg)]">{f.size}</p>
                          </div>
                        </div>
                        <span className={`h-1.5 w-1.5 rounded-full ${i === 0 ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-8 flex flex-col p-6 h-[420px] justify-between" style={{ background: 'var(--card-bg)' }}>
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                    {chatMessages.map((msg, i) =>
                      msg.role === 'user' ? (
                        <div key={i} className="flex justify-end">
                          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-xs font-medium max-w-[80%] shadow-sm">
                            {msg.html}
                          </div>
                        </div>
                      ) : (
                        <div key={i} className="flex gap-3 text-left">
                          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
                            DP
                          </div>
                          <div className="bg-[var(--muted)] rounded-2xl rounded-tl-sm px-4.5 py-3.5 text-xs max-w-[85%] border border-[var(--border)] shadow-sm" dangerouslySetInnerHTML={{ __html: msg.html }} />
                        </div>
                      )
                    )}
                    {chatTyping && (
                      <div className="flex gap-3 text-left">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
                          DP
                        </div>
                        <div className="bg-[var(--muted)] rounded-2xl rounded-tl-sm px-4 py-2.5 text-xs max-w-[85%] border border-[var(--border)] shadow-sm">
                          <span className="text-[var(--mutfg)] font-medium">DocPro is searching for answers...</span>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="mt-4 pt-3 border-t border-[var(--border)]">
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {['What are the NDA terms?', 'Find overdue invoices'].map((q) => (
                        <button
                          key={q}
                          onClick={() => handleSuggestion(q)}
                          className="text-[10px] bg-[var(--muted)] hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 border border-[var(--border)] rounded-lg px-2.5 py-1 text-[var(--mutfg)] font-medium transition-all duration-200"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        placeholder="Ask anything about your documents..."
                        className="w-full text-xs bg-[var(--muted)] border border-[var(--border)] rounded-xl px-4 py-3 pr-10 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 text-[var(--fg)] transition-all duration-300"
                        disabled
                      />
                      <button className="absolute right-2 p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-200">
                        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9-7-9-7v14z" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="py-12" style={{ background: 'color-mix(in oklab, var(--muted) 10%, transparent)' }}>
        <div className="max-w-[1240px] mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { value: '10k+', label: 'Knowledge Indexed' },
              { value: '98%', label: 'Answer Accuracy' },
              { value: '<3s', label: 'Response Time' },
              { value: '5h', label: 'Saved / Week' },
            ].map((s) => (
              <div key={s.label} className="p-6 rounded-2xl border border-[var(--border)] text-center shadow-sm hover:border-blue-500/20 transition-all duration-200" style={{ background: 'var(--card-bg)' }}>
                <div className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                  {s.value}
                </div>
                <div className="text-xs font-bold text-[var(--mutfg)] mt-2 uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DUAL MODEL */}
      <section className="py-20 lg:py-28 border-t border-[var(--border)]" style={{ background: 'var(--card-bg)' }}>
        <div className="max-w-[1240px] mx-auto px-6">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <div className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3">Two Ways to Use DocPro</div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--fg)]">Your Knowledge. Your Way.</h2>
            <p className="mt-4 text-[var(--mutfg)] text-sm sm:text-base leading-relaxed">Use it for your own organization, or become a knowledge provider for your clients.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="card-premium p-8 text-left relative overflow-hidden group" style={{ background: 'color-mix(in oklab, var(--muted) 20%, transparent)' }}>
              <div className="absolute -right-12 -top-12 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-300" />
              <div className="h-14 w-14 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-6">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </div>
              <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Own Use</span>
              <h3 className="text-2xl font-bold text-[var(--fg)] mt-2">AI Chat in your Dashboard</h3>
              <p className="mt-3 text-sm text-[var(--mutfg)] leading-relaxed">
                Upload your documents and use the built-in AI Chat directly in the DocPro dashboard.
                Ask questions, extract insights, and explore your knowledge base conversationally.
                Perfect for personal use, internal teams, or customer-facing knowledge.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="text-[11px] bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold rounded-full px-3 py-1 border border-blue-500/10">Dashboard AI Chat</span>
                <span className="text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold rounded-full px-3 py-1 border border-emerald-500/10">RAG Engine</span>
                <span className="text-[11px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold rounded-full px-3 py-1 border border-indigo-500/10">Knowledge Management</span>
              </div>
            </div>

            <div className="card-premium p-8 text-left relative overflow-hidden group" style={{ background: 'color-mix(in oklab, var(--muted) 20%, transparent)' }}>
              <div className="absolute -right-12 -top-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-300" />
              <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-6">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
              </div>
              <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Provider Model</span>
              <h3 className="text-2xl font-bold text-[var(--fg)] mt-2">Deploy to Any Channel</h3>
              <p className="mt-3 text-sm text-[var(--mutfg)] leading-relaxed">
                Distribute your knowledge as a white-label Widget on your website, or via API, WhatsApp, Telegram, and more.
                Your customers get answers from your knowledge base — under <b>your brand</b>. Become a knowledge provider
                for your clients without building RAG infrastructure.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {channels.filter((_, i) => i < 4).map((c) => (
                  <span key={c.name} className="text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold rounded-full px-3 py-1 border border-emerald-500/10">{c.name}</span>
                ))}
                <span className="text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold rounded-full px-3 py-1 border border-emerald-500/10">+{channels.length - 4} more</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DISTRIBUTION CHANNELS */}
      <section className="py-20 lg:py-28 border-t border-[var(--border)]" style={{ background: 'color-mix(in oklab, var(--muted) 10%, transparent)' }}>
        <div className="max-w-[1240px] mx-auto px-6">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <div className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3">Multi-Channel Distribution</div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--fg)]">One Knowledge Base. Every Channel.</h2>
            <p className="mt-4 text-[var(--mutfg)] text-sm sm:text-base leading-relaxed">Upload once, deploy everywhere. Your knowledge base is not a chatbot — it's infrastructure.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {channels.map((c) => (
              <div key={c.name} className="card-premium p-5 text-center group hover:border-blue-500/20 transition-all duration-200" style={{ background: 'var(--card-bg)' }}>
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-200">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <h4 className="text-sm font-bold text-[var(--fg)]">{c.name}</h4>
                <p className="text-[11px] text-[var(--mutfg)] mt-1">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SHOWCASE */}
      <section className="py-20 lg:py-28 border-t border-[var(--border)]" style={{ background: 'var(--card-bg)' }}>
        <div className="max-w-[1240px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            <div className="lg:col-span-6 space-y-6 text-left">
              <div className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest">AI-Powered Analysis</div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.15] text-[var(--fg)]">
                Automated Insights.<br />Zero Manual Work.
              </h2>
              <p className="text-[var(--mutfg)] leading-relaxed text-sm sm:text-base">
                DocPro doesn't just index text — it understands semantic context and document structure.
                AI automatically detects dates, financial values, involved parties, and legal obligations in seconds.
              </p>
              <div className="space-y-4 pt-2">
                {[
                  { title: 'Smart Entity Extraction', desc: 'Automatically finds company names, individuals, deadlines, and key locations.' },
                  { title: 'Auto-Categorization', desc: 'Knowledge is sorted into the right folders: Legal, Finance, Policies, or Personal.' },
                  { title: 'Risk Clause Alerts', desc: 'Detects anomalies in penalties, auto-termination, or clauses that may harm your business.' },
                ].map((item) => (
                  <div key={item.title} className="flex gap-3.5">
                    <div className="h-6 w-6 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[var(--fg)]">{item.title}</h4>
                      <p className="text-xs text-[var(--mutfg)] mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="card-premium p-6 border border-[var(--border)] relative overflow-hidden" style={{ background: 'color-mix(in oklab, var(--muted) 30%, transparent)' }}>
                <div className="flex items-center justify-between pb-4 border-b border-[var(--border)] mb-6">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-blue-600 animate-ping" />
                    <span className="text-xs font-bold text-[var(--fg)] uppercase tracking-wider">AI Knowledge Engine</span>
                  </div>
                  <span className="text-[10px] text-[var(--mutfg)] font-mono">
                    Status: {simState === 'drop' ? 'Ready' : simState === 'uploading' ? 'Uploading...' : simState === 'processing' ? 'Analyzing...' : 'Complete'}
                  </span>
                </div>

                <div className="relative min-h-[220px] flex flex-col items-center justify-center">
                  {simState === 'drop' && (
                    <div className="flex flex-col items-center justify-center text-center space-y-3 py-6">
                      <div className="h-16 w-16 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border-2 border-dashed border-blue-500/25">
                        <svg className="h-8 w-8 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[var(--fg)]">Drop your files here</p>
                        <p className="text-[10px] text-[var(--mutfg)] mt-1">Supports PDF, DOCX, XLSX up to 10 MB</p>
                      </div>
                    </div>
                  )}
                  {simState === 'uploading' && (
                    <div className="w-full space-y-4 py-8 px-4">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-[var(--fg)] flex items-center gap-2">
                          <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          Supplier_Logistics_PKS.pdf
                        </span>
                        <span className="text-blue-600 dark:text-blue-400 font-mono">{simProgress}%</span>
                      </div>
                      <div className="h-2 w-full bg-[var(--border)] rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-100 ease-out" style={{ width: `${simProgress}%` }} />
                      </div>
                      <p className="text-[10px] text-[var(--mutfg)] text-center">Transferring file securely with AES-256 encryption...</p>
                    </div>
                  )}
                  {simState === 'processing' && (
                    <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
                      <div className="relative">
                        <div className="h-14 w-14 rounded-full border-4 border-blue-500/20 border-t-blue-600 animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[var(--fg)] animate-pulse">AI Analyzing Knowledge...</p>
                        <p className="text-[10px] text-[var(--mutfg)] mt-1">Parsing paragraphs, reading tables, extracting key metadata</p>
                      </div>
                    </div>
                  )}
                  {simState === 'success' && (
                    <div className="w-full space-y-4 text-left">
                      <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          </div>
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Metadata Extraction Complete</span>
                        </div>
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold px-2 py-0.5 rounded">PDF</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {[
                          { label: 'Parties', value: 'PT Logistik Kilat & CV Supplier', color: 'text-[var(--fg)]' },
                          { label: 'Contract Value', value: 'IDR 450,000,000', color: 'text-emerald-600 dark:text-emerald-400' },
                          { label: 'Effective Date', value: 'August 12, 2026', color: 'text-[var(--fg)]' },
                          { label: 'Category', value: 'Vendor Contract', color: 'text-blue-600 dark:text-blue-400' },
                        ].map((m) => (
                          <div key={m.label} className="border border-[var(--border)] rounded-xl p-2.5" style={{ background: 'var(--card-bg)' }}>
                            <span className="text-[9px] text-[var(--mutfg)] font-semibold uppercase tracking-wider block">{m.label}</span>
                            <span className={`font-bold block truncate mt-0.5 ${m.color}`}>{m.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-20 lg:py-28 border-t border-[var(--border)]" style={{ background: 'color-mix(in oklab, var(--muted) 10%, transparent)' }}>
        <div className="max-w-[1240px] mx-auto px-6">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <div className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3">Features</div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--fg)]">Everything You Need to Master Your Knowledge</h2>
            <p className="mt-4 text-[var(--mutfg)] text-sm sm:text-base leading-relaxed">From instant upload to contextual answers — DocPro handles the full knowledge workflow.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'AI Chat with Sources', desc: 'Ask anything about your knowledge. AI answers with direct citations to source pages and clauses for instant verification.', glow: 'bg-blue-500/10', iconBg: 'bg-blue-500/10', iconText: 'text-blue-600 dark:text-blue-400' },
              { title: 'Multi-Format Upload', desc: 'Upload Word (.docx), PDF, Excel (.xlsx), and Text (.txt) files. Your knowledge is parsed, indexed, and searchable in seconds.', glow: 'bg-emerald-500/10', iconBg: 'bg-emerald-500/10', iconText: 'text-emerald-600 dark:text-emerald-400' },
              { title: 'White-Label Widget', desc: 'Embed a fully branded knowledge widget on your website. Custom logo, welcome text, and themes — your customers see your brand.', glow: 'bg-indigo-500/10', iconBg: 'bg-indigo-500/10', iconText: 'text-indigo-600 dark:text-indigo-400' },
              { title: 'Encrypted & Private', desc: 'Data is encrypted at rest (AES-256) and in transit (SSL/TLS). DocPro guarantees your knowledge is never used to train public AI models.', glow: 'bg-rose-500/10', iconBg: 'bg-rose-500/10', iconText: 'text-rose-600 dark:text-rose-400' },
              { title: 'Share Securely', desc: 'Share knowledge or AI chat links securely with your team. Set link expiry and access limits with ease.', glow: 'bg-purple-500/10', iconBg: 'bg-purple-500/10', iconText: 'text-purple-600 dark:text-purple-400' },
              { title: 'Categories & Metadata', desc: 'Organize knowledge with visual categories and tags. AI understands document relationships for higher accuracy.', glow: 'bg-teal-500/10', iconBg: 'bg-teal-500/10', iconText: 'text-teal-600 dark:text-teal-400' },
            ].map((f) => (
              <div key={f.title} className="card-premium p-6 relative overflow-hidden group" style={{ background: 'var(--card-bg)' }}>
                <div className={`absolute -right-8 -top-8 w-24 h-24 ${f.glow} rounded-full blur-xl group-hover:scale-150 transition-transform duration-300`} />
                <div className={`h-12 w-12 rounded-xl ${f.iconBg} ${f.iconText} flex items-center justify-center shadow-sm shrink-0`}>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="mt-5 text-lg font-bold text-[var(--fg)]">{f.title}</h3>
                <p className="mt-2 text-sm text-[var(--mutfg)] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              to="/features"
              className="text-sm text-blue-600 dark:text-blue-400 font-semibold hover:underline inline-flex items-center gap-1.5"
            >
              View All Features
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-20 lg:py-28 border-t border-[var(--border)]" style={{ background: 'var(--card-bg)' }}>
        <div className="max-w-[1240px] mx-auto px-6">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <div className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3">How It Works</div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--fg)]">Three Simple Steps.</h2>
            <p className="mt-4 text-[var(--mutfg)] text-sm sm:text-base leading-relaxed">From scattered files to accurate answers in minutes.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {[
              { num: '01', glow: 'text-blue-500/10', iconBg: 'bg-blue-500/10', iconText: 'text-blue-600 dark:text-blue-400', title: 'Upload Your Knowledge', desc: 'Upload Word, PDF, Excel, or text files. Add notes and categorize your files flexibly.' },
              { num: '02', glow: 'text-emerald-500/10', iconBg: 'bg-emerald-500/10', iconText: 'text-emerald-600 dark:text-emerald-400', title: 'AI Parses & Indexes', desc: 'The RAG engine securely breaks down your knowledge into intelligent vector chunks. Ready in seconds.' },
              { num: '03', glow: 'text-indigo-500/10', iconBg: 'bg-indigo-500/10', iconText: 'text-indigo-600 dark:text-indigo-400', title: 'Ask & Get Answers', desc: 'Ask anything in natural language. Get summaries, contract comparisons, or specific data with evidence.' },
            ].map((s) => (
              <div key={s.num} className="card-premium p-6 text-left relative overflow-hidden transition-all duration-200" style={{ background: 'color-mix(in oklab, var(--muted) 20%, transparent)' }}>
                <span className={`absolute top-4 right-6 text-6xl font-black ${s.glow} pointer-events-none select-none`}>{s.num}</span>
                <div className={`h-12 w-12 rounded-xl ${s.iconBg} ${s.iconText} flex items-center justify-center shadow-sm shrink-0 mb-6`}>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                </div>
                <h3 className="text-lg font-bold text-[var(--fg)]">{s.title}</h3>
                <p className="mt-2.5 text-xs text-[var(--mutfg)] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 lg:py-28 border-t border-[var(--border)]" style={{ background: 'var(--card-bg)' }}>
        <div className="max-w-[820px] mx-auto px-6">
          <div className="text-center mb-16">
            <div className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3">FAQ</div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--fg)]">Frequently Asked Questions</h2>
            <p className="mt-4 text-[var(--mutfg)] text-sm sm:text-base leading-relaxed">Quick answers to common questions about DocPro.</p>
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
                    className={`w-5 h-5 text-[var(--mutfg)] transform transition-transform duration-200 ${faqOpen === i ? 'rotate-180' : ''}`}
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

      {/* CTA FINAL */}
      <section className="py-20 border-t border-[var(--border)]" style={{ background: 'var(--card-bg)' }}>
        <div className="max-w-[1240px] mx-auto px-6">
          <div className="relative overflow-hidden rounded-[32px] px-10 py-16 lg:p-20 text-center text-white shadow-2xl" style={{ background: 'linear-gradient(135deg, #1E1B4B 0%, #2563EB 100%)' }}>
            <div className="absolute -right-20 -top-20 w-80 h-80 bg-blue-500/30 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="relative max-w-2xl mx-auto flex flex-col items-center">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">Ready to Unlock Your<br />Knowledge?</h2>
              <p className="mt-5 text-white/80 text-sm sm:text-base max-w-lg leading-relaxed">Upload your documents for free today. Manage efficiently, scale anytime. No credit card required.</p>
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
