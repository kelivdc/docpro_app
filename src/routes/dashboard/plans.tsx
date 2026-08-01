import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { DashboardHeader } from './index'
import { PlanCard } from '../../components/PlanCard'
import { getDashboardUsage } from '../../server/functions/usage'
import type { DashboardUsage } from '../../server/functions/usage'
import {
  getSubscriptionStatus,
  getPriceCatalog,
  purchaseSubscription,
  purchaseTopup,
  type SubscriptionStatus,
  type PriceCatalog,
} from '../../server/functions/subscription'

interface LoaderData {
  usage: DashboardUsage
  sub: SubscriptionStatus
  catalog: PriceCatalog
}

export const Route = createFileRoute('/dashboard/plans')({
  loader: async (): Promise<LoaderData> => ({
    usage: await getDashboardUsage(),
    sub: await getSubscriptionStatus(),
    catalog: await getPriceCatalog(),
  }),
  component: PlansPage,
  head: () => ({
    meta: [{ title: 'DocPro — Plans' }],
  }),
})

function formatPrice(price: number, tier: string): string {
  if (tier === 'enterprise') return 'Contact Sales'
  return `$${price}`
}

function formatCta(tier: string, planTier: string, busy: boolean, isDowngrade: boolean): string {
  if (tier === planTier) return 'Active'
  if (busy) return '…'
  if (isDowngrade) return 'Locked'
  if (planTier === 'enterprise') return 'Contact Sales'
  if (tier === 'free') return planTier === 'pro' ? 'Upgrade' : 'Choose Business'
  return `Switch to ${planTier.charAt(0).toUpperCase() + planTier.slice(1)}`
}

const TIER_RANK: Record<string, number> = {
  free: 0,
  pro: 1,
  business: 2,
  enterprise: 3,
  custom: 4,
}

function tierRank(tier: string): number {
  return TIER_RANK[tier] ?? 0
}

function PlansPage() {
  const { usage, sub, catalog } = Route.useLoaderData()
  const tier = usage?.tier ?? 'free'
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const activeTier = sub.active ? sub.tier : null
  const activeExpiresAt = sub.active && sub.expiresAt ? new Date(sub.expiresAt) : null

  const isDowngrade = (planTier: string) => {
    if (!activeTier || !activeExpiresAt || activeExpiresAt <= new Date()) return false
    return tierRank(planTier) < tierRank(activeTier)
  }

  const handleSubscribe = async (planTier: string) => {
    if (planTier === 'enterprise') return
    setError(null)
    setBusy(`sub-${planTier}`)
    try {
      await purchaseSubscription({ data: { tier: planTier } })
      router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Subscription failed')
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

  const plans = catalog.plans.length > 0 ? catalog.plans : []
  const topups = catalog.topups.length > 0 ? catalog.topups : []

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

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mx-auto max-w-5xl">
              {plans.map((plan) => {
                const down = isDowngrade(plan.tier)
                return (
                  <PlanCard
                    key={plan.id}
                    name={plan.name}
                    price={formatPrice(plan.price, plan.tier)}
                    note={plan.note ?? ''}
                    features={plan.features.map((f) =>
                      f.toLowerCase().startsWith('everything in') ? `<strong class="text-orange-600">${f}</strong>` : f,
                    )}
                    active={tier === plan.tier}
                    recommended={plan.highlighted}
                    highlight={plan.highlighted}
                    amber={plan.tier === 'enterprise'}
                    cta={formatCta(tier, plan.tier, busy === `sub-${plan.tier}`, down)}
                    onClick={plan.tier !== 'enterprise' && tier !== plan.tier && !down ? () => handleSubscribe(plan.tier) : undefined}
                  />
                )
              })}
            </div>

            {(tier === 'pro' || tier === 'business') && topups.length > 0 && (
              <section>
                <h3 className="text-lg font-extrabold tracking-tight text-[var(--fg)]">Top-Up Token</h3>
                <p className="mt-1 text-sm text-[var(--mutfg)]">Buy additional token balance. Expires 1 month from purchase.</p>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {topups.map((pkg) => (
                    <button
                      key={pkg.id}
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
