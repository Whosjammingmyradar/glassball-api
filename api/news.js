// api/news.js — Vercel serverless function
// Fetches live geopolitical news from GNews API
// Add GNEWS_API_KEY to Vercel environment variables
// Free tier: 100 requests/day — enough for auto-refresh every 15 mins

const GEO_QUERIES = [
  'Iran conflict military',
  'Ukraine Russia war',
  'China Taiwan military',
  'Israel Gaza ceasefire',
  'Houthi Red Sea attack',
  'North Korea missile',
  'US sanctions geopolitical',
  'OPEC oil supply',
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=300'); // cache 15 mins

  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ ok: false, articles: [], error: 'GNEWS_API_KEY not set in Vercel env vars' });
  }

  try {
    // Fetch top headlines related to geopolitics
    const query = 'Iran OR Ukraine OR Gaza OR China Taiwan OR Houthi OR sanctions';
    const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&max=30&apikey=${apiKey}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`GNews HTTP ${r.status}`);
    const json = await r.json();

    const articles = (json.articles || []).map(a => ({
      h:       a.title,
      source:  a.source?.name || 'Unknown',
      url:     a.url,
      time:    a.publishedAt,
      region:  detectRegion(a.title + ' ' + (a.description || '')),
      sev:     detectSeverity(a.title + ' ' + (a.description || '')),
    }));

    res.status(200).json({ ok: true, articles, count: articles.length, ts: new Date().toISOString() });
  } catch (err) {
    res.status(200).json({ ok: false, articles: [], error: err.message });
  }
}

function detectRegion(text) {
  const t = text.toLowerCase();
  if (t.includes('iran') || t.includes('iraq') || t.includes('israel') || t.includes('gaza') || t.includes('hormuz') || t.includes('houthi') || t.includes('yemen') || t.includes('saudi') || t.includes('persian gulf')) return 'ME';
  if (t.includes('ukraine') || t.includes('russia') || t.includes('nato') || t.includes('europe') || t.includes('poland') || t.includes('germany') || t.includes('france')) return 'EU';
  if (t.includes('china') || t.includes('taiwan') || t.includes('korea') || t.includes('japan') || t.includes('india') || t.includes('pakistan') || t.includes('asia')) return 'AS';
  if (t.includes('africa') || t.includes('sudan') || t.includes('mali') || t.includes('niger') || t.includes('somalia') || t.includes('ethiopia')) return 'AF';
  if (t.includes('venezuela') || t.includes('mexico') || t.includes('colombia') || t.includes('latin') || t.includes('brazil')) return 'LA';
  if (t.includes('congress') || t.includes('senate') || t.includes('white house') || t.includes('pentagon') || t.includes('washington')) return 'US';
  return 'GL';
}

function detectSeverity(text) {
  const t = text.toLowerCase();
  const highWords = ['strike', 'attack', 'killed', 'missiles', 'explosion', 'war', 'invasion', 'clash', 'combat', 'troops', 'nuclear', 'airstrike', 'bombing', 'blockade', 'escalat'];
  const lowWords  = ['meeting', 'talks', 'diplomat', 'agreement', 'treaty', 'sanction lifted', 'ceasefire'];
  if (highWords.some(w => t.includes(w))) return 'high';
  if (lowWords.some(w => t.includes(w)))  return 'low';
  return 'med';
}
