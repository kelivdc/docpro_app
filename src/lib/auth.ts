import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { organization } from 'better-auth/plugins'
import { db } from './db'
import * as schema from './schema'

export const auth = betterAuth({
  trustedOrigins: ['https://docpro.nexonace.com', 'http://localhost', 'http://localhost:3000'],
  baseURL: {
    allowedHosts: ['localhost', 'localhost:3000', 'docpro.nexonace.com'],
    fallback: 'https://docpro.nexonace.com',
  },
  advanced: {
    ipAddress: {
      ipAddressHeaders: ['x-forwarded-for'],
      trustedProxies: ['127.0.0.1'],
    },
  },
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    async sendResetPassword({ user, url }: { user: { email: string; name?: string }; url: string }) {
      const { sendEmail } = await import('../server/email')
      await sendEmail({
        to: user.email,
        subject: 'Reset your DocPro password',
        text: `Hi ${user.name || ''},\n\nWe received a request to reset your DocPro password. Click the link below to set a new password:\n\n${url}\n\nThis link expires in 1 hour.\n\nIf you didn't request a password reset, you can ignore this email.`,
        html: `
          <div style="background:#f6f7f9;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
            <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eceef2;">
              <div style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:24px 28px;">
                <div style="color:#ffffff;font-size:20px;font-weight:800;">DocPro</div>
              </div>
              <div style="padding:28px;">
                <h1 style="margin:0 0 10px;font-size:20px;color:#111827;">Reset your password</h1>
                <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4b5563;">
                  Hi ${user.name || ''},<br/>We received a request to reset your DocPro password. Click the button below to choose a new password.
                </p>
                <a href="${url}" style="display:inline-block;background:#2563eb;color:#ffffff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none;">Reset Password</a>
                <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">This link expires in 1 hour. If you didn't request a password reset, you can ignore this email.</p>
              </div>
            </div>
          </div>
        `,
      })
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      const { sendEmail } = await import('../server/email')
      await sendEmail({
        to: user.email,
        subject: 'Verify your DocPro email',
        text: `Hi ${user.name || ''},\n\nPlease verify your email address by clicking this link:\n\n${url}\n\nThis link expires in 24 hours.\n\nIf you did not create a DocPro account, you can ignore this email.`,
        html: `
          <div style="background:#f6f7f9;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
            <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eceef2;">
              <div style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:24px 28px;">
                <div style="color:#ffffff;font-size:20px;font-weight:800;">DocPro</div>
              </div>
              <div style="padding:28px;">
                <h1 style="margin:0 0 10px;font-size:20px;color:#111827;">Verify your email</h1>
                <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4b5563;">
                  Hi ${user.name || ''},<br/>Thanks for signing up. Click the button below to verify your email address and start using DocPro.
                </p>
                <a href="${url}" style="display:inline-block;background:#2563eb;color:#ffffff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none;">Verify Email Address</a>
                <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">This link expires in 24 hours. If you didn't create a DocPro account, you can ignore this email.</p>
              </div>
            </div>
          </div>
        `,
      })
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      enabled: Boolean(process.env.GOOGLE_CLIENT_ID),
      redirectURI: process.env.GOOGLE_REDIRECT_URI,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 hari
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
    }),
  ],
})

export type Auth = typeof auth
