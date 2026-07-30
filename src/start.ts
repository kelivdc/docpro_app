import { createCsrfMiddleware, createIsomorphicFn, createStart } from '@tanstack/react-start'

createIsomorphicFn()
  .server(async () => {
    const { init } = await import('@sentry/node')
    const dsn = process.env.VITE_SENTRY_DSN
    if (dsn) {
      init({
        dsn,
        environment: process.env.VITE_SENTRY_ENV ?? 'development',
        tracesSampleRate: 1.0,
      })
    }
  })
  .client(() => {})()

export const startInstance = createStart(() => ({
  requestMiddleware: [
    createCsrfMiddleware({
      filter: () => false,
      allowRequestsWithoutOriginCheck: true,
    }),
  ],
}))
