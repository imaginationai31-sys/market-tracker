require('dotenv').config();

const express = require('express');
const Parser = require('rss-parser');
const path = require('path');

const app = express();
const parser = new Parser({ timeout: 8000 });
const port = process.env.PORT || 3000;
const cache = new Map();

async function cached(key, loader, ttl = 60000) {
  const current = cache.get(key);
  if (current && Date.now() - current.at < ttl) return current.value;
  const value = await loader();
  cache.set(key, { at: Date.now(), value });
  return value;
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/markets', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const data = await cached(`markets-${limit}`, async () => {
      if (!process.env.COINMARKETCAP_API_KEY) throw new Error('COINMARKETCAP_API_KEY is not configured');
      const response = await fetch(`https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?limit=${limit}&convert=USD`, {
        headers: { 'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_API_KEY, Accept: 'application/json' }
      });
      if (!response.ok) throw new Error(`CoinMarketCap returned ${response.status}`);
      return await response.json();
    });
    res.json(data);
  } catch (error) {
    res.status(502).json({ error: 'Market data is temporarily unavailable.', detail: error.message });
  }
});

app.get('/api/news', async (_req, res) => {
  try {
    const data = await cached('news', async () => {
      const feed = await parser.parseURL('https://www.coindesk.com/arc/outboundfeeds/rss/');
      return { items: feed.items.slice(0, 8).map((item) => ({ title: item.title, link: item.link, pubDate: item.pubDate, creator: item.creator || 'CoinDesk', contentSnippet: item.contentSnippet || '' })) };
    }, 120000);
    res.json(data);
  } catch (error) {
    res.status(502).json({ error: 'News is temporarily unavailable.', detail: error.message });
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(port, () => console.log(`Market tracker running at http://localhost:${port}`));