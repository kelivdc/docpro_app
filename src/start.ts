import { createCsrfMiddleware, createStart } from '@tanstack/react-start'

export const startInstance = createStart(() => ({
  requestMiddleware: [
    createCsrfMiddleware({
      filter: (ctx) => {
        const url = new URL(ctx.request.url)
        return !url.pathname.startsWith('/api/auth')
      },
    }),
  ],
}))
