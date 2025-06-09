import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    [
      'Content-Type',
      'Authorization',
      'X-DS-Session-Id',
      'X-DS-Utm-Source',
      'X-DS-Utm-Medium',
      'X-DS-Utm-Campaign',
      'X-DS-Email',
    ].join(', ')
  )

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method Not Allowed' })
    return
  }

  const { amount } = req.body

  const sanitizedHeaders = { ...req.headers }
  if ('authorization' in sanitizedHeaders) {
    sanitizedHeaders.authorization = '[REDACTED]'
  }
  console.log('↩️ Incoming headers:', JSON.stringify(sanitizedHeaders, null, 2))

  const headers = req.headers as Record<string, string | string[] | undefined>
  const session_id = headers['x-ds-session-id']
  const utm_source = headers['x-ds-utm-source']
  const utm_medium = headers['x-ds-utm-medium']
  const utm_campaign = headers['x-ds-utm-campaign']
  const email = headers['x-ds-email']

  const metadata: Record<string, string> = {}
  if (session_id) metadata.session_id = Array.isArray(session_id) ? session_id[0] : session_id
  if (utm_source) metadata.utm_source = Array.isArray(utm_source) ? utm_source[0] : utm_source
  if (utm_medium) metadata.utm_medium = Array.isArray(utm_medium) ? utm_medium[0] : utm_medium
  if (utm_campaign) metadata.utm_campaign = Array.isArray(utm_campaign) ? utm_campaign[0] : utm_campaign
  if (email) metadata.email = Array.isArray(email) ? email[0] : email

  try {
    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${process.env.YOOKASSA_SHOP_ID}:${process.env.YOOKASSA_SECRET}`).toString('base64'),
        'Content-Type': 'application/json',
        'Idempotence-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        amount: {
          value: amount,
          currency: 'RUB',
        },
        confirmation: {
          type: 'redirect',
          return_url: 'https://lovabl-word-wonderland.lovable.app/success',
        },
        capture: true,
        description: 'Оплата через DataSlow',
        metadata,
      }),
    })

    const data = await response.json()
    if (data.confirmation?.confirmation_url) {
      res.status(200).json({ confirmation_url: data.confirmation.confirmation_url })
    } else {
      res.status(400).json({ message: 'Ошибка создания платежа', details: data })
    }
  } catch (error) {
    res.status(500).json({ message: 'Серверная ошибка', error })
  }
}
