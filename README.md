# Pulseboard

A full-stack crypto market dashboard backed by CoinMarketCap market data and the CoinDesk RSS feed.

## Run locally

```bash
npm install
cp .env.example .env
# Add COINMARKETCAP_API_KEY to .env for live market data.
npm start
```

Open `http://localhost:3000`. Without an API key, the market endpoint uses a clearly labeled demo snapshot so the interface can still be previewed. News falls back to sample stories if the RSS feed is unavailable.

## API routes

- `GET /api/markets?limit=10` proxies CoinMarketCap listings with a one-minute cache.
- `GET /api/news` parses CoinDesk RSS with a two-minute cache.
- `GET /api/health` provides a simple server health check.
