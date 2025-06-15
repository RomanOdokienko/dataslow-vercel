import type { NextApiRequest, NextApiResponse } from 'next'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const {
    session_id,
    utm_source,
    utm_medium,
    utm_campaign,
    referrer,
    page_url,
    geo_country,
  } = req.body

  try {
    await pool.query(
      `
      INSERT INTO visits (
        session_id,
        visited_at,
        utm_source,
        utm_medium,
        utm_campaign,
        referrer,
        page_url,
        ip,
        user_agent,
        geo_country
      ) VALUES (
        $1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9
      )
      `,
      [
        session_id,
        utm_source,
        utm_medium,
        utm_campaign,
        referrer,
        page_url,
        req.headers['x-real-ip'] || req.socket.remoteAddress,
        req.headers['user-agent'] || null,
        geo_country || null,
      ]
    )

    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('log-visit error:', err)
    res.status(500).json({ error: 'DB error' })
  }
}
