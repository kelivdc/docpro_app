import { createFileRoute } from '@tanstack/react-router'
import { PlanCard } from '../components/PlanCard'

export const Route = createFileRoute('/pricing')({
  component: Pricing,
  head: () => ({
    meta: [{ title: 'DocPro — Pricing' }],
  }),
})

function Pricing() {
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
            <PlanCard name="Free" price="$0" note="Start free, upgrade anytime" footnote="No credit card required<br />Cancel anytime" features={['50 MB Storage', 'AI Capacity (≈ 50k tokens)', 'OCR 50 pages']} cta="Start Free" ctaOrange />
            <PlanCard name="Pro" price="$9" note="For professionals" features={['1 GB Storage', 'AI Capacity (≈ 5M tokens)', 'AI Chat', 'OCR', 'AI Summary', 'AI Translation', 'Secure Share Links']} cta="Choose Pro" ctaOrange />
            <PlanCard name="Business" price="$49" note="For small teams" recommended={true} highlight={true}               features={['<strong class="text-orange-600">Everything in Pro, plus:</strong>', '20 GB Storage', 'AI Capacity (≈ 50M tokens)', 'AI Website Widget', 'Multiple AI Assistants', 'Team Workspace', 'API Access', 'Priority AI Processing']} cta="Choose Business" ctaOrange />
            <PlanCard name="Enterprise" price="Contact Sales" note="For large organizations" amber={true}               features={['<strong class="text-orange-600">Everything in Business, plus:</strong>', 'Private AI Deployment', 'On-Premise', 'SSO', 'White Label', 'Dedicated Success Manager', 'SLA 99.9%']} cta="Contact Sales" ctaOrange />

          </div>
        </section>
      </main>
  )
}
