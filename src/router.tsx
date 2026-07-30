import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { Sentry } from './lib/sentry'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: () => (
      <div className="grid min-h-screen place-items-center bg-[var(--bg)] text-center">
        <div>
          <h1 className="text-3xl font-extrabold text-[var(--fg)]">404</h1>
          <p className="mt-2 text-sm text-[var(--mutfg)]">Halaman tidak ditemukan.</p>
        </div>
      </div>
    ),
    defaultErrorComponent: ({ error }) => {
      Sentry.captureException(error)
      return (
        <div className="grid min-h-screen place-items-center bg-[var(--bg)] px-4 text-center">
          <div className="max-w-md">
            <h1 className="text-4xl font-extrabold text-[var(--fg)]">Something went wrong</h1>
            <p className="mt-3 text-sm text-[var(--mutfg)]">An unexpected error occurred. Please try again.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
            >
              Reload page
            </button>
          </div>
        </div>
      )
    },
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
