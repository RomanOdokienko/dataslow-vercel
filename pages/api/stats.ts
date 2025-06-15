import type { NextApiRequest, NextApiResponse } from 'next'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).end()
    return
  }

  try {
    const daily = req.query.daily === 'true'
    const dateFilter = req.query.date_filter

    let dateWhereClause = 'TRUE'

    if (dateFilter === 'Сегодня') {
      dateWhereClause = `created_at::date = CURRENT_DATE`
    } else if (dateFilter === 'Вчера') {
      dateWhereClause = `created_at::date = CURRENT_DATE - INTERVAL '1 day'`
    } else if (dateFilter === 'Последние 7 дней') {
      dateWhereClause = `created_at >= CURRENT_DATE - INTERVAL '7 days'`
    } else if (dateFilter === 'Последние 30 дней') {
      dateWhereClause = `created_at >= CURRENT_DATE - INTERVAL '30 days'`
    } else if (dateFilter === 'С начала месяца') {
      dateWhereClause = `created_at >= date_trunc('month', CURRENT_DATE)`
    } else if (dateFilter === 'Все время') {
      dateWhereClause = 'TRUE'
    }

    const query = daily
      ? `
        SELECT
          DATE(created_at) AS date,
          utm_source,
          utm_campaign,
          COUNT(*) AS count,
          SUM(amount) AS total_amount
        FROM "DataSlow payments"
        WHERE status = 'succeeded' AND ${dateWhereClause}
        GROUP BY date, utm_source, utm_campaign
        ORDER BY date ASC;
      `
      : `
        SELECT
          utm_source,
          utm_campaign,
          COUNT(*) AS count,
          SUM(amount) AS total_amount
        FROM "DataSlow payments"
        WHERE status = 'succeeded' AND ${dateWhereClause}
        GROUP BY utm_source, utm_campaign
        ORDER BY total_amount DESC;
      `

    console.log('📦 Executing SQL:\n', query)

    const { rows } = await pool.query(query)

    console.log('📤 First result row:', rows?.[0])

    res.status(200).json(rows)
  } catch (err) {
    console.error('❌ Stats error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
