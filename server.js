require('dotenv').config();

const express = require('express');
const Parser = require('rss-parser');
const path = require('path');

const app = express();
const parser = new Parser({ timeout: 8000, customFields: { item: ['media:content', 'media:thumbnail'] } });
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

function coinMarketCapHeaders() {
  return { 'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_API_KEY, Accept: 'application/json' };
}

app.get('/api/markets', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 1000, 1000);
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const data = await cached(`markets-${limit}-${category}`, async () => {
      if (!process.env.COINMARKETCAP_API_KEY) throw new Error('COINMARKETCAP_API_KEY is not configured');
      const params = new URLSearchParams({ limit: String(limit), convert: 'USD' });
      if (category) params.set('category', category);
      const response = await fetch(`https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?${params}`, { headers: coinMarketCapHeaders() });
      if (!response.ok) throw new Error(`CoinMarketCap returned ${response.status}`);
      return await response.json();
    });
    res.json(data);
  } catch (error) {
    res.status(502).json({ error: 'Market data is temporarily unavailable.', detail: error.message });
  }
});

app.get('/api/categories', async (_req, res) => {
  try {
    const data = await cached('categories', async () => {
      if (!process.env.COINMARKETCAP_API_KEY) throw new Error('COINMARKETCAP_API_KEY is not configured');
      const response = await fetch('https://pro-api.coinmarketcap.com/v1/cryptocurrency/categories?start=1&limit=500&sort=market_cap&sort_dir=desc&convert=USD', { headers: coinMarketCapHeaders() });
      if (!response.ok) throw new Error(`CoinMarketCap returned ${response.status}`);
      return await response.json();
    }, 300000);
    res.json(data);
  } catch (error) {
    res.status(502).json({ error: 'CoinMarketCap categories are temporarily unavailable.', detail: error.message });
  }
});

app.get('/api/global', async (_req, res) => {
  try {
    const data = await cached('global', async () => {
      if (!process.env.COINMARKETCAP_API_KEY) throw new Error('COINMARKETCAP_API_KEY is not configured');
      const response = await fetch('https://pro-api.coinmarketcap.com/v1/global-metrics/quotes/latest?convert=USD', { headers: coinMarketCapHeaders() });
      if (!response.ok) throw new Error(`CoinMarketCap returned ${response.status}`);
      return await response.json();
    }, 60000);
    res.json(data);
  } catch (error) {
    res.status(502).json({ error: 'Global market data is temporarily unavailable.', detail: error.message });
  }
});

app.get('/api/news', async (_req, res) => {
  try {
    const data = await cached('news', async () => {
      const feed = await parser.parseURL('https://www.coindesk.com/arc/outboundfeeds/rss/');
      return { items: feed.items.slice(0, 8).map((item) => ({ title: item.title, link: item.link, pubDate: item.pubDate, creator: item.creator || 'CoinDesk', contentSnippet: item.contentSnippet || '', image: item.enclosure?.url || item['media:content']?.$?.url || item['media:thumbnail']?.$?.url || '' })) };
    }, 120000);
    res.json(data);
  } catch (error) {
    res.status(502).json({ error: 'News is temporarily unavailable.', detail: error.message });
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(port, () => console.log(`Market tracker running at http://localhost:${port}`));