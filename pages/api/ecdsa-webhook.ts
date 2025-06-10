import getRawBody from 'raw-body'
import crypto from 'crypto'

export const config = {
  api: { bodyParser: false },
}

function buildPem(base64Key: string): string {
  const lines = base64Key.match(/.{1,64}/g) || []
  return '-----BEGIN PUBLIC KEY-----\n' + lines.join('\n') + '\n-----END PUBLIC KEY-----\n'
}

function verify(header: string | string[] | undefined): boolean {
  const value = Array.isArray(header) ? header[0] : header
  if (!value) return false

  const parts = value.trim().split(/\s+/)
  if (parts.length !== 4 || parts[0] !== 'v1') return false

  const [, timestamp, serial, sigB64] = parts
  const data = `v1 ${timestamp} ${serial}`

  const pubkeyB64 = process.env.SIGNATURE_PUBLIC_KEY || ''
  if (!pubkeyB64) return false
  const pubkeyPem = buildPem(pubkeyB64)

  try {
    const verifier = crypto.createVerify('sha384')
    verifier.update(data)
    verifier.end()
    const signature = Buffer.from(sigB64, 'base64')
    return verifier.verify(pubkeyPem, signature)
  } catch {
    return false
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end()
  }

  console.log('📬 Signed webhook headers:', req.headers)
  const raw = await getRawBody(req, { limit: '1mb' })

  if (!verify(req.headers['signature'])) {
    console.error('❌ Invalid webhook signature')
    return res.status(401).json({ error: 'Invalid signature' })
  }

  let body: any = null
  try {
    body = JSON.parse(raw.toString())
    console.log('📩 Signed webhook payload:', body)
  } catch (err) {
    console.warn('⚠️  Failed to parse JSON body')
  }

  res.status(200).json({ ok: true })
}
