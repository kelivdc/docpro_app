export function PlanCard({
  name,
  price,
  note,
  subnote,
  footnote,
  features,
  cta,
  active,
  amber,
  recommended,
  highlight,
  ctaOrange,
}: {
  name: string
  price: string
  note: string
  subnote?: string
  footnote?: string
  features: string[]
  cta: string
  active?: boolean
  amber?: boolean
  recommended?: boolean
  highlight?: boolean
  ctaOrange?: boolean
}) {
  const border = recommended ? 'border-amber-500 ring-2 ring-amber-500/30' : amber ? 'border-amber-500/30' : active ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-[var(--border)]'
  const bg = highlight ? '!bg-blue-50' : ''
  return (
    <div className={`card-premium flex flex-col justify-between p-5 text-center ${border} ${bg}`}>
      <div>
        <div className="min-h-[110px]">
          <div className="flex items-center justify-center gap-2">
            <div className={`text-sm font-extrabold ${amber ? 'text-amber-600' : active ? 'text-blue-600' : 'text-[var(--fg)]'}`}>{name}</div>
            {recommended && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-extrabold text-amber-600">Most Popular</span>
            )}
          </div>
          <div className="mt-1 text-xs text-[var(--mutfg)]">{note}</div>
          <div className="mt-4"><span className="text-xl font-black tracking-tight text-[var(--fg)]">{price}</span></div>
          {subnote && <div className="mt-1 text-[10px] text-[var(--mutfg)]">{subnote}</div>}
        </div>
        <ul className="mt-4 space-y-2 border-t border-[var(--border)]/50 pt-4 font-medium text-xs text-[var(--mutfg)]">
          {features.map((f) => (
            <li key={f} className="flex items-center justify-center gap-2"><span className="text-sm text-emerald-500">✓</span> <span dangerouslySetInnerHTML={{ __html: f }} /></li>
          ))}
        </ul>
        {footnote && <div className="mt-3 text-[10px] text-[var(--mutfg)]" dangerouslySetInnerHTML={{ __html: footnote }} />}
      </div>
      <button
        className={
          active
            ? 'mt-6 w-full cursor-default rounded-xl bg-blue-500/10 py-2.5 text-xs font-bold text-blue-600'
            : amber
              ? 'mt-6 w-full cursor-pointer rounded-xl border border-amber-500/50 py-2.5 text-xs font-bold text-amber-600 hover:bg-amber-500/10'
              : ctaOrange
                ? 'mt-6 w-full cursor-pointer rounded-xl bg-orange-600 py-2.5 text-xs font-bold text-white hover:bg-orange-700'
                : 'mt-6 w-full cursor-pointer rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700'
        }
        disabled={active}
      >
        {cta}
      </button>
    </div>
  )
}
