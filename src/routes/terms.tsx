import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/terms')({
  component: Terms,
  head: () => ({
    meta: [{ title: 'DocPro — Terms of Service' }],
  }),
})

function Terms() {
  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8 max-w-3xl mx-auto">
        <p className="island-kicker mb-2">Legal</p>
        <h1 className="display-title mb-3 text-4xl font-bold text-[var(--fg)] sm:text-5xl">
          Terms of Service
        </h1>
        <p className="text-sm text-[var(--mutfg)] mb-8">Last updated: July 2026</p>

        <div className="prose prose-sm dark:prose-invert max-w-none text-[var(--fg-soft)] space-y-6">
          <section>
            <h2 className="text-lg font-bold text-[var(--fg)]">1. Acceptance of Terms</h2>
            <p>
              By accessing or using DocPro ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)]">2. Description of Service</h2>
            <p>
              DocPro provides an AI-powered knowledge platform that allows users to upload documents, extract insights, and deploy knowledge across multiple channels including web widgets, APIs, and messaging platforms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)]">3. User Responsibilities</h2>
            <p>You agree to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide accurate registration information</li>
              <li>Maintain the confidentiality of your account credentials</li>
              <li>Use the Service in compliance with all applicable laws</li>
              <li>Not upload or process illegal, infringing, or harmful content</li>
              <li>Not attempt to reverse-engineer or abuse the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)]">4. Data & Privacy</h2>
            <p>
              Your document content is encrypted at rest (AES-256) and in transit (TLS). DocPro does <strong>not</strong> use your data to train external AI models. We only process your content to provide the Service. See our <a href="/privacy" className="text-blue-600 dark:text-blue-400 underline">Privacy Policy</a> for details.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)]">5. Intellectual Property</h2>
            <p>
              You retain all rights to the documents and content you upload. DocPro claims no ownership over your data. The Service itself, including its software, branding, and infrastructure, is the property of DocPro.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)]">6. Token Usage & Billing</h2>
            <p>
              Usage is measured in tokens. Each plan includes a monthly token allowance. Unused tokens do not roll over. Exceeding your token limit may result in throttling or a plan upgrade requirement. Refunds are handled on a case-by-case basis.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)]">7. Service Availability</h2>
            <p>
              We strive for 99.9% uptime but do not guarantee uninterrupted availability. DocPro is not liable for damages arising from service interruptions, data loss, or unauthorized access beyond our reasonable control.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)]">8. Account Termination</h2>
            <p>
              You may delete your account at any time via the dashboard. Upon account deletion, a 7-day grace period is provided before permanent data erasure. DocPro may suspend or terminate accounts that violate these terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)]">9. Limitation of Liability</h2>
            <p>
              DocPro is provided "as is" without warranties of any kind. To the maximum extent permitted by law, DocPro shall not be liable for any indirect, incidental, or consequential damages.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)]">10. Changes to Terms</h2>
            <p>
              We may update these terms from time to time. Material changes will be notified via email or in-app notice. Continued use after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)]">11. Contact</h2>
            <p>
              For questions about these terms, contact us at <a href="mailto:support@docpro.nexonace.com" className="text-blue-600 dark:text-blue-400 underline">support@docpro.nexonace.com</a>.
            </p>
          </section>
        </div>
      </section>
    </main>
  )
}
