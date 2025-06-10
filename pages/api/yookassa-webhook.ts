import { Pool } from 'pg'
import getRawBody from 'raw-body'
import crypto from 'crypto'

function buildPem(base64Key: string): string {
  const lines = base64Key.match(/.{1,64}/g) || []
  return (
    '-----BEGIN PUBLIC KEY-----\n' +
    lines.join('\n') +
    '\n-----END PUBLIC KEY-----\n'
  )
}

function logPayment(prefix: string, body: any) {
  const info = {
    id: body?.object?.id,
    status: body?.object?.status,
    amount: body?.object?.amount?.value,
  }
  console.log(prefix, info)
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// YooKassa signs webhooks even in the test environment. Signature verification
// can be disabled by setting VERIFY_SIGNATURE=false.
const verifySignature = process.env.VERIFY_SIGNATURE !== 'false'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end()
  }

  let body: any = null
  try {

    console.log('📬 Webhook headers:', req.headers)

    const raw = await getRawBody(req, { limit: '1mb' })

    if (verifySignature) {
      const header = req.headers['signature'] || (req.headers as any)['Signature']
      const headerValue = Array.isArray(header) ? header[0] : header
      if (!headerValue) {
        console.error('❌ Missing Signature header')
        return res.status(400).send('Missing Signature header')
      }

      const [version, timestamp, serial, signature] = headerValue.split(' ')
      const idempotenceKey = req.headers['idempotence-key'] || ''
      const httpMethod = req.method
      const fullUrl = `https://${req.headers.host}${req.url}`

      const dataToVerify = [
        timestamp,
        httpMethod,
        fullUrl,
        '',
        idempotenceKey,
        raw.toString('utf-8'),
      ].join('\n')

      const keyB64 = process.env.YOOKASSA_PUBLIC_KEY || ''
      if (!keyB64) {
        console.error('❌ Missing YOOKASSA_PUBLIC_KEY environment variable')
        return res.status(500).send('Server misconfiguration')
      }
      const publicKey = buildPem(keyB64)

      const verifier = crypto.createVerify('sha384')
      verifier.update(dataToVerify)
      verifier.end()

      const isValid = verifier.verify(publicKey, Buffer.from(signature, 'base64'))

      if (!isValid) {
        console.error('❌ Invalid signature')
        return res.status(400).send('Invalid signature')
      }
    } else {
      console.log('⚠️  Skipping YooKassa signature verification')
    }


    body = JSON.parse(raw.toString())


    logPayment('📩 Webhook payload:', body)

    const { amount, status, metadata } = body.object || {}
    const { value, currency } = amount || {}
    const {
      session_id = null,
      utm_source = null,
      utm_medium = null,
      utm_campaign = null,
      email = null
    } = metadata || {}

    await pool.query(
      `
      INSERT INTO "DataSlow payments"
      (amount, currency, status, session_id, utm_source, utm_medium, utm_campaign, email)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [value, currency, status, session_id, utm_source, utm_medium, utm_campaign, email]
    )

    console.log('✅ Payment inserted')
    res.status(200).json({ ok: true })

} catch (err: any) {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large' })
  }
  console.error('❌ Webhook error:', err)
  logPayment('❌ Webhook error:', body)
  res.status(500).json({ error: 'Webhook failed' })
}
}

