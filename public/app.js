const money = (value, compact = false) => {
  if (compact) return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value < 1 ? 4 : 2 }).format(value);
};
const ago = (date) => { const minutes = Math.max(1, Math.round((Date.now() - new Date(date)) / 60000)); return minutes < 60 ? `${minutes}m ago` : `${Math.round(minutes / 60)}h ago`; };
const esc = (value) => String(value || '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

async function loadMarkets() {
  const response = await fetch('/api/markets?limit=10');
  if (!response.ok) throw new Error('Market data unavailable');
  const payload = await response.json();
  const markets = payload.data || [];
  const quotes = markets.map((coin) => coin.quote.USD);
  const cap = quotes.reduce((sum, quote) => sum + quote.market_cap, 0);
  const volume = quotes.reduce((sum, quote) => sum + quote.volume_24h, 0);
  const weightedChange = quotes.reduce((sum, quote) => sum + quote.percent_change_24h * quote.market_cap, 0) / cap;
  document.querySelector('#market-cap').textContent = money(cap, true);
  document.querySelector('#volume').textContent = money(volume, true);
  document.querySelector('#market-change').textContent = `${weightedChange >= 0 ? '+' : ''}${weightedChange.toFixed(2)}% today`;
  document.querySelector('#market-change').className = `change ${weightedChange >= 0 ? 'positive' : 'negative'}`;
  document.querySelector('#pulse').textContent = weightedChange >= 0 ? 'Risk on' : 'Risk off';
  document.querySelector('#market-table').innerHTML = markets.map((coin, index) => { const quote = coin.quote.USD; const change = quote.percent_change_24h; return `<tr><td>${String(index + 1).padStart(2, '0')}</td><td><div class="coin"><span class="coin-symbol">${esc(coin.symbol.slice(0, 3))}</span><span>${esc(coin.name)}<small>${esc(coin.symbol)}</small></span></div></td><td>${money(quote.price)}</td><td class="${change >= 0 ? 'positive' : 'negative'}">${change >= 0 ? '+' : ''}${change.toFixed(2)}%</td><td>${money(quote.market_cap, true)}</td><td>${money(quote.volume_24h, true)}</td><td><div class="mini-chart" aria-hidden="true"></div></td></tr>`; }).join('');
  document.querySelector('#updated').textContent = `updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

async function loadNews() {
  const response = await fetch('/api/news');
  if (!response.ok) throw new Error('News unavailable');
  const payload = await response.json();
  document.querySelector('#news-list').innerHTML = payload.items.map((item) => `<article class="news-item"><div class="news-meta">${esc(item.creator || 'CoinDesk')} · ${ago(item.pubDate)}</div><a href="${esc(item.link)}" target="_blank" rel="noreferrer">${esc(item.title)} ↗</a>${item.contentSnippet ? `<p>${esc(item.contentSnippet).slice(0, 120)}</p>` : ''}</article>`).join('');
}

async function refresh() {
  const button = document.querySelector('#refresh'); button.textContent = '…'; button.disabled = true;
  try { await Promise.all([loadMarkets(), loadNews()]); } catch (error) { console.error(error); document.querySelector('#updated').textContent = 'connection issue'; } finally { button.textContent = '↻'; button.disabled = false; }
}
document.querySelector('#refresh').addEventListener('click', refresh);
refresh();