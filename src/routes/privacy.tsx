import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/privacy')({
  component: Privacy,
  head: () => ({
    meta: [{ title: 'DocPro — Privacy Policy' }],
  }),
})

function Privacy() {
  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8 max-w-3xl mx-auto">
        <p className="island-kicker mb-2">Legal</p>
        <h1 className="display-title mb-3 text-4xl font-bold text-[var(--fg)] sm:text-5xl">
          Privacy Policy
        </h1>
        <p className="text-sm text-[var(--mutfg)] mb-8">Last updated: July 2026</p>

        <div className="prose prose-sm dark:prose-invert max-w-none text-[var(--fg-soft)] space-y-6">
          <section>
            <h2 className="text-lg font-bold text-[var(--fg)]">1. Information We Collect</h2>
            <p>We collect the following information to provide and improve the Service:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account information:</strong> name, email address, and authentication credentials</li>
              <li><strong>Document content:</strong> files you upload for knowledge processing</li>
              <li><strong>Usage data:</strong> chat queries, token usage, and feature interactions</li>
              <li><strong>Technical data:</strong> browser type, IP address, device information</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)]">2. How We Use Your Data</h2>
            <p>Your data is used exclusively to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Process and index your documents for AI-powered retrieval</li>
              <li>Generate answers based on your knowledge base</li>
              <li>Improve the accuracy and performance of the Service</li>
              <li>Communicate account-related updates and support</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)]">3. Data Storage & Security</h2>
            <p>
              All document content is encrypted at rest using AES-256 and in transit using TLS 1.3. We use industry-standard cloud infrastructure (AWS/GCP) with strict access controls. Backups are encrypted and retained for disaster recovery purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)]">4. AI Training</h2>
            <p>
              DocPro <strong>does not</strong> use your document content or chat queries to train external or public AI models. Your data remains private to your account. Only anonymized, aggregated usage statistics may be used for internal service improvements.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)]">5. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active. When you delete your account, a 7-day grace period is provided during which you may cancel the deletion. After 7 days, all documents, chat history, and personal data are permanently and irreversibly deleted.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)]">6. Third-Party Services</h2>
            <p>
              DocPro may use third-party services for infrastructure (cloud hosting, vector databases, LLM providers). These providers are contractually bound to process data only on our instructions and maintain equivalent security standards. We do not sell your data to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)]">7. Your Rights</h2>
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Request correction or deletion of your data</li>
              <li>Object to or restrict processing</li>
              <li>Data portability</li>
              <li>Withdraw consent at any time</li>
            </ul>
            <p className="mt-3">To exercise these rights, contact <a href="mailto:support@docpro.nexonace.com" className="text-blue-600 dark:text-blue-400 underline">support@docpro.nexonace.com</a>.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)]">8. Cookies</h2>
            <p>
              We use essential cookies for authentication and session management. No tracking or advertising cookies are used. You can control cookie settings through your browser preferences.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)]">9. Policy Updates</h2>
            <p>
              We may update this policy periodically. Material changes will be communicated via email or in-app notification. Continued use after updates constitutes acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--fg)]">10. Contact</h2>
            <p>
              For privacy-related inquiries, contact:<br />
              Email: <a href="mailto:support@docpro.nexonace.com" className="text-blue-600 dark:text-blue-400 underline">support@docpro.nexonace.com</a>
            </p>
          </section>
        </div>
      </section>
    </main>
  )
}
