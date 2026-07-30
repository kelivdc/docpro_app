import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { DashboardHeader } from './index'
import { PlanCard } from '../../components/PlanCard'
import { getDashboardUsage } from '../../server/functions/usage'
import type { DashboardUsage } from '../../server/functions/usage'
import {
  getSubscriptionStatus,
  purchaseSubscription,
  purchaseTopup,
  TOPUP_PACKAGES,
  type SubscriptionStatus,
} from '../../server/functions/subscription'

interface LoaderData {
  usage: DashboardUsage
  sub: SubscriptionStatus
}

export const Route = createFileRoute('/dashboard/plans')({
  loader: async (): Promise<LoaderData> => ({
    usage: await getDashboardUsage(),
    sub: await getSubscriptionStatus(),
  }),
  component: PlansPage,
  head: () => ({
    meta: [{ title: 'DocPro — Plans' }],
  }),
})

function PlansPage() {
  const { usage, sub } = Route.useLoaderData()
  const tier = usage?.tier ?? 'free'
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  const handleSubscribe = async (planTier: string) => {
    setBusy(`sub-${planTier}`)
    try {
      await purchaseSubscription({ data: { tier: planTier } })
      router.invalidate()
    } finally {
      setBusy(null)
    }
  }

  const handleTopup = async (tokens: number, price: number) => {
    setBusy(`topup-${tokens}`)
    try {
      await purchaseTopup({ data: { tokens, price } })
      router.invalidate()
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <DashboardHeader />
      <main className="flex-1 bg-[var(--bg-soft)]">
        <div className="mx-auto w-full max-w-[1200px] px-6 py-8">
        <section className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-[var(--fg)]">Upgrade Your Plan</h2>
              <p className="mt-1 text-sm text-[var(--mutfg)]">
                Choose the plan that fits your needs.
              </p>
            </div>
            <span className="rounded-lg border border-[var(--border)] bg-[var(--muted)] px-3 py-1.5 text-xs font-semibold text-[var(--mutfg)]">Tax &amp; Server fees included</span>
          </div>

          {sub.active && sub.expiresAt && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] px-4 py-3 text-sm">
              <span className="font-semibold text-[var(--fg)]">{sub.tier === 'pro' ? 'Pro' : 'Business'} Plan</span>
              <span className="mx-2 text-[var(--mutfg)]">·</span>
              <span className="text-[var(--mutfg)]">Expires {new Date(sub.expiresAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <span className="mx-2 text-[var(--mutfg)]">·</span>
              <span className="text-[var(--mutfg)]">Top-up balance: <strong className="text-[var(--fg)]">{(sub.topupBalance / 1_000_000).toFixed(1)}M</strong> tokens</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mx-auto max-w-5xl">
            <PlanCard name="Free" price="$0" note="Start free, upgrade anytime" footnote="No credit card required<br />Cancel anytime" features={['50 MB Storage', 'AI Capacity (≈ 50k tokens)', 'OCR 50 pages']} cta={tier === 'free' ? 'Active' : 'Start Free'} active={tier === 'free'} />
            <PlanCard
              name="Pro"
              price="$9"
              note="For professionals"
              active={tier === 'pro'}
              features={['1 GB Storage', 'AI Capacity (≈ 5M tokens)', 'AI Chat', 'OCR', 'AI Summary', 'AI Translation']}
              cta={tier === 'pro' ? 'Active' : busy === 'sub-pro' ? '…' : tier === 'free' ? 'Upgrade' : 'Switch to Pro'}
              onClick={tier !== 'pro' ? () => handleSubscribe('pro') : undefined}
            />
            <PlanCard
              name="Business"
              price="$49"
              note="For small teams"
              recommended={true}
              highlight={true}
              active={tier === 'business'}
              features={['<strong class="text-orange-600">Everything in Pro, plus:</strong>', '20 GB Storage', 'AI Capacity (≈ 50M tokens)', 'AI Website Widget', 'Multiple AI Assistants', 'Team Workspace', 'API Access', 'Priority AI Processing']}
              cta={tier === 'business' ? 'Active' : busy === 'sub-business' ? '…' : tier === 'free' ? 'Choose Business' : 'Switch to Business'}
              onClick={tier !== 'business' ? () => handleSubscribe('business') : undefined}
            />
            <PlanCard name="Enterprise" price="Contact Sales" note="For large organizations" amber={true} active={tier === 'enterprise'} features={['<strong class="text-orange-600">Everything in Business, plus:</strong>', 'Private AI Deployment', 'On-Premise', 'SSO', 'White Label', 'Dedicated Success Manager', 'SLA 99.9%']} cta="Contact Sales" />
          </div>

          {(tier === 'pro' || tier === 'business') && (
            <section>
              <h3 className="text-lg font-extrabold tracking-tight text-[var(--fg)]">Top-Up Token</h3>
              <p className="mt-1 text-sm text-[var(--mutfg)]">Buy additional token balance. Expires 1 month from purchase.</p>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {TOPUP_PACKAGES.map((pkg) => (
                  <button
                    key={pkg.tokens}
                    onClick={() => handleTopup(pkg.tokens, pkg.price)}
                    disabled={busy === `topup-${pkg.tokens}`}
                    className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 text-left transition-all hover:border-[var(--primary)] hover:shadow-sm disabled:opacity-50"
                  >
                    <div className="text-lg font-extrabold text-[var(--fg)]">{(pkg.tokens / 1_000_000).toFixed(0)}M</div>
                    <div className="mt-1 text-xs text-[var(--mutfg)]">tokens</div>
                    <div className="mt-2 text-sm font-bold text-[var(--primary)]">${pkg.price}</div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </section>
      </div>
      </main>
    </>
  )
}
