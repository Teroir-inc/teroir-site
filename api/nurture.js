// wyattworldwide.com/api/nurture: runs one pass of the follow-up emails (api/_nurture.js).
// Called hourly by the server's cron and daily by a Vercel cron as a backstop. Safe to call any number of times:
// each step is sent once (state on the Stripe customer plus a Resend idempotency key) and only when it is due.
// If CRON_SECRET is set in Vercel, the caller must send it (Vercel's cron does so automatically).
const N = require('./_nurture');

module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ ok: false });
  try {
    const counts = await N.run();
    return res.status(200).json({ ok: true, ...counts });
  } catch (e) {
    console.error('nurture run failed', e.message);
    return res.status(500).json({ ok: false });
  }
};
