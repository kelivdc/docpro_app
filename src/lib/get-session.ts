import { createServerFn } from '@tanstack/react-start'
import { auth } from './auth'
import { getRequest } from '@tanstack/react-start/server'

export const getSessionFromServer = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await auth.api.getSession({
      headers: getRequest()?.headers,
    })
    return session
  },
)
