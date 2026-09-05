const money = (value, compact = false) => {
  if (compact) return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value < 1 ? 4 : 2 }).format(value);
};
const ago = (date) => { const minutes = Math.max(1, Math.round((Date.now() - new Date(date)) / 60000)); return minutes < 60 ? `${minutes}m ago` : `${Math.round(minutes / 60)}h ago`; };
const esc = (value) => String(value || '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const marketPageSize = 25;
const watchlistStorageKey = 'pulseboard-watchlist';
const watchlist = new Set(JSON.parse(localStorage.getItem(watchlistStorageKey) || '[]'));
const marketState = { all: [], filtered: [], page: 1, category: '', categoryName: 'All markets', watchlistOnly: false, requestId: 0 };
const themeToggle = document.querySelector('#theme-toggle');

function applyTheme(theme) {
  document.body.classList.toggle('light-theme', theme === 'light');
  themeToggle.textContent = theme === 'light' ? '☾' : '☼';
  themeToggle.setAttribute('aria-label', `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`);
  themeToggle.title = `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`;
}

function saveWatchlist() {
  localStorage.setItem(watchlistStorageKey, JSON.stringify([...watchlist]));
}

function coinKey(coin) {
  return String(coin.id || coin.slug || coin.symbol);
}

function coinUrl(coin) {
  return `https://coinmarketcap.com/currencies/${encodeURIComponent(coin.slug || coin.symbol.toLowerCase())}/`;
}

function coinLogoUrl(coin) {
  return coin.id ? `https://s2.coinmarketcap.com/static/img/coins/64x64/${encodeURIComponent(coin.id)}.png` : '';
}

function renderMarkets() {
  const start = (marketState.page - 1) * marketPageSize;
  const pageMarkets = marketState.filtered.slice(start, start + marketPageSize);
  const totalPages = Math.max(1, Math.ceil(marketState.filtered.length / marketPageSize));
  const table = document.querySelector('#market-table');
  table.innerHTML = pageMarkets.length ? pageMarkets.map((coin, index) => {
    const quote = coin.quote.USD;
    const change = quote.percent_change_24h;
    const rank = Number(coin.cmc_rank) || start + index + 1;
    const key = coinKey(coin);
    const saved = watchlist.has(key);
    const logo = coinLogoUrl(coin);
    return `<tr><td>${String(rank).padStart(2, '0')}</td><td><div class="coin"><span class="coin-symbol"><img src="${esc(logo)}" alt="" loading="lazy" onerror="this.hidden=true" />${esc(coin.symbol.slice(0, 3))}</span><a class="coin-details" href="${esc(coinUrl(coin))}" target="_blank" rel="noreferrer">${esc(coin.name)}<small>${esc(coin.symbol)} · CoinMarketCap ↗</small></a><button class="heart-button${saved ? ' saved' : ''}" type="button" data-watchlist="${esc(key)}" aria-label="${saved ? 'Remove' : 'Add'} ${esc(coin.name)} ${saved ? 'from' : 'to'} watchlist" aria-pressed="${saved}">♥</button></div></td><td>${money(quote.price)}</td><td class="${change >= 0 ? 'positive' : 'negative'}">${change >= 0 ? '+' : ''}${change.toFixed(2)}%</td><td>${money(quote.market_cap, true)}</td><td>${money(quote.volume_24h, true)}</td></tr>`;
  }).join('') : '<tr><td colspan="6" class="empty-state">No markets match your search.</td></tr>';
  document.querySelector('#market-count').textContent = `${marketState.filtered.length.toLocaleString()} markets`;
  document.querySelector('#page-indicator').textContent = `${marketState.page} / ${totalPages}`;
  document.querySelector('#previous-page').disabled = marketState.page === 1;
  document.querySelector('#next-page').disabled = marketState.page >= totalPages;
  bindWatchlistButtons();
}

function filterMarkets() {
  const query = document.querySelector('#market-search').value.trim().toLowerCase();
  marketState.filtered = marketState.all.filter((coin) => (!marketState.watchlistOnly || watchlist.has(coinKey(coin))) && `${coin.name} ${coin.symbol}`.toLowerCase().includes(query));
  marketState.page = 1;
  renderMarkets();
}

function bindWatchlistButtons() {
  document.querySelectorAll('[data-watchlist]').forEach((button) => button.addEventListener('click', () => {
    const key = button.dataset.watchlist;
    if (watchlist.has(key)) watchlist.delete(key);
    else watchlist.add(key);
    saveWatchlist();
    filterMarkets();
  }));
}

function selectCategory(category) {
  marketState.category = category;
  marketState.watchlistOnly = false;
  document.querySelector('#market-search').value = '';
  marketState.page = 1;
  document.querySelector('#market-heading').textContent = marketState.categoryName;
  loadMarkets(category);
}

async function loadMarkets(category = marketState.category) {
  const requestId = ++marketState.requestId;
  const query = new URLSearchParams({ limit: '100000' });
  if (category) query.set('category', category);
  const response = await fetch(`/api/markets?${query}`);
  if (!response.ok) throw new Error('Market data unavailable');
  const payload = await response.json();
  if (requestId !== marketState.requestId) return;
  const markets = (payload.data || []).sort((left, right) => (left.cmc_rank || Number.MAX_SAFE_INTEGER) - (right.cmc_rank || Number.MAX_SAFE_INTEGER));
  const quotes = markets.map((coin) => coin.quote.USD);
  const cap = quotes.reduce((sum, quote) => sum + quote.market_cap, 0);
  const volume = quotes.reduce((sum, quote) => sum + quote.volume_24h, 0);
  const weightedChange = quotes.reduce((sum, quote) => sum + quote.percent_change_24h * quote.market_cap, 0) / cap;
  document.querySelector('#market-cap').textContent = money(cap, true);
  document.querySelector('#volume').textContent = money(volume, true);
  document.querySelector('#market-change').textContent = `${weightedChange >= 0 ? '+' : ''}${weightedChange.toFixed(2)}% today`;
  document.querySelector('#market-change').className = `change ${weightedChange >= 0 ? 'positive' : 'negative'}`;
  document.querySelector('#pulse').textContent = weightedChange >= 0 ? 'Risk on' : 'Risk off';
  marketState.all = markets;
  filterMarkets();
  document.querySelector('#updated').textContent = `updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function bindCategoryLinks() {
  document.querySelectorAll('[data-category]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    marketState.watchlistOnly = false;
    marketState.categoryName = link.querySelector('strong').textContent;
    document.querySelectorAll('[data-category]').forEach((item) => item.classList.toggle('selected', item === link));
    selectCategory(link.dataset.category);
    document.querySelector('#markets').scrollIntoView({ behavior: 'smooth' });
  }));
}

async function loadGlobalMetrics() {
  const response = await fetch('/api/global');
  if (!response.ok) throw new Error('Global market data unavailable');
  const payload = await response.json();
  const quote = payload.data?.quote?.USD;
  if (!quote) throw new Error('Global market data is incomplete');
  document.querySelector('#market-cap').textContent = money(quote.total_market_cap, true);
  document.querySelector('#volume').textContent = money(quote.total_volume_24h, true);
  if (typeof quote.total_market_cap_yesterday_percentage_change === 'number') {
    const change = quote.total_market_cap_yesterday_percentage_change;
    document.querySelector('#market-change').textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}% today`;
    document.querySelector('#market-change').className = `change ${change >= 0 ? 'positive' : 'negative'}`;
  }
}

