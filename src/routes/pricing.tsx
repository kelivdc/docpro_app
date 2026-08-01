import { createFileRoute } from '@tanstack/react-router'
import { PlanCard } from '../components/PlanCard'
import { getPriceCatalog } from '../server/functions/subscription'

export const Route = createFileRoute('/pricing')({
  loader: async () => ({ catalog: await getPriceCatalog() }),
  component: Pricing,
  head: () => ({
    meta: [{ title: 'DocPro — Pricing' }],
  }),
})

function formatPrice(price: number, tier: string): string {
  if (tier === 'enterprise') return 'Contact Sales'
  return `$${price}`
}

function Pricing() {
  const { catalog } = Route.useLoaderData()
  const plans = catalog.plans

  return (
    <main className="flex-1 px-6 py-12">
      <section className="mx-auto max-w-[1200px] space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-[var(--fg)] sm:text-5xl">
            Get Started Today
          </h1>
          <p className="mt-2 text-base text-[var(--fg-soft)]">
            Choose the right plan for your team.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mx-auto max-w-5xl">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              name={plan.name}
              price={formatPrice(plan.price, plan.tier)}
              note={plan.note ?? ''}
              features={plan.features.map((f) =>
                f.toLowerCase().startsWith('everything in') ? `<strong class="text-orange-600">${f}</strong>` : f,
              )}
              recommended={plan.highlighted}
              highlight={plan.highlighted}
              amber={plan.tier === 'enterprise'}
              cta={plan.tier === 'enterprise' ? 'Contact Sales' : `Choose ${plan.name}`}
              ctaOrange
            />
          ))}
        </div>

        {catalog.topups.length > 0 && (
          <section className="mx-auto max-w-5xl space-y-4 pt-8">
            <div className="text-center">
              <h2 className="text-2xl font-extrabold tracking-tight text-[var(--fg)]">Token Top-Up</h2>
              <p className="mt-1 text-sm text-[var(--fg-soft)]">
                Buy additional AI tokens. Available for Pro &amp; Business plans. Expires 1 month from purchase.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {catalog.topups.map((pkg) => (
                <div
                  key={pkg.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4 text-center shadow-sm transition-all hover:border-[var(--primary)] hover:shadow-md"
                >
                  <div className="text-2xl font-extrabold text-[var(--fg)]">{(pkg.tokens / 1_000_000).toFixed(0)}M</div>
                  <div className="mt-1 text-xs text-[var(--mutfg)]">tokens</div>
                  <div className="mt-3 text-lg font-bold text-[var(--primary)]">${pkg.price}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  )
}
