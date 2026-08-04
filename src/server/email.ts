import nodemailer from 'nodemailer'

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

export interface MailOptions {
  to: string
  subject: string
  text: string
  html: string
  attachments?: Array<{ filename?: string; content: Buffer; cid: string }>
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
