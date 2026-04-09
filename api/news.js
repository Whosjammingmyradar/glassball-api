// api/news.js — Vercel serverless function
// Fetches live geopolitical news from GNews API with quality source filtering

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=300');

  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ ok: false, articles: [], error: 'GNEWS_API_KEY not set' });
  }

  // High-quality sources we trust for geopolitical/conflict coverage
  const TRUSTED_SOURCES = [
    'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk',
    'theguardian.com', 'nytimes.com', 'washingtonpost.com',
    'ft.com', 'economist.com', 'foreignpolicy.com',
    'al-monitor.com', 'aljazeera.com', 'france24.com',
    'dw.com', 'trtworld.com', 'axios.com', 'politico.com',
    'defenseone.com', 'defensenews.com', 'breakingdefense.com',
    'janes.com', 'middleeasteye.net', 'haaretz.com',
    'timesofisrael.com', 'jpost.com', 'arabnews.com',
    'dawn.com', 'thehindu.com', 'scmp.com',
    'kyivpost.com', 'kyivindependent.com', 'pravda.com.ua',
    'rferl.org', 'bellingcat.com', 'cnn.com', 'nbcnews.com',
    'cbsnews.com', 'abcnews.go.com', 'wsj.com',
    'bloomberg.com', 'businessinsider.com', 'foreignaffairs.com',
    'theatlantic.com', 'thedailybeast.com', 'vice.com',
    'stripes.com', 'militarytimes.com', 'usni.org',
    'longwarjournal.org', 'understandingwar.org'
  ];

  try {
    // Run two targeted queries for maximum relevance
    const queries = [
      'Iran OR "Operation Epic Fury" OR IRGC OR Hormuz OR Houthi OR "Red Sea"',
      'Ukraine OR Russia OR Gaza OR Hamas OR Hezbollah OR China OR Taiwan OR sanctions'
    ];

    const allArticles = [];

    for (const query of queries) {
      const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&max=20&sortby=publishedAt&apikey=${apiKey}`;
      const r = await fetch(url);
      if (!r.ok) continue;
      const json = await r.json();
      if (json.articles) allArticles.push(...json.articles);
    }

    // Deduplicate by title
    const seen = new Set();
    const unique = allArticles.filter(a => {
      if (seen.has(a.title)) return false;
      seen.add(a.title);
      return true;
    });

    // Filter to trusted sources only
    const filtered = unique.filter(a => {
      const domain = (a.source?.url || a.url || '').replace('https://','').replace('http://','').split('/')[0].replace('www.','');
      return TRUSTED_SOURCES.some(s => domain.includes(s) || s.includes(domain));
    });

    // If trusted filter is too aggressive, fall back to all but still deduplicated
    const source = filtered.length >= 5 ? filtered : unique;

    const articles = source.slice(0, 30).map(a => ({
      h:      a.title,
      source: a.source?.name || 'Unknown',
      url:    a.url,
      time:   a.publishedAt,
      region: detectRegion(a.title + ' ' + (a.description || '')),
      sev:    detectSeverity(a.title + ' ' + (a.description || '')),
    }));

    res.status(200).json({ ok: true, articles, count: articles.length, ts: new Date().toISOString() });
  } catch (err) {
    res.status(200).json({ ok: false, articles: [], error: err.message });
  }
}

function detectRegion(text) {
  const t = text.toLowerCase();
  if (t.includes('iran') || t.includes('iraq') || t.includes('israel') || t.includes('gaza') || t.includes('hormuz') || t.includes('houthi') || t.includes('yemen') || t.includes('saudi') || t.includes('persian gulf') || t.includes('hezbollah') || t.includes('irgc')) return 'ME';
  if (t.includes('ukraine') || t.includes('russia') || t.includes('nato') || t.includes('europe') || t.includes('poland') || t.includes('germany') || t.includes('france') || t.includes('kyiv') || t.includes('moscow')) return 'EU';
  if (t.includes('china') || t.includes('taiwan') || t.includes('korea') || t.includes('japan') || t.includes('india') || t.includes('pakistan') || t.includes('asia') || t.includes('beijing')) return 'AS';
  if (t.includes('africa') || t.includes('sudan') || t.includes('mali') || t.includes('niger') || t.includes('somalia') || t.includes('ethiopia') || t.includes('sahel')) return 'AF';
  if (t.includes('venezuela') || t.includes('mexico') || t.includes('colombia') || t.includes('latin') || t.includes('brazil') || t.includes('cartel')) return 'LA';
  if (t.includes('congress') || t.includes('senate') || t.includes('white house') || t.includes('pentagon') || t.includes('washington') || t.includes('trump') || t.includes('tariff')) return 'US';
  return 'GL';
}

function detectSeverity(text) {
  const t = text.toLowerCase();
  const high = ['strike', 'attack', 'killed', 'missile', 'explosion', 'war', 'invasion', 'clash', 'combat', 'troops', 'nuclear', 'airstrike', 'bombing', 'blockade', 'escalat', 'hostil', 'casualt', 'drone', 'rocket'];
  const low  = ['talks', 'diplomat', 'agreement', 'treaty', 'ceasefire', 'deal', 'negotiat', 'meeting', 'summit'];
  if (high.some(w => t.includes(w))) return 'high';
  if (low.some(w => t.includes(w)))  return 'low';
  return 'med';
}
