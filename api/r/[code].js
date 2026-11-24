// PAW Protect QR redirect + scan logger.
// GET /r/<code> -> logs the scan (timestamp, code, IP, user agent, geo) to the
// Apps Script sheet-writer, then 302-redirects to the code's destination.
// Env vars: LOG_URL (Apps Script web app /exec URL), DEST_MAP (JSON, code->url),
// DEFAULT_DEST (fallback URL).

export default async function handler(req, res) {
  const { code } = req.query;

  let destMap = {};
  try {
    destMap = JSON.parse(process.env.DEST_MAP || '{}');
  } catch (e) {
    console.error('bad DEST_MAP', e);
  }
  const dest =
    destMap[code] ||
    process.env.DEFAULT_DEST ||
    'https://pierceenergy.org/protected-by';

  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    (req.socket && req.socket.remoteAddress) ||
    '';
  const ua = req.headers['user-agent'] || '';
  const country = req.headers['x-vercel-ip-country'] || '';
  let city = req.headers['x-vercel-ip-city'] || '';
  try {
    city = decodeURIComponent(city);
  } catch (e) { /* keep raw */ }

  const logPayload = {
    ts: new Date().toISOString(),
    code: code || '',
    ip,
    ua,
    country,
    city,
    dest,
  };
  if (process.env.LOG_URL) {
    try {
      await Promise.race([
        fetch(process.env.LOG_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logPayload),
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('log timeout')), 1500)
        ),
      ]);
    } catch (e) {
      console.error('scan log write failed:', e.message);
    }
  }

  res.writeHead(302, { Location: dest });
  res.end();
}
