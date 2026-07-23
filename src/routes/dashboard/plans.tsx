import { createFileRoute } from '@tanstack/react-router'
import { DashboardHeader } from './index'
import { PlanCard } from '../../components/PlanCard'

export const Route = createFileRoute('/dashboard/plans')({
  component: PlansPage,
  head: () => ({
    meta: [{ title: 'DocPro — Plans' }],
  }),
})

function PlansPage() {
  return (
    <>
      <DashboardHeader />
      <main className="mx-auto w-full max-w-[1200px] flex-1 rounded-2xl bg-[var(--bg-soft)] px-6 py-8">
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mx-auto max-w-5xl">
            <PlanCard name="Free" price="$0" note="Start free, upgrade anytime" footnote="No credit card required<br />Cancel anytime" features={['50 MB Storage', 'AI Capacity (≈ 50k tokens)', 'OCR 50 pages']} cta="Start Free" />
            <PlanCard name="Pro" price="$9" note="For professionals" active={true} features={['1 GB Storage', 'AI Capacity (≈ 5M tokens)', 'AI Chat', 'OCR', 'AI Summary', 'AI Translation', 'Secure Share Links']} cta="Active" />
            <PlanCard name="Business" price="$49" note="For small teams" recommended={true} highlight={true}               features={['<strong class="text-orange-600">Everything in Pro, plus:</strong>', '20 GB Storage', 'AI Capacity (≈ 50M tokens)', 'AI Website Widget', 'Multiple AI Assistants', 'Team Workspace', 'API Access', 'Priority AI Processing']} cta="Choose Business" />
            <PlanCard name="Enterprise" price="Contact Sales" note="For large organizations" amber={true}               features={['<strong class="text-orange-600">Everything in Business, plus:</strong>', 'Private AI Deployment', 'On-Premise', 'SSO', 'White Label', 'Dedicated Success Manager', 'SLA 99.9%']} cta="Contact Sales" />

          </div>
        </section>
      </main>
    </>
  )
}