async function loadNews() {
  const response = await fetch('/api/news');
  if (!response.ok) throw new Error('News unavailable');
  const payload = await response.json();
  document.querySelector('#news-list').innerHTML = payload.items.map((item) => `<article class="news-item">${item.image ? `<img class="news-image" src="${esc(item.image)}" alt="" loading="lazy" />` : ''}<div class="news-copy"><div class="news-meta">${esc(item.creator || 'CoinDesk')} · ${ago(item.pubDate)}</div><a href="${esc(item.link)}" target="_blank" rel="noreferrer">${esc(item.title)} ↗</a>${item.contentSnippet ? `<p>${esc(item.contentSnippet).slice(0, 120)}</p>` : ''}</div></article>`).join('');
}

async function refresh() {
  const button = document.querySelector('#refresh'); button.textContent = '…'; button.disabled = true;
  try { await Promise.all([loadMarkets(), loadGlobalMetrics(), loadNews()]); } catch (error) { console.error(error); document.querySelector('#updated').textContent = 'connection issue'; } finally { button.textContent = '↻'; button.disabled = false; }
}
themeToggle.addEventListener('click', () => {
  const theme = document.body.classList.contains('light-theme') ? 'dark' : 'light';
  localStorage.setItem('pulseboard-theme', theme);
  applyTheme(theme);
});
applyTheme(localStorage.getItem('pulseboard-theme') || 'dark');
document.querySelector('#refresh').addEventListener('click', refresh);
document.querySelector('#market-search').addEventListener('input', filterMarkets);
document.querySelector('#previous-page').addEventListener('click', () => { if (marketState.page > 1) { marketState.page -= 1; renderMarkets(); } });
document.querySelector('#next-page').addEventListener('click', () => { if (marketState.page < Math.ceil(marketState.filtered.length / marketPageSize)) { marketState.page += 1; renderMarkets(); } });
document.querySelector('#watchlist-link').addEventListener('click', (event) => {
  event.preventDefault();
  marketState.watchlistOnly = true;
  marketState.category = '';
  document.querySelector('#market-heading').textContent = 'Watchlist';
  filterMarkets();
  document.querySelector('#markets').scrollIntoView({ behavior: 'smooth' });
});
const menuToggle = document.querySelector('#menu-toggle');
const siteMenu = document.querySelector('#site-menu');
menuToggle.addEventListener('click', () => {
  const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!isOpen));
  siteMenu.hidden = isOpen;
});
siteMenu.addEventListener('click', () => {
  menuToggle.setAttribute('aria-expanded', 'false');
  siteMenu.hidden = true;
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.menu-wrap')) {
    menuToggle.setAttribute('aria-expanded', 'false');
    siteMenu.hidden = true;
  }
});
bindCategoryLinks();
Promise.all([loadMarkets(), loadNews(), loadGlobalMetrics()]).catch((error) => {
  console.error(error);
  document.querySelector('#updated').textContent = 'connection issue';
});