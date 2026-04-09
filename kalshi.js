// api/kalshi.js — Vercel serverless function
// Fetches live Kalshi market data
// Add your Kalshi API key to Vercel environment variables as KALSHI_API_KEY

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=60');

  const apiKey = process.env.KALSHI_API_KEY;

  // Categories relevant to geopolitical/conflict tracking
  const SERIES_TICKERS = [
    'KXIRANUSSTRIKE', 'KXIRANSTRAIT', 'KXGAZACEASEFIRE',
    'KXUAKHARKIV', 'KXCNTAIWAN', 'KXUSTRADE', 'KXFED',
    'KXUATRUMP', 'KXOILPRICE', 'KXSPX', 'KXBTC',
    'KXUSRECESSION', 'KXUKELECTION', 'KXEUELECTION'
  ];

  try {
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    // Fetch markets - public endpoint works without key, key unlocks full data
    const url = 'https://trading-api.kalshi.com/trade-api/v2/markets?limit=200&status=open';
    const r = await fetch(url, { headers });

    if (!r.ok) {
      // Return empty gracefully if Kalshi is unreachable
      return res.status(200).json({ ok: true, markets: [], error: 'Kalshi API unavailable', ts: new Date().toISOString() });
    }

    const json = await r.json();
    const markets = (json.markets || [])
      .filter(m => {
        const title = (m.title || '').toLowerCase();
        const cat = (m.category || '').toLowerCase();
        return (
          cat.includes('geopolitics') ||
          cat.includes('economics') ||
          cat.includes('financials') ||
          cat.includes('politics') ||
          title.includes('iran') ||
          title.includes('ukraine') ||
          title.includes('russia') ||
          title.includes('china') ||
          title.includes('taiwan') ||
          title.includes('israel') ||
          title.includes('oil') ||
          title.includes('fed') ||
          title.includes('tariff') ||
          title.includes('recession') ||
          title.includes('bitcoin') ||
          title.includes('gold') ||
          title.includes('election')
        );
      })
      .map(m => ({
        id:    m.ticker,
        q:     m.title,
        yes:   m.last_price ?? m.yes_bid ?? 50,
        no:    100 - (m.last_price ?? m.yes_bid ?? 50),
        vol:   m.volume ? '$' + (m.volume / 100).toLocaleString() : '—',
        cat:   m.category || 'geo',
        close: m.close_time,
      }));

    res.status(200).json({ ok: true, markets, count: markets.length, ts: new Date().toISOString() });
  } catch (err) {
    res.status(200).json({ ok: true, markets: [], error: err.message, ts: new Date().toISOString() });
  }
}
