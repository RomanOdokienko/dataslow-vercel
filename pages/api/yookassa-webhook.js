import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const payload = req.body;

    const { amount, status, metadata } = payload.object;
    const { value, currency } = amount;
    const { utm_source, utm_medium, utm_campaign, session_id } = metadata || {};

    try {
      await pool.query(`
        INSERT INTO "DataSlow payments"
        (amount, currency, status, session_id, utm_source, utm_medium, utm_campaign)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [value, currency, status, session_id, utm_source, utm_medium, utm_campaign]);

      console.log('✅ Payment inserted');
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error('❌ DB Insert error', err);
      res.status(500).json({ error: 'DB insert failed' });
    }
  } else {
    res.status(405).end();
  }
}
