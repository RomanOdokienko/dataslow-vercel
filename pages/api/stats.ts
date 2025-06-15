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

  const { daily, hourly, date_filter } = req.query
  const dailyFlag = daily === 'true'
  const hourlyFlag = hourly === 'true'

  const filter = String(date_filter || '').toLowerCase()

  let visitsDateWhere = `TRUE`
  let paymentsDateWhere = `TRUE`

  if (hourlyFlag) {
    let targetDay = 'CURRENT_DATE'
    if (filter === 'вчера' || filter === 'yesterday')
      targetDay = `CURRENT_DATE - INTERVAL '1 day'`
    visitsDateWhere = `DATE(visited_at) = ${targetDay}`
    paymentsDateWhere = `DATE(created_at) = ${targetDay}`
  } else {
    switch (filter) {
      case 'сегодня':
      case 'today':
        visitsDateWhere = `DATE(visited_at) = CURRENT_DATE`
        paymentsDateWhere = `DATE(created_at) = CURRENT_DATE`
        break
      case 'вчера':
      case 'yesterday':
        visitsDateWhere = `DATE(visited_at) = CURRENT_DATE - INTERVAL '1 day'`
        paymentsDateWhere = `DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'`
        break
      case 'последние 7 дней':
      case 'last_7_days':
        visitsDateWhere = `visited_at >= CURRENT_DATE - INTERVAL '6 days'`
        paymentsDateWhere = `created_at >= CURRENT_DATE - INTERVAL '6 days'`
        break
      case 'последние 30 дней':
      case 'last_30_days':
        visitsDateWhere = `visited_at >= CURRENT_DATE - INTERVAL '29 days'`
        paymentsDateWhere = `created_at >= CURRENT_DATE - INTERVAL '29 days'`
        break
      case 'с начала месяца':
      case 'this_month':
        visitsDateWhere = `visited_at >= date_trunc('month', CURRENT_DATE)`
        paymentsDateWhere = `created_at >= date_trunc('month', CURRENT_DATE)`
        break
    }
  }

  if (!dailyFlag && !hourlyFlag) {
    try {
      const utmQuery = `
        SELECT
          COALESCE(utm_source, '') AS utm_source,
          COUNT(*) AS payments_count,
          SUM(amount)::numeric(10,2) AS revenue
        FROM "DataSlow payments"
        WHERE status = 'succeeded' AND ${paymentsDateWhere}
        GROUP BY COALESCE(utm_source, '')
        ORDER BY revenue DESC
      `
      const { rows } = await pool.query(utmQuery)
      res.status(200).json({ data: rows })
    } catch (err) {
      console.error('❌ Stats UTM error:', err)
      res.status(500).json({ error: 'Internal server error' })
    }
    return
  }

  let visitsGroupBy = ''
  let paymentsGroupBy = ''
  let label = ''
  let orderBy = ''

  if (hourlyFlag) {
    visitsGroupBy = `DATE_TRUNC('hour', visited_at)`
    paymentsGroupBy = `DATE_TRUNC('hour', created_at)`
    label = 'hour'
    orderBy = `ORDER BY ${label}`
  } else if (dailyFlag) {
    visitsGroupBy = `DATE(visited_at)`
    paymentsGroupBy = `DATE(created_at)`
    label = 'date'
    orderBy = `ORDER BY ${label}`
  }

  try {
    const query = `
      WITH visitors_union AS (
        SELECT ${visitsGroupBy} AS period, session_id FROM visits WHERE ${visitsDateWhere}
        UNION
        SELECT ${paymentsGroupBy} AS period, session_id FROM "DataSlow payments" WHERE status = 'succeeded' AND ${paymentsDateWhere}
      ),
      agg_visitors AS (
        SELECT period, COUNT(DISTINCT session_id) AS visitors FROM visitors_union GROUP BY period
      ),
      payments_data AS (
        SELECT ${paymentsGroupBy} AS period,
               COUNT(*) AS payments_count,
               SUM(amount)::numeric(10,2) AS revenue
        FROM "DataSlow payments"
        WHERE status = 'succeeded' AND ${paymentsDateWhere}
        GROUP BY period
      ),
      session_duration_data AS (
        SELECT ${visitsGroupBy} AS period,
               AVG(session_duration_seconds)::numeric(10,2) AS avg_session_duration
        FROM visits
        WHERE ${visitsDateWhere}
          AND session_duration_seconds IS NOT NULL
          AND session_duration_seconds > 0
        GROUP BY period
      )
      SELECT
        COALESCE(agg_visitors.period, payments_data.period, session_duration_data.period) AS ${label},
        COALESCE(agg_visitors.visitors, 0) AS visitors,
        COALESCE(payments_data.payments_count, 0) AS payments_count,
        COALESCE(payments_data.revenue, 0) AS revenue,
        COALESCE(session_duration_data.avg_session_duration, 0) AS avg_session_duration
      FROM agg_visitors
      FULL OUTER JOIN payments_data ON agg_visitors.period = payments_data.period
      FULL OUTER JOIN session_duration_data ON COALESCE(agg_visitors.period, payments_data.period) = session_duration_data.period
      ${orderBy}
    `

    const { rows } = await pool.query(query)

    const visits_count = rows.length

    const visitsCountCheckQuery = `SELECT COUNT(*) AS visits_count_check FROM visits WHERE ${visitsDateWhere}`
    const { rows: visitsCheckRows } = await pool.query(visitsCountCheckQuery)
    const visits_count_check = visitsCheckRows[0]?.visits_count_check || 0

    const totalVisitorsQuery = `SELECT COUNT(DISTINCT session_id) AS total_visitors FROM visits WHERE ${visitsDateWhere}`
    const { rows: totalVisitorsRows } = await pool.query(totalVisitorsQuery)
    const total_visitors = totalVisitorsRows[0]?.total_visitors || 0

    const totalPaymentsQuery = `
      SELECT COUNT(*) AS total_payments,
             COALESCE(SUM(amount), 0)::numeric(10,2) AS total_revenue
      FROM "DataSlow payments"
      WHERE status = 'succeeded' AND ${paymentsDateWhere}
    `
    const { rows: totalPaymentsRows } = await pool.query(totalPaymentsQuery)
    const total_payments = totalPaymentsRows[0]?.total_payments || 0
    const total_revenue = totalPaymentsRows[0]?.total_revenue || 0

    const avgSessionDurationQuery = `
      SELECT AVG(session_duration_seconds)::numeric(10,2) AS avg_session_duration
      FROM visits
      WHERE ${visitsDateWhere}
        AND session_duration_seconds IS NOT NULL
        AND session_duration_seconds > 0
    `
    const { rows: avgSessionRows } = await pool.query(avgSessionDurationQuery)
    const avg_session_duration = avgSessionRows[0]?.avg_session_duration || 0

    res.status(200).json({
      total_visitors,
      total_payments,
      total_revenue,
      avg_session_duration,
      data: rows,
      visits_count,
      visits_count_check,
    })
  } catch (err) {
    console.error('❌ Stats error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
