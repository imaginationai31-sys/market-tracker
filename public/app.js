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
let moverSlides = [];
let moverSlideIndex = 0;
let moverSlideTimer;
let chartMetric = 'market_cap';
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

function renderTrendingCoin(markets) {
  moverSlides = markets.filter((coin) => typeof coin.quote?.USD?.percent_change_24h === 'number').sort((left, right) => Math.abs(right.quote.USD.percent_change_24h) - Math.abs(left.quote.USD.percent_change_24h)).slice(0, 5);
  moverSlideIndex = 0;
  clearInterval(moverSlideTimer);
  const name = document.querySelector('#trending-coin');
  const change = document.querySelector('#trending-change');
  if (!moverSlides.length) {
    name.innerHTML = '<span class="mover-name">Awaiting market data</span>';
    change.textContent = '—';
    return;
  }
  const dots = document.querySelector('#movers-dots');
  dots.innerHTML = moverSlides.map((_coin, index) => `<span class="mover-dot${index === 0 ? ' active' : ''}"></span>`).join('');
  showMoverSlide();
  moverSlideTimer = setInterval(() => {
    moverSlideIndex = (moverSlideIndex + 1) % moverSlides.length;
    showMoverSlide();
  }, 3500);
}

function showMoverSlide() {
  const trending = moverSlides[moverSlideIndex];
  const name = document.querySelector('#trending-coin');
  const change = document.querySelector('#trending-change');
  const percent = trending.quote.USD.percent_change_24h;
  name.querySelector('.mover-name')?.remove();
  const nameLabel = document.createElement('span');
  nameLabel.className = 'mover-name';
  nameLabel.textContent = trending.name;
  nameLabel.title = trending.name;
  name.prepend(nameLabel);
  change.textContent = `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  change.className = `globe-change ${percent >= 0 ? 'positive' : 'negative'}`;
  document.querySelectorAll('.mover-dot').forEach((dot, index) => dot.classList.toggle('active', index === moverSlideIndex));
}

function renderMarketChart(markets) {
  const chart = document.querySelector('#market-chart');
  const points = markets.filter((coin) => typeof coin.quote?.USD?.[chartMetric] === 'number').sort((left, right) => right.quote.USD[chartMetric] - left.quote.USD[chartMetric]).slice(0, 12);
  if (!points.length) {
    chart.innerHTML = '<text x="450" y="130" text-anchor="middle" class="chart-empty">Awaiting market data</text>';
    return;
  }
  const values = points.map((coin) => coin.quote.USD[chartMetric]);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const spread = maximum - minimum || 1;
  const coordinates = values.map((value, index) => ({ x: 42 + index * (816 / Math.max(points.length - 1, 1)), y: 218 - ((value - minimum) / spread) * 164 }));
  const line = coordinates.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const area = `${line} L ${coordinates.at(-1).x.toFixed(1)} 218 L ${coordinates[0].x.toFixed(1)} 218 Z`;
  const labels = points.map((coin, index) => `<text x="${coordinates[index].x.toFixed(1)}" y="244" text-anchor="middle">${esc(coin.symbol.slice(0, 5))}</text>`).join('');
  const dots = coordinates.map((point) => `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="4" />`).join('');
  chart.innerHTML = `<line class="chart-gridline" x1="42" y1="54" x2="858" y2="54" /><line class="chart-gridline" x1="42" y1="136" x2="858" y2="136" /><line class="chart-gridline" x1="42" y1="218" x2="858" y2="218" /><path class="chart-area" d="${area}" /><path class="chart-line" d="${line}" />${dots}<g class="chart-labels">${labels}</g>`;
  chart.setAttribute('aria-label', `Live ${chartMetric.replaceAll('_', ' ')} profile for the top ${points.length} assets`);
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

function showMarketLoading(label = 'Loading category markets') {
  document.querySelector('#market-table').innerHTML = `<tr><td colspan="6" class="loading">${esc(label)}<span class="loading-bar"></span></td></tr>`;
  document.querySelector('#market-count').textContent = 'Loading markets';
  document.querySelector('#page-indicator').textContent = '1 / 1';
  document.querySelector('#previous-page').disabled = true;
  document.querySelector('#next-page').disabled = true;
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
  marketState.all = [];
  marketState.filtered = [];
  showMarketLoading(`Loading ${marketState.categoryName.toLowerCase()}`);
  loadMarkets(category).catch((error) => {
    console.error(error);
    document.querySelector('#market-table').innerHTML = '<tr><td colspan="6" class="empty-state">Category markets are temporarily unavailable.</td></tr>';
    document.querySelector('#market-count').textContent = 'No markets loaded';
  });
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
  renderTrendingCoin(markets);
  renderMarketChart(markets);
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
document.querySelectorAll('[data-chart-metric]').forEach((button) => button.addEventListener('click', () => {
  chartMetric = button.dataset.chartMetric;
  document.querySelectorAll('[data-chart-metric]').forEach((item) => item.classList.toggle('active', item === button));
  renderMarketChart(marketState.all);
}));
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