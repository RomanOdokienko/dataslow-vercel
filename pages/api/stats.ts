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
  const filter = String(date_filter || '').toLowerCase()

  let where = status = 'succeeded'
  let groupBy = ''
  let select = ''
  let orderBy = ''

  if (hourly === 'true') {
    let targetDay = 'CURRENT_DATE'
    if (filter === 'вчера') targetDay = CURRENT_DATE - INTERVAL '1 day'

    where +=  AND DATE(created_at) = ${targetDay}
    groupBy = DATE_TRUNC('hour', created_at)
    select = 
      ${groupBy} AS hour,
      COUNT(*) AS count,
      SUM(amount)::numeric(10,2) AS total_amount
    
    orderBy = ORDER BY hour
  }

  else if (daily === 'true') {
    // date range
    let rangeCondition = ''

    switch (filter) {
      case 'сегодня':
        rangeCondition = DATE(created_at) = CURRENT_DATE
        break
      case 'вчера':
        rangeCondition = DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'
        break
      case 'последние 7 дней':
        rangeCondition = created_at >= CURRENT_DATE - INTERVAL '6 days'
        break
      case 'последние 30 дней':
        rangeCondition = created_at >= CURRENT_DATE - INTERVAL '29 days'
        break
      case 'с начала месяца':
        rangeCondition = created_at >= date_trunc('month', CURRENT_DATE)
        break
      default:
        rangeCondition = 'TRUE'
        break
    }

    where +=  AND ${rangeCondition}
    groupBy = DATE(created_at), utm_source, utm_campaign
    select = 
      DATE(created_at) AS date,
      utm_source,
      utm_campaign,
      COUNT(*) AS count,
      SUM(amount)::numeric(10,2) AS total_amount
    
    orderBy = ORDER BY date ASC
  }

  else {
    // default total by utm_source and utm_campaign
    select = 
      utm_source,
      utm_campaign,
      COUNT(*) AS count,
      SUM(amount)::numeric(10,2) AS total_amount
    
    groupBy = utm_source, utm_campaign
    orderBy = ORDER BY total_amount DESC
  }

  try {
    const query = 
      SELECT ${select}
      FROM "DataSlow payments"
      WHERE ${where}
      GROUP BY ${groupBy}
      ${orderBy}
    

    const { rows } = await pool.query(query)
    res.status(200).json(rows)
  } catch (err) {
    console.error('❌ Stats error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
