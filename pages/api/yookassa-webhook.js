
export default async function handler(req, res) {
  if (req.method === 'POST') {
    console.log("📬 Webhook received from Yookassa:", req.body);
    return res.status(200).json({ received: true });
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
