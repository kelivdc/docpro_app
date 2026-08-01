interface DonutChartProps {
  pct: number
  label: string
  value: string
  subvalue?: string
  color: string
  size?: number
}

export function DonutChart({ pct, label, value, subvalue, color, size = 120 }: DonutChartProps) {
  const clampedPct = Math.max(0, Math.min(100, pct))
  const radius = (size - 16) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (clampedPct / 100) * circumference
  const gradId = `donut-${label.replace(/\s+/g, '-').toLowerCase()}`

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color.split(' ')[0]} />
              <stop offset="100%" stopColor={color.split(' ')[1] ?? color.split(' ')[0]} />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--muted)"
            strokeWidth="8"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-extrabold text-[var(--fg)]">{clampedPct}%</span>
          <span className="text-[10px] font-medium text-[var(--mutfg)]">available</span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-sm font-semibold text-[var(--fg)]">{label}</div>
        <div className="text-xs text-[var(--mutfg)]">{value}{subvalue && <span className="text-[var(--mutfg)]"> / {subvalue}</span>}</div>
      </div>
    </div>
  )
}
