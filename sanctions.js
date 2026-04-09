// api/sanctions.js — Vercel serverless function  
// Fetches the OFAC SDN (Specially Designated Nationals) list from US Treasury
// Updates daily — cached aggressively since the list changes infrequently

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600'); // cache 1 hour

  try {
    // OFAC publishes a consolidated sanctions list as JSON
    // This is the official US Treasury endpoint
    const url = 'https://data.treasury.gov/ofac/downloads/sanctions/consolidated/consolidated.json';
    const r = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Glassball-Intel-Dashboard/1.0' }
    });

    if (!r.ok) throw new Error(`Treasury API HTTP ${r.status}`);
    const json = await r.json();

    // Parse and return most recent entries
    // Focus on entries relevant to geopolitical monitoring
    const GEO_PROGRAMS = ['IRAN', 'RUSSIA', 'UKRAINE-EO13662', 'SYRIA', 'DPRK', 'HAMAS', 'HIZB', 'SDGT', 'NPWMD'];

    const entries = (json.entries || json.sdnList?.sdnEntry || [])
      .filter(e => {
        const programs = (e.programList?.program || []).map(p => p.toUpperCase());
        return programs.some(p => GEO_PROGRAMS.some(gp => p.includes(gp)));
      })
      .slice(0, 100) // return top 100 most relevant
      .map(e => ({
        name:      e.lastName || e.sdnName || 'Unknown',
        type:      e.sdnType || 'Entity',
        programs:  (e.programList?.program || []).join(', '),
        id:        e.uid || '',
        country:   (e.nationalityList?.nationality?.[0]?.country) || '—',
      }));

    res.status(200).json({ ok: true, entries, count: entries.length, ts: new Date().toISOString() });
  } catch (err) {
    // If OFAC is unreachable, return empty gracefully
    res.status(200).json({ ok: false, entries: [], error: err.message, ts: new Date().toISOString() });
  }
}
