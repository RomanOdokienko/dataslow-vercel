import { Pool } from 'pg'
import getRawBody from 'raw-body'
import crypto from 'crypto'

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

// Signature verification is temporarily disabled. Enable when deploying to production.
const verifySignature = false

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

    const raw = await getRawBody(req, { limit: '1mb' })

    if (verifySignature) {
      const signatureHeader =
        req.headers['x-yookassa-signature'] || req.headers['authorization']
      const signature = Array.isArray(signatureHeader)
        ? signatureHeader[0]
        : signatureHeader

      if (!signature) {
        console.error('❌ Missing webhook signature')
        return res.status(401).json({ error: 'Signature required' })
      }

      const match = /sha256=(.+)/i.exec(signature.toString())
      const received = match ? match[1] : signature.toString()

      const expected = crypto
        .createHmac('sha256', process.env.YOOKASSA_SECRET || '')
        .update(raw)
        .digest('hex')

      if (received !== expected) {
        console.error('❌ Invalid webhook signature')
        return res.status(401).json({ error: 'Invalid signature' })
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
