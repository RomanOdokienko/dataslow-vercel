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

  let { daily, hourly, date_filter } = req.query
  const dailyFlag = daily === 'true'
  const hourlyFlag = hourly === 'true'

  if (!dailyFlag && !hourlyFlag) {
    if (daily === undefined && hourly === undefined) {
      daily = 'true'
    } else {
      res.status(400).json({ error: 'Invalid parameters' })
      return
    }
  }

  const filter = String(date_filter || '').toLowerCase()

  let dateWhere = `TRUE`
  let groupByExpr = ''
  let label = ''
  let orderBy = ''

  if (hourly === 'true') {
    let targetDay = 'CURRENT_DATE'
    if (filter === 'вчера' || filter === 'yesterday') targetDay = `CURRENT_DATE - INTERVAL '1 day'`
    dateWhere = `DATE(created_at) = ${targetDay}`
    groupByExpr = `DATE_TRUNC('hour', created_at)`
    label = 'hour'
    orderBy = `ORDER BY ${label}`
  } else if (daily === 'true') {
    switch (filter) {
      case 'сегодня':
      case 'today':
        dateWhere = `DATE(created_at) = CURRENT_DATE`
        break
      case 'вчера':
      case 'yesterday':
        dateWhere = `DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'`
        break
      case 'последние 7 дней':
      case 'last_7_days':
        dateWhere = `created_at >= CURRENT_DATE - INTERVAL '6 days'`
        break
      case 'последние 30 дней':
      case 'last_30_days':
        dateWhere = `created_at >= CURRENT_DATE - INTERVAL '29 days'`
        break
      case 'с начала месяца':
      case 'this_month':
        dateWhere = `created_at >= date_trunc('month', CURRENT_DATE)`
        break
    }
    groupByExpr = `DATE(created_at)`
    label = 'date'
    orderBy = `ORDER BY ${label}`
  }

  try {
    const query = `
      WITH visitors_union AS (
        SELECT ${groupByExpr} AS period, session_id FROM visits WHERE ${dateWhere}
        UNION
        SELECT ${groupByExpr} AS period, session_id FROM "DataSlow payments" WHERE status = 'succeeded' AND ${dateWhere}
      ),
      agg_visitors AS (
        SELECT period, COUNT(DISTINCT session_id) AS visitors FROM visitors_union GROUP BY period
      ),
      payments_data AS (
        SELECT ${groupByExpr} AS period,
               COUNT(*) AS payments_count,
               SUM(amount)::numeric(10,2) AS revenue
        FROM "DataSlow payments"
        WHERE status = 'succeeded' AND ${dateWhere}
        GROUP BY period
      )
      SELECT
        COALESCE(agg_visitors.period, payments_data.period) AS ${label},
        COALESCE(agg_visitors.visitors, 0) AS visitors,
        COALESCE(payments_data.payments_count, 0) AS payments_count,
        COALESCE(payments_data.revenue, 0) AS revenue
      FROM agg_visitors
      FULL OUTER JOIN payments_data ON agg_visitors.period = payments_data.period
      ${orderBy}
    `

    const { rows } = await pool.query(query)

    const visitsCountCheckQuery = `SELECT COUNT(*) AS visits_count_check FROM visits WHERE ${dateWhere}`
    const { rows: visitsCheckRows } = await pool.query(visitsCountCheckQuery)
    const visits_count_check = visitsCheckRows[0]?.visits_count_check || 0

    res.status(200).json({ data: rows, visits_count_check })
  } catch (err) {
    console.error('❌ Stats error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
