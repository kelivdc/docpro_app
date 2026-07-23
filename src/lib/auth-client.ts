import { createAuthClient } from 'better-auth/react'
import { organizationClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  baseURL: '',
  plugins: [organizationClient()],
})

export const { signIn, signUp, signOut, useSession, requestPasswordReset } =
  authClient as unknown as {
    signIn: typeof authClient.signIn
    signUp: typeof authClient.signUp
    signOut: typeof authClient.signOut
    useSession: typeof authClient.useSession
    requestPasswordReset: (opts: {
      email: string
      redirectTo?: string
    }) => Promise<{ error?: { message?: string } | null }>
  }
