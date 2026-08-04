import nodemailer from 'nodemailer'
import { getRequest } from '@tanstack/react-start/server'

let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT ?? 587)
  const user = process.env.SMTP_USERNAME
  const pass = process.env.SMTP_PASSWORD
  if (!host || !user || !pass) return null
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
  return transporter
}

// Resolve the app's public base URL from the incoming request so the same
// code works in dev (http://localhost:3000) and behind the VPS proxy
// (https://docpro.nexonace.com). Falls back to the production domain.
export function getAppBaseUrl(): string {
  const req = getRequest()
  const host = req?.headers.get('host')
  if (host) {
    const proto = req?.headers.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https')
    return `${proto}://${host}`
  }
  return 'https://docpro.nexonace.com'
}

export interface MailOptions {
  to: string
  subject: string
  text: string
  html: string
}

// Sends an email via SMTP. Returns true when sent, false when SMTP is not
// configured or sending failed (callers should not fail the primary flow).
export async function sendEmail(opts: MailOptions): Promise<boolean> {
  const t = getTransporter()
  if (!t) return false
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || 'DocPro <noreply@docpro.id>',
      ...opts,
    })
    return true
  } catch (e) {
    console.error('[email] sendEmail failed:', e)
    return false
  }
}

const roleLabels: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
}

export function roleLabel(role: string): string {
  return roleLabels[role] ?? role
}
