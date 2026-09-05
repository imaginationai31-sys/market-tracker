# Pulseboard

A full-stack crypto market dashboard backed by CoinMarketCap market data and the CoinDesk RSS feed.

## Run locally

```bash
npm install
cp .env.example .env
# Add COINMARKETCAP_API_KEY to .env for market data.
npm start
```

Open `http://localhost:3000`. The dashboard requires `COINMARKETCAP_API_KEY` and uses live CoinMarketCap market data and CoinDesk RSS news.

## API routes

- `GET /api/markets?limit=100000` loads all available CoinMarketCap listings in paged batches with a one-minute cache.
- `GET /api/global` retrieves total CoinMarketCap market capitalization and 24-hour volume.
- `GET /api/news` parses CoinDesk RSS with a two-minute cache.
- `GET /api/health` provides a simple server health check.
