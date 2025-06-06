import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ✅ Добавляем CORS-заголовки
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  // ✅ Обработка preflight-запроса от браузера
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method Not Allowed' })
    return
  }

  const { amount, metadata } = req.body

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
