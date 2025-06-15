import type { NextApiRequest, NextApiResponse } from 'next'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method !== 'GET') {
    res.status(405).end()
    return
  }

  const { date_filter } = req.query
  const filter = String(date_filter || '').toLowerCase()

  let dateWhere = `TRUE`
  switch (filter) {
    case 'сегодня':
      dateWhere = `DATE(created_at) = CURRENT_DATE`
      break
    case 'вчера':
      dateWhere = `DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'`
      break
    case 'последние 7 дней':
      dateWhere = `created_at >= CURRENT_DATE - INTERVAL '6 days'`
      break
    case 'последние 30 дней':
      dateWhere = `created_at >= CURRENT_DATE - INTERVAL '29 days'`
      break
    case 'с начала месяца':
      dateWhere = `created_at >= date_trunc('month', CURRENT_DATE)`
      break
  }

  try {
    const paymentsQuery = `
      SELECT id, session_id, created_at, amount, utm_source, utm_campaign
      FROM "DataSlow payments"
      WHERE status = 'succeeded' AND ${dateWhere}
    `
    const visitsQuery = `
      SELECT session_id, visited_at, utm_source, utm_campaign
      FROM visits
      WHERE ${dateWhere.replace(/created_at/g, 'visited_at')}
    `

    const [paymentsResult, visitsResult] = await Promise.all([
      pool.query(paymentsQuery),
      pool.query(visitsQuery)
    ])

    res.status(200).json({
      payments: paymentsResult.rows,
      visits: visitsResult.rows
    })
  } catch (err) {
    console.error('❌ Stats error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
