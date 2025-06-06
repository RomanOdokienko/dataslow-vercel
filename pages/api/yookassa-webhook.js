import { buffer } from 'micro'
import { Pool } from 'pg'

// Отключаем bodyParser для работы с raw JSON
export const config = {
  api: {
    bodyParser: false,
  },
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end()
  }

  try {
    const buf = await buffer(req)
    const payload = JSON.parse(buf.toString())

    const { amount, status, metadata } = payload.object || {}
    const { value, currency } = amount || {}
    const {
      utm_source = null,
      utm_medium = null,
      utm_campaign = null,
      session_id = null,
    } = metadata || {}

    // Лог для отладки
    console.log('🧾 Webhook received:', { value, currency, status, metadata })

    await pool.query(
      `
      INSERT INTO "DataSlow payments"
      (amount, currency, status, session_id, utm_source, utm_medium, utm_campaign)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [value, currency, status, session_id, utm_source, utm_medium, utm_campaign]
    )

    console.log('✅ Payment inserted')
    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('❌ Webhook error:', err)
    res.status(500).json({ error: 'internal error' })
  }
}
