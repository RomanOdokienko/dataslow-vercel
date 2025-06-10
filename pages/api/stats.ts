import type { NextApiRequest, NextApiResponse } from 'next'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.status(405).end()
    return
  }

  try {
    const { rows } = await pool.query(
      `
      SELECT
        utm_source,
        utm_campaign,
        COUNT(*) AS count,
        SUM(amount) AS total_amount
      FROM
        "DataSlow payments"
      WHERE
        status = 'succeeded'
      GROUP BY
        utm_source, utm_campaign
      ORDER BY
        total_amount DESC;
      `
    )
    res.status(200).json(rows)
  } catch (err) {
    console.error('❌ Stats error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
