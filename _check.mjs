import { spawn } from 'node:child_process'

const html = spawn('curl', ['-s', 'http://localhost:3000/'], { stdio: ['ignore', 'pipe', 'ignore'] })
let body = ''
html.stdout.on('data', (d) => (body += d))
html.stdout.on('end', async () => {
  const { default: puppeteer } = await import('puppeteer').catch(() => ({}))
  // fallback: use chrome headless directly
  const { execFileSync } = await import('node:child_process')
  const fs = await import('node:fs')
  fs.writeFileSync('/tmp/opencode/page.html', body)
  console.log('saved')
})
