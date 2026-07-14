import { QUOTES } from './data.js';

const $ = (sel) => document.querySelector(sel);

const REPO_BASE = '/100-quotes-of-cs';

function getBasePath() {
  return location.pathname === REPO_BASE || location.pathname.startsWith(`${REPO_BASE}/`)
    ? REPO_BASE
    : '';
}

function getRoutePath() {
  const base = getBasePath();
  const withoutBase = base ? location.pathname.slice(base.length) : location.pathname;
  return withoutBase.replace(/^\//, '').replace(/\/$/, '');
}

function routeUrl(path = '') {
  const base = getBasePath();
  const clean = String(path).replace(/^\//, '');
  return `${base}/${clean}`.replace(/\/$/, '/') || '/';
}

const els = {
  home: $('#home-view'),
  archive: $('#archive-view'),
  quoteText: $('#quote-text'),
  quoteAuthor: $('#quote-author'),
  quoteSource: $('#quote-source'),
  quoteYear: $('#quote-year'),
  quoteCategory: $('#quote-category'),
  favBtn: $('#fav-btn'),
  progressBar: $('#progress-bar'),
  progressLabel: $('#progress-label'),
  themeBtn: $('#theme-btn'),
  homeLink: $('#home-link'),
  nextBtn: $('#next-btn'),
  searchBox: $('#search-box'),
  categoryFilters: $('#category-filters'),
  yearList: $('#year-list'),
};

const STORAGE = {
  theme: 'v_theme',
  favorites: 'v_favorites',
  shownYears: 'v_shown_years',
  streak: 'v_streak',
  lastVisit: 'v_last_visit',
};

let shuffleQueue = [];
let currentIndex = -1;
let currentYear = null;

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function saveJSON(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

function fisherYates(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildShuffleQueue() {
  shuffleQueue = fisherYates(QUOTES.map((_, i) => i));
  currentIndex = -1;
}

function getQuoteByYear(year) {
  return QUOTES.find(q => q.year === Number(year));
}

function todaysFeaturedIndex() {
  const now = new Date();
  const seed = now.getFullYear() * 372 + (now.getMonth() + 1) * 31 + now.getDate();
  return seed % QUOTES.length;
}

function updateStreak() {
  const today = new Date().toISOString().slice(0, 10);
  const last = localStorage.getItem(STORAGE.lastVisit);
  let streak = Number(localStorage.getItem(STORAGE.streak) || '0');
  if (last === today) return streak;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  streak = last === yesterday ? streak + 1 : 1;
  localStorage.setItem(STORAGE.streak, String(streak));
  localStorage.setItem(STORAGE.lastVisit, today);
  return streak;
}

function renderQuote(q, { pushHistory = true } = {}) {
  if (!q) return;

  currentYear = q.year;
  els.quoteText.textContent = `"${q.quote}"`;
  els.quoteAuthor.textContent = q.author;
  const bits = [q.source, String(q.year)].filter(Boolean);
  els.quoteSource.textContent = bits.join(' • ');
  els.quoteCategory.textContent = q.category || '';
  const idx = QUOTES.findIndex(x => x.year === q.year);
  els.progressLabel.textContent = `Quote ${idx + 1} of ${QUOTES.length}`;
  els.progressBar.style.width = `${((idx + 1) / QUOTES.length) * 100}%`;
  updateFavButton();
  els.quoteText.classList.add('visible');

  if (pushHistory) {
    history.pushState({ year: q.year }, '', routeUrl(q.year));
  }
}

function showRandom() {
  if (currentIndex >= shuffleQueue.length - 1) buildShuffleQueue();
  currentIndex++;
  const q = QUOTES[shuffleQueue[currentIndex]];
  renderQuote(q);
}

function showNext() {
  const idx = QUOTES.findIndex(x => x.year === currentYear);
  const next = QUOTES[((idx >= 0 ? idx : todaysFeaturedIndex()) + 1) % QUOTES.length];
  renderQuote(next);
}

function showPrev() {
  const idx = QUOTES.findIndex(x => x.year === currentYear);
  const prev = QUOTES[(idx - 1 + QUOTES.length) % QUOTES.length];
  renderQuote(prev);
}

function toggleFavorite() {
  const favs = loadJSON(STORAGE.favorites, []);
  const i = favs.indexOf(currentYear);
  if (i >= 0) favs.splice(i, 1); else favs.push(currentYear);
  saveJSON(STORAGE.favorites, favs);
  updateFavButton();
}

function updateFavButton() {
  const favs = loadJSON(STORAGE.favorites, []);
  const active = favs.includes(currentYear);
  els.favBtn.classList.toggle('active', active);
  els.favBtn.textContent = active ? 'Saved' : 'Save';
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  const next = cur === 'light' ? 'dark' : 'light';
  if (next === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
  localStorage.setItem(STORAGE.theme, next);
}

function applyStoredTheme() {
  const t = localStorage.getItem(STORAGE.theme);
  if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
}


/* ---------- ARCHIVE ---------- */
const CATEGORIES = [...new Set(QUOTES.map(q => q.category).filter(Boolean))].sort();
let activeCategory = 'All';

function buildCategoryFilters() {
  const frag = document.createDocumentFragment();
  const allBtn = document.createElement('button');
  allBtn.textContent = 'All';
  allBtn.className = 'active';
  allBtn.onclick = () => setCategory('All', allBtn);
  frag.appendChild(allBtn);
  CATEGORIES.forEach(cat => {
    const b = document.createElement('button');
    b.textContent = cat;
    b.onclick = () => setCategory(cat, b);
    frag.appendChild(b);
  });
  els.categoryFilters.appendChild(frag);
}

function setCategory(cat, btn) {
  activeCategory = cat;
  [...els.categoryFilters.children].forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  renderYearList();
}

function renderYearList() {
  const term = els.searchBox.value.trim().toLowerCase();
  const filtered = QUOTES.filter(q => {
    const matchesCat = activeCategory === 'All' || q.category === activeCategory;
    const matchesTerm = !term ||
      q.author.toLowerCase().includes(term) ||
      String(q.year).includes(term) ||
      q.quote.toLowerCase().includes(term) ||
      (q.category || '').toLowerCase().includes(term);
    return matchesCat && matchesTerm;
  });

  els.yearList.innerHTML = '';
  if (!filtered.length) {
    const p = document.createElement('div');
    p.className = 'empty-note';
    p.textContent = 'No quotes match your search.';
    els.yearList.appendChild(p);
    return;
  }
  const frag = document.createDocumentFragment();
  filtered.forEach(q => {
    const row = document.createElement('div');
    row.className = 'year-row';
    row.innerHTML = `<span class="yr">${q.year}</span><span class="yq">"${escapeHtml(q.quote)}"</span><span class="ya">${escapeHtml(q.author)}</span>`;
    row.onclick = () => { goHome(); renderQuote(q); };
    frag.appendChild(row);
  });
  els.yearList.appendChild(frag);
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function goHome() {
  els.archive.classList.add('hidden');
  els.home.classList.remove('hidden');
}
function goArchive() {
  els.home.classList.add('hidden');
  els.archive.classList.remove('hidden');
  history.pushState({}, '', routeUrl('archive'));
}

/* ---------- ROUTING ---------- */
function initFromLocation() {
  const path = getRoutePath();
  if (path === 'archive') {
    goArchive();
    return;
  }
  const asYear = Number(path);
  if (path && !Number.isNaN(asYear)) {
    const q = getQuoteByYear(asYear);
    if (q) { renderQuote(q, { pushHistory: false }); return; }
  }
  const featured = QUOTES[todaysFeaturedIndex()];
  renderQuote(featured, { pushHistory: false });
}

window.addEventListener('popstate', () => {
  const path = getRoutePath();
  if (path === 'archive') { goArchive(); return; }
  const asYear = Number(path);
  const q = !Number.isNaN(asYear) ? getQuoteByYear(asYear) : null;
  if (q) { goHome(); renderQuote(q, { pushHistory: false }); }
  else { goHome(); }
});

/* ---------- EVENTS ---------- */
els.nextBtn.addEventListener('click', showNext);
els.favBtn.addEventListener('click', toggleFavorite);
els.themeBtn.addEventListener('click', toggleTheme);
els.homeLink.addEventListener('click', (e) => { e.preventDefault(); goHome(); history.pushState({}, '', routeUrl()); });
els.searchBox.addEventListener('input', renderYearList);

document.addEventListener('keydown', (e) => {
  if (document.activeElement === els.searchBox) {
    if (e.key === 'Escape') els.searchBox.blur();
    return;
  }

  if (e.key === 'ArrowRight') showNext();
});

/* ---------- INIT ---------- */
applyStoredTheme();
buildShuffleQueue();
buildCategoryFilters();
renderYearList();
updateStreak();
initFromLocation();
