// api/prices.js — Vercel serverless function
// Fetches live market prices from Yahoo Finance and returns JSON
// Deploy to Vercel — this runs server-side, no CORS issues

const SYMBOLS = {
  WTI:    'CL=F',
  Brent:  'BZ=F',
  NatGas: 'NG=F',
  Gold:   'GC=F',
  Silver: 'SI=F',
  SPX:    '^GSPC',
  NDQ:    '^NDX',
  VIX:    '^VIX',
  DXY:    'DX-Y.NYB',
  T10Y:   '^TNX',
  EURUSD: 'EURUSD=X',
  BTC:    'BTC-USD',
  ITA:    'ITA',
  RTX:    'RTX',
  LMT:    'LMT',
  Wheat:  'ZW=F',
  Uranium:'URA',
};

async function fetchYahooQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=35d`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
  });
  if (!res.ok) return null;
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) return null;
  const closes = result.indicators.quote[0].close;
  const timestamps = result.timestamp;
  const series = timestamps
    .map((ts, i) => ({ date: new Date(ts * 1000).toISOString().slice(0, 10), close: closes[i] }))
    .filter(d => d.close !== null && !isNaN(d.close));
  const latest = series[series.length - 1];
  const prev   = series[series.length - 2];
  return {
    symbol,
    price:  latest?.close ?? null,
    prev:   prev?.close ?? null,
    change: latest && prev ? ((latest.close - prev.close) / prev.close) * 100 : null,
    series: series.slice(-30).map(d => ({ d: d.date.slice(5), c: +d.close.toFixed(4) })),
  };
}

export default async function handler(req, res) {
  // CORS headers — allow your GitHub Pages domain
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60'); // cache 5 mins

  try {
    const results = {};
    await Promise.all(
      Object.entries(SYMBOLS).map(async ([key, sym]) => {
        results[key] = await fetchYahooQuote(sym);
      })
    );
    res.status(200).json({ ok: true, data: results, ts: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
