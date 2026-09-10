/* ==========================================================================
   BloxBid — shared UI runtime (no build step, no dependencies)
   ========================================================================== */
(function () {
  const D = window.BB_DATA;

  /* ---------------------------------------------------------- Formatters */
  const fmt = {
    compact(n) {
      if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace(/\.0$/, '') + 'B';
      if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
      if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K';
      return String(n);
    },
    full: (n) => n.toLocaleString('en-US'),
    money: (n) => '$' + n.toLocaleString('en-US')
  };

  /* ------------------------------------------------------------- Helpers */
  const el = (sel, root = document) => root.querySelector(sel);
  const els = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const gameUrl = (g) => `game.html?g=${g.id}`;
  const params = new URLSearchParams(location.search);

  /* Only external destination allowed on a game page: PLAY ON ROBLOX */
  const robloxUrl = (g) => `https://www.roblox.com/discover?Keyword=${encodeURIComponent(g.name)}`;

  /* ---------------------------------------------------------- Thumbnails */
  const thumbStyle = (g) =>
    `background:linear-gradient(145deg, hsl(${g.hue} 88% 62%), hsl(${(g.hue + 42) % 360} 92% 46%))`;

  const thumb = (g, cls = '') =>
    `<div class="thumb ${cls}" style="${thumbStyle(g)}" aria-hidden="true">
       <span class="thumb__glyph">${g.glyph}</span>
     </div>`;

  /* ------------------------------------------------------------ Movement */
  function movement(g) {
    const delta = g.history[0] - g.history[13];
    if (delta > 1) return `<span class="badge badge--up">▲ ${delta}</span>`;
    if (delta < -1) return `<span class="badge badge--down">▼ ${Math.abs(delta)}</span>`;
    return `<span class="badge">—</span>`;
  }

  /* -------------------------------------------------------- Leaderboard row */
  function row(g) {
    const rankCls = g.rank <= 3 ? ` rank--${g.rank}` : '';
    return `
    <a class="row-game" href="${gameUrl(g)}">
      <span class="rank${rankCls}">${g.rank}</span>
      <span class="row-game__main">
        ${thumb(g, 'row-game__thumb')}
        <span class="row-game__meta">
          <span class="row-game__name">${esc(g.name)}</span>
          <span class="row-game__sub">
            ${esc(g.group)} <i class="sep">·</i> ${esc(g.genre)} <i class="sep">·</i> ${movement(g)}
          </span>
        </span>
      </span>
      <span class="cell cell--bid">
        <span class="cell__v cell__v--bid">${fmt.money(g.activeBid ?? g.bid)}</span>
        <span class="cell__k">Bid</span>
      </span>
      <span class="cell cell--players">
        <span class="cell__v">${fmt.compact(g.players)}</span>
        <span class="cell__k">Playing</span>
      </span>
      <span class="cell cell--clicks">
        <span class="cell__v">${fmt.compact(g.clicks)}</span>
        <span class="cell__k">Clicks</span>
      </span>
      <span class="row-game__stats-m">
        <span><b>${fmt.compact(g.players)}</b> playing</span>
        <span><b>${fmt.compact(g.clicks)}</b> clicks</span>
      </span>
      <span class="row-game__cta">
        <span class="btn btn--soft btn--sm">Outbid ${fmt.money((g.activeBid ?? g.bid) + 5)}</span>
      </span>
    </a>`;
  }

  function board(list, { showHead = true, compact = false } = {}) {
    if (!list.length) return emptyState('No games here yet', 'Be the first to list a game in this ranking.');
    return `<div class="board${compact ? ' board--compact' : ''}">
      ${showHead ? `<div class="board__head">
        <span>Rank</span><span>Game</span><span>Bid</span><span>Playing</span><span>Clicks</span><span></span>
      </div>` : ''}
      ${list.map(row).join('')}
    </div>`;
  }

  /* ------------------------------------------------------------ Game card */
  function card(g) {
    return `
    <a class="card card--hover gcard reveal" href="${gameUrl(g)}">
      <span class="gcard__top">
        ${g.rank ? `<span class="gcard__rank">#${g.rank}</span>` : ''}
        <span class="gcard__live"><i class="pulse"></i>${fmt.compact(g.players)}</span>
        ${thumb(g)}
      </span>
      <span>
        <span class="gcard__name">${esc(g.name)}</span>
        <span class="gcard__group">${esc(g.group)}</span>
      </span>
      <span class="gcard__stats">
        <span class="gcard__stat"><b>${fmt.compact(g.players)}</b><span>Playing</span></span>
        <span class="gcard__stat"><b>${fmt.compact(g.visits)}</b><span>Visits</span></span>
        <span class="gcard__stat"><b>${fmt.compact(g.clicks)}</b><span>Clicks</span></span>
      </span>
      <span class="gcard__foot">
        <span class="gcard__bid">${fmt.money(g.activeBid ?? g.bid)}<small>Current bid</small></span>
        <span class="spacer"></span>
        <span class="btn btn--sm">Play</span>
      </span>
    </a>`;
  }

  const cards = (list) => `<div class="grid-games">${list.map(card).join('')}</div>`;

  function emptyState(title, text) {
    return `<div class="card empty">
      <span class="empty__i">🔍</span>
      <h3>${esc(title)}</h3><p>${esc(text)}</p>
      <a class="btn btn--soft" href="games.html">Browse all games</a>
    </div>`;
  }

  /* ------------------------------------------------------------- Sparkline */
  /* history: array of ranks (lower = better) → inverted line chart */
  function sparkline(history, w = 560, h = 160) {
    const max = Math.max(...history), min = Math.min(...history);
    const span = Math.max(1, max - min);
    const pts = history.map((v, i) => {
      const x = (i / (history.length - 1)) * w;
      const y = ((v - min) / span) * (h - 24) + 12;   // lower rank number → higher line
      return [x, y];
    });
    const line = pts.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ');
    const area = `${line} L ${w} ${h} L 0 ${h} Z`;
    const last = pts[pts.length - 1];
    const gridY = [0, .25, .5, .75, 1].map((p) =>
      `<line x1="0" y1="${(h * p).toFixed(1)}" x2="${w}" y2="${(h * p).toFixed(1)}"
             stroke="#ECEFF4" stroke-width="1"/>`).join('');
    return `
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img"
         aria-label="Rank history for the last ${history.length} days">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#0A6CFF" stop-opacity=".22"/>
          <stop offset="1" stop-color="#0A6CFF" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${gridY}
      <path d="${area}" fill="url(#sparkFill)"/>
      <path d="${line}" fill="none" stroke="#0A6CFF" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="5.5" fill="#fff"
              stroke="#0A6CFF" stroke-width="3"/>
    </svg>`;
  }

  /* -------------------------------------------------------------- Chrome */
  const NAV = [
    ['games.html', 'Games', 'games'],
    ['rankings.html', 'Rankings', 'rankings'],
    ['rankings.html?mode=today', 'Today', 'today'],
    ['daily.html', 'Daily', 'daily'],
    ['categories.html', 'Categories', 'categories'],
    ['games.html?filter=trending', 'Trending', 'trending']
  ];

  const MARK = `
    <svg class="brand__mark" viewBox="0 0 32 32" aria-hidden="true">
      <defs><linearGradient id="bbm" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#0A6CFF"/><stop offset="1" stop-color="#00A2FF"/>
      </linearGradient></defs>
      <rect width="32" height="32" rx="8" fill="url(#bbm)"/>
      <rect x="6.5" y="19" width="5.5" height="7" rx="1.7" fill="#fff" opacity=".55"/>
      <rect x="13.25" y="15" width="5.5" height="11" rx="1.7" fill="#fff" opacity=".8"/>
      <rect x="20" y="11" width="5.5" height="15" rx="1.7" fill="#fff"/>
      <path d="M20 9.4 L22.75 6.1 L25.5 9.4" fill="none" stroke="#fff" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  const ICON_SEARCH = `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="2"/>
    <path d="M13.5 13.5L17 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

  function mountChrome(active) {
    const nav = `
    <header class="nav" id="nav">
      <div class="wrap nav__inner">
        <a class="brand" href="index.html" aria-label="BloxBid.lol home">
          ${MARK}<span class="brand__text">BloxBid<span class="dot">.lol</span></span>
        </a>
        <nav class="nav__links" aria-label="Main">
          ${NAV.map(([href, label, key]) =>
            `<a class="nav__link" href="${href}"${key === active ? ' aria-current="page"' : ''}>${label}</a>`
          ).join('')}
        </nav>
        <div class="nav__actions">
          <button class="nav__search" data-search-open aria-label="Search games">
            ${ICON_SEARCH}<span>Search games</span><kbd>/</kbd>
          </button>
          <a class="btn" href="list.html">List Your Game</a>
          <button class="nav__burger" data-drawer-toggle aria-label="Menu" aria-expanded="false">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </header>
    <div class="drawer" id="drawer" data-open="false">
      ${NAV.map(([href, label, key]) =>
        `<a href="${href}"${key === active ? ' aria-current="page"' : ''}>${label}
           <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
             <path d="M7 4l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
         </a>`).join('')}
      <a href="dashboard.html">Developer Dashboard</a>
      <a class="btn btn--lg btn--block" href="list.html">List Your Game</a>
    </div>`;

    const footer = `
    <footer class="footer">
      <div class="wrap">
        <div class="footer__grid">
          <div>
            <a class="brand" href="index.html">${MARK}<span class="brand__text">BloxBid<span class="dot">.lol</span></span></a>
            <p class="footer__tag">The leaderboard where Roblox games compete for #1. Rank is what you pay.</p>
          </div>
          <div><h4>Explore</h4><ul>
            <li><a href="games.html">Games</a></li>
            <li><a href="rankings.html">Rankings</a></li>
            <li><a href="rankings.html?mode=today">Today</a></li>
            <li><a href="daily.html">Daily</a></li>
            <li><a href="categories.html">Categories</a></li>
          </ul></div>
          <div><h4>Product</h4><ul>
            <li><a href="list.html">List Your Game</a></li>
            <li><a href="dashboard.html">Dashboard</a></li>
            <li><a href="info.html#rules">Rules</a></li>
            <li><a href="info.html#faq">FAQ</a></li>
          </ul></div>
          <div><h4>Legal</h4><ul>
            <li><a href="info.html#privacy">Privacy</a></li>
            <li><a href="info.html#terms">Terms</a></li>
            <li><a href="info.html#contact">Contact</a></li>
          </ul></div>
        </div>
        <div class="footer__bottom">
          <span>© ${new Date().getFullYear()} BloxBid.lol — Where Roblox games compete.</span>
          <span>Not affiliated with, endorsed by or sponsored by Roblox Corporation.</span>
        </div>
      </div>
    </footer>`;

    const overlay = `
    <div class="search-overlay" id="searchOverlay" data-open="false" role="dialog" aria-modal="true" aria-label="Search">
      <div class="search-box">
        <div class="search-box__field">
          ${ICON_SEARCH}
          <input id="searchInput" type="search" placeholder="Search a game, creator, group or genre…"
                 autocomplete="off" spellcheck="false">
          <button class="badge badge--outline" data-search-close>ESC</button>
        </div>
        <div class="search-results" id="searchResults"></div>
        <div class="search-box__foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
    <div class="toast-wrap" id="toasts" aria-live="polite"></div>`;

    document.body.insertAdjacentHTML('afterbegin', nav);
    document.body.insertAdjacentHTML('beforeend', footer + overlay);
    wireChrome();
  }

  /* ------------------------------------------------------- Chrome wiring */
  function wireChrome() {
    const nav = el('#nav');
    const onScroll = () => nav.dataset.scrolled = window.scrollY > 8;
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });

    const drawer = el('#drawer');
    el('[data-drawer-toggle]').addEventListener('click', (e) => {
      const open = drawer.dataset.open !== 'true';
      drawer.dataset.open = open;
      e.currentTarget.setAttribute('aria-expanded', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });

    /* Search overlay */
    const ov = el('#searchOverlay');
    const input = el('#searchInput');
    const results = el('#searchResults');
    let active = 0, hits = [];

    const render = (q) => {
      const query = q.trim().toLowerCase();
      const pool = D.ranked();
      hits = (query
        ? pool.filter((g) =>
            [g.name, g.creator, g.group, g.genre, g.subgenre].some((f) => f.toLowerCase().includes(query)))
        : pool.slice(0, 6)).slice(0, 8);
      active = 0;
      results.innerHTML = hits.length
        ? hits.map((g, i) => `
          <a class="search-hit" href="${gameUrl(g)}" data-active="${i === 0}">
            ${thumb(g, 'thumb--sq')}
            <span>
              <span class="search-hit__name">${esc(g.name)}</span>
              <span class="search-hit__sub">${esc(g.group)} · ${fmt.compact(g.players)} playing · ${fmt.compact(g.visits)} visits</span>
            </span>
            <span class="badge badge--blue">#${g.rank}</span>
          </a>`).join('')
        : `<div class="search-empty">No games match “${esc(q)}”.<br>Try a creator, group or genre.</div>`;
    };

    const open = () => {
      ov.dataset.open = 'true';
      document.body.style.overflow = 'hidden';
      render(input.value = '');
      setTimeout(() => input.focus(), 20);
    };
    const close = () => { ov.dataset.open = 'false'; document.body.style.overflow = ''; };

    els('[data-search-open]').forEach((b) => b.addEventListener('click', open));
    els('[data-search-close]').forEach((b) => b.addEventListener('click', close));
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
    input.addEventListener('input', (e) => render(e.target.value));

    input.addEventListener('keydown', (e) => {
      if (!hits.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        active = (active + (e.key === 'ArrowDown' ? 1 : hits.length - 1)) % hits.length;
        els('.search-hit', results).forEach((n, i) => n.dataset.active = i === active);
        els('.search-hit', results)[active].scrollIntoView({ block: 'nearest' });
      }
      if (e.key === 'Enter') { e.preventDefault(); location.href = gameUrl(hits[active]); }
    });

    addEventListener('keydown', (e) => {
      const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
      if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key === 'k')) { e.preventDefault(); open(); }
      if (e.key === 'Escape') { close(); els('.modal[data-open="true"]').forEach((m) => m.dataset.open = 'false'); }
    });

    revealOn();
  }

  /* ------------------------------------------------------------- Reveal */
  function revealOn(root = document) {
    const targets = els('.reveal:not([data-in])', root);
    if (!targets.length) return;

    /* Motion off: show everything immediately. */
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      targets.forEach((n) => n.dataset.in = 'true');
      return;
    }

    /* A rAF-throttled geometry check rather than IntersectionObserver: entries can be
       delivered in bursts during fast scrolling and leave whole grids stuck at opacity 0.
       Anything at or above the viewport bottom is revealed, so scrolling past never
       strands content. */
    let queue = targets, ticking = false;

    const check = () => {
      ticking = false;
      const limit = innerHeight * 0.92;
      let delay = 0;
      queue = queue.filter((n) => {
        if (n.getBoundingClientRect().top >= limit) return true;
        setTimeout(() => n.dataset.in = 'true', (delay = Math.min(delay + 40, 240)));
        return false;
      });
      if (!queue.length) {
        removeEventListener('scroll', onScroll);
        removeEventListener('resize', onScroll);
      }
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(check); } };

    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    check();
  }

  /* -------------------------------------------------------------- Toasts */
  function toast(html, ms = 3200) {
    const wrap = el('#toasts');
    if (!wrap) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = html;
    wrap.appendChild(t);
    setTimeout(() => {
      t.style.transition = 'opacity .3s, transform .3s';
      t.style.opacity = '0'; t.style.transform = 'translateY(10px)';
      setTimeout(() => t.remove(), 320);
    }, ms);
  }

  /* -------------------------------------------- Animated numeric counters */
  function countUp(node, to, { prefix = '', compact = false, ms = 900 } = {}) {
    const from = 0, t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(from + (to - from) * eased);
      node.textContent = prefix + (compact ? fmt.compact(v) : fmt.full(v));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* --------------------------------------------- Click counter (PLAY btn) */
  const CLICK_KEY = 'bloxbid:clicks';
  const readClicks = () => { try { return JSON.parse(localStorage.getItem(CLICK_KEY)) || {}; } catch { return {}; } };
  function registerClick(g) {
    const store = readClicks();
    store[g.id] = (store[g.id] || 0) + 1;
    try { localStorage.setItem(CLICK_KEY, JSON.stringify(store)); } catch {}
    return store[g.id];
  }
  const localClicks = (g) => g.clicks + (readClicks()[g.id] || 0);

  window.BB = {
    fmt, el, els, esc, params, gameUrl, robloxUrl, thumb, thumbStyle, movement,
    row, board, card, cards, emptyState, sparkline, mountChrome, revealOn,
    toast, countUp, registerClick, localClicks
  };
})();
