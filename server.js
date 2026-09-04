require('dotenv').config();

const express = require('express');
const Parser = require('rss-parser');
const path = require('path');

const app = express();
const parser = new Parser({ timeout: 8000 });
const port = process.env.PORT || 3000;
const cache = new Map();

const demoMarkets = [
  { id: 1, name: 'Bitcoin', symbol: 'BTC', quote: { USD: { price: 68241.12, percent_change_24h: 2.84, market_cap: 1346500000000, volume_24h: 31840000000 } } },
  { id: 1027, name: 'Ethereum', symbol: 'ETH', quote: { USD: { price: 3528.67, percent_change_24h: 1.46, market_cap: 424100000000, volume_24h: 14720000000 } } },
  { id: 825, name: 'Tether', symbol: 'USDT', quote: { USD: { price: 1.0, percent_change_24h: 0.01, market_cap: 112400000000, volume_24h: 45600000000 } } },
  { id: 52, name: 'XRP', symbol: 'XRP', quote: { USD: { price: 0.5184, percent_change_24h: -0.72, market_cap: 28700000000, volume_24h: 1090000000 } } },
  { id: 5426, name: 'Solana', symbol: 'SOL', quote: { USD: { price: 164.28, percent_change_24h: 5.21, market_cap: 76200000000, volume_24h: 2930000000 } } },
  { id: 1839, name: 'BNB', symbol: 'BNB', quote: { USD: { price: 594.16, percent_change_24h: -1.12, market_cap: 88000000000, volume_24h: 1330000000 } } }
];

const demoNews = [
  { title: 'Bitcoin steadies as markets weigh the next macro catalyst', link: 'https://www.coindesk.com/markets/', pubDate: new Date().toISOString(), creator: 'CoinDesk Markets', contentSnippet: 'The crypto market is watching liquidity and rate expectations as the week develops.' },
  { title: 'Ethereum developers outline the next chapter for network scaling', link: 'https://www.coindesk.com/tech/', pubDate: new Date(Date.now() - 3600000).toISOString(), creator: 'CoinDesk Tech', contentSnippet: 'Builders continue to focus on lower fees and a smoother experience for users.' },
  { title: 'Solana ecosystem activity keeps traders focused on volume', link: 'https://www.coindesk.com/markets/', pubDate: new Date(Date.now() - 7200000).toISOString(), creator: 'CoinDesk Markets', contentSnippet: 'On-chain activity and renewed risk appetite put high-beta assets in focus.' },
  { title: 'What crypto investors are watching this week', link: 'https://www.coindesk.com/markets/', pubDate: new Date(Date.now() - 10800000).toISOString(), creator: 'CoinDesk', contentSnippet: 'A quick read on the data releases and network events shaping sentiment.' }
];

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
      if (!process.env.COINMARKETCAP_API_KEY) return { data: demoMarkets, demo: true };
      const response = await fetch(`https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?limit=${limit}&convert=USD`, {
        headers: { 'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_API_KEY, Accept: 'application/json' }
      });
      if (!response.ok) throw new Error(`CoinMarketCap returned ${response.status}`);
      return { ...(await response.json()), demo: false };
    });
    res.json(data);
  } catch (error) {
    res.status(502).json({ error: 'Market data is temporarily unavailable.', detail: error.message });
  }
});

app.get('/api/news', async (_req, res) => {
  try {
    const data = await cached('news', async () => {
      try {
        const feed = await parser.parseURL('https://www.coindesk.com/arc/outboundfeeds/rss/');
        return { items: feed.items.slice(0, 8).map((item) => ({ title: item.title, link: item.link, pubDate: item.pubDate, creator: item.creator || 'CoinDesk', contentSnippet: item.contentSnippet || '' })), demo: false };
      } catch (_) {
        return { items: demoNews, demo: true };
      }
    }, 120000);
    res.json(data);
  } catch (error) {
    res.status(502).json({ error: 'News is temporarily unavailable.', detail: error.message });
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(port, () => console.log(`Market tracker running at http://localhost:${port}`));