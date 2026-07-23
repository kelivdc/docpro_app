import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

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
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
