import * as SentryReact from '@sentry/react'

export function initClientSentry() {
  const dsn = (import.meta as any).env?.VITE_SENTRY_DSN
  if (!dsn) return

  SentryReact.init({
    dsn,
    environment: (import.meta as any).env?.VITE_SENTRY_ENV ?? 'development',
    integrations: [SentryReact.browserTracingIntegration(), SentryReact.replayIntegration()],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
  })
}

export const Sentry = SentryReact
