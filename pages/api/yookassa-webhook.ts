import { Pool } from 'pg'
import getRawBody from 'raw-body'
import crypto from 'crypto'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end()
  }

  try {
    const raw = await getRawBody(req)

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

    const body = JSON.parse(raw.toString())

    console.log('📩 Webhook payload:', JSON.stringify(body, null, 2))

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
  } catch (err) {
    console.error('❌ Webhook error:', err)
    res.status(500).json({ error: 'Webhook failed' })
  }
}
