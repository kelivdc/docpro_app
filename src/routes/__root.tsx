import { useEffect } from 'react'
import { HeadContent, Scripts, createRootRoute, useLocation } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import Footer from '../components/Footer'
import Header from '../components/Header'
import { Sentry, initClientSentry } from '../lib/sentry'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'DocPro',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'icon',
        href: '/favicon.ico',
        sizes: 'any',
      },
      {
        rel: 'icon',
        type: 'image/png',
        href: '/favicon-16x16.png',
        sizes: '16x16',
      },
      {
        rel: 'icon',
        type: 'image/png',
        href: '/favicon-32x32.png',
        sizes: '32x32',
      },
      {
        rel: 'apple-touch-icon',
        href: '/apple-touch-icon.png',
      },
      {
        rel: 'manifest',
        href: '/site.webmanifest',
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const path = location.pathname
  const showChrome =
    path !== '/login' &&
    path !== '/register' &&
    path !== '/forgot-password' &&
    !path.startsWith('/dashboard')

  useEffect(() => { initClientSentry() }, [])

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script>{`(function(){try{var t=localStorage.getItem('docpro-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch(e){}})()`}</script>
        <HeadContent />
      </head>
      <body className="font-sans antialiased [overflow-wrap:anywhere] selection:bg-[rgba(79,184,178,0.24)]">
        <Sentry.ErrorBoundary fallback={({ error }) => {
          Sentry.captureException(error)
          return (
            <div className="grid min-h-screen place-items-center bg-[var(--bg)] px-4 text-center">
              <div className="max-w-md">
                <h1 className="text-3xl font-extrabold text-[var(--fg)]">Something went wrong</h1>
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
        }}>
          {showChrome && <Header />}
          {children}
          {showChrome && <Footer />}
        </Sentry.ErrorBoundary>
        <Scripts />
      </body>
    </html>
  )
}
