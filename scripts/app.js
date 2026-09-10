/* ==========================================================================
   BloxBid — page controllers
   ========================================================================== */
(function () {
  const D = window.BB_DATA;
  const { fmt, el, els, esc, params, thumb, gameUrl, robloxUrl, board, cards, card,
          sparkline, mountChrome, revealOn, toast, countUp, registerClick, localClicks } = window.BB;

  const page = document.body.dataset.page;
  mountChrome(document.body.dataset.nav || page);

  const MIN_INCREMENT = 5;
  const byId = (id) => D.GAMES.find((g) => g.id === id);
  const rankOf = (id, mode = 'all-time') => D.ranked(mode).find((g) => g.id === id);

  /* ------------------------------------------------- Midnight UTC countdown */
  function untilMidnightUTC() {
    const now = new Date();
    const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    const diff = next - now.getTime();
    const h = Math.floor(diff / 3.6e6), m = Math.floor(diff / 6e4) % 60, s = Math.floor(diff / 1e3) % 60;
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  }
  function bindCountdown(node, label = 'Daily board resets in') {
    if (!node) return;
    const tick = () => node.innerHTML = `<span class="badge badge--outline">UTC</span> ${label} <b>${untilMidnightUTC()}</b>`;
    tick(); setInterval(tick, 1000);
  }

  /* --------------------------------------------------------- Outbid modal */
  function outbidModal(game, mode = 'all-time') {
    const g = rankOf(game.id, mode);
    const leader = D.ranked(mode)[0];
    const target = g.rank === 1 ? g.activeBid + MIN_INCREMENT : leader.activeBid + MIN_INCREMENT;
    const host = document.createElement('div');
    host.className = 'modal';
    host.dataset.open = 'true';
    host.innerHTML = `
      <div class="modal__panel" role="dialog" aria-modal="true" aria-label="Outbid ${esc(g.name)}">
        <div class="row row--between" style="margin-bottom:18px">
          <span class="eyebrow">Outbid</span>
          <button class="badge badge--outline" data-close>ESC</button>
        </div>
        <div class="row" style="gap:14px;margin-bottom:20px">
          ${thumb(g, 'thumb--sq')}
          <div style="min-width:0">
            <div style="font-weight:700;letter-spacing:-.02em">${esc(g.name)}</div>
            <div style="font-size:var(--t-xs);color:var(--text-muted)">${esc(g.group)} · currently #${g.rank}</div>
          </div>
        </div>
        <div class="bidpanel__grid" style="margin-bottom:18px">
          <div class="minibox"><b>${fmt.money(g.activeBid)}</b><span>Current bid</span></div>
          <div class="minibox"><b>${fmt.money(leader.activeBid)}</b><span>#1 bid</span></div>
        </div>
        <div class="field" style="margin-bottom:8px">
          <label class="field__label" for="bidAmt">Your new bid</label>
          <div class="input-wrap"><span style="font-weight:800;color:var(--text-subtle)">$</span>
            <input id="bidAmt" type="number" min="${g.activeBid + MIN_INCREMENT}" step="${MIN_INCREMENT}" value="${target}">
          </div>
          <span class="field__hint">Minimum raise is ${fmt.money(MIN_INCREMENT)} over the position you want to take.</span>
        </div>
        <div id="bidPreview" class="msg msg--ok" style="margin:14px 0 18px"></div>
        <button class="btn btn--lg btn--block" data-confirm>Outbid for <span id="bidBtnAmt">${fmt.money(target)}</span></button>
        <p class="play-note" style="margin-top:12px">Prototype only — no payment is processed.</p>
      </div>`;
    document.body.appendChild(host);
    document.body.style.overflow = 'hidden';

    const input = el('#bidAmt', host);
    const preview = el('#bidPreview', host);
    const btnAmt = el('#bidBtnAmt', host);

    const refresh = () => {
      const v = Number(input.value) || 0;
      const projected = D.ranked(mode).filter((x) => x.activeBid >= v && x.id !== g.id).length + 1;
      btnAmt.textContent = fmt.money(v);
      preview.className = 'msg ' + (projected < g.rank ? 'msg--ok' : 'msg--err');
      preview.innerHTML = projected < g.rank
        ? `✓ This bid takes you from #${g.rank} to <b style="margin-left:4px">#${projected}</b>`
        : `Not enough to move up — you would stay at #${projected}.`;
    };
    refresh();
    input.addEventListener('input', refresh);

    const close = () => { host.remove(); document.body.style.overflow = ''; };
    el('[data-close]', host).addEventListener('click', close);
    host.addEventListener('click', (e) => { if (e.target === host) close(); });
    el('[data-confirm]', host).addEventListener('click', () => {
      const v = Number(input.value) || 0;
      const projected = D.ranked(mode).filter((x) => x.activeBid >= v && x.id !== g.id).length + 1;
      close();
      toast(`🎉 <span><b>${esc(g.name)}</b> is now <b>#${projected}</b> with a ${fmt.money(v)} bid.</span>`);
    });
  }

  /* Delegate every "Outbid" affordance inside leaderboard rows */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.row-game__cta .btn, [data-outbid]');
    if (!btn) return;
    const rowLink = btn.closest('a[href^="game.html"]');
    const id = btn.dataset.outbid || (rowLink && new URL(rowLink.href, location.href).searchParams.get('g'));
    const g = byId(id);
    if (!g) return;
    e.preventDefault();
    outbidModal(g, document.body.dataset.mode || 'all-time');
  });

  /* -------------------------------------------------------- PLAY tracking */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-play]');
    if (!a) return;
    e.preventDefault();
    const g = byId(a.dataset.play);
    const total = registerClick(g);
    const counter = el('#clickCount');
    if (counter) counter.textContent = fmt.full(localClicks(g));
    toast(`✅ <span>Click registered — redirecting to Roblox. <b>${fmt.full(total)}</b> from this device.</span>`, 2600);
    setTimeout(() => window.open(robloxUrl(g), '_blank', 'noopener'), 420);
  });

  /* ============================================================== LIVE BAR */
  function liveBar(node) {
    if (!node) return;
    const totals = D.GAMES.reduce((a, g) => ({
      players: a.players + g.players,
      visits: a.visits + g.visits,
      bids: a.bids + g.bid
    }), { players: 0, visits: 0, bids: 0 });

    let browsing = 640 + Math.floor(Math.random() * 60);
    const cells = [
      ['People on BloxBid', () => fmt.full(browsing), 'browsing right now', true],
      ['Players Online', () => fmt.compact(totals.players), 'across listed games'],
      ['Games Listed', () => fmt.full(D.GAMES.length), 'and growing daily'],
      ['Game Visits', () => fmt.compact(totals.visits), 'all-time combined'],
      ['Total Bids', () => fmt.money(totals.bids), 'live on the board']
    ];
    node.innerHTML = cells.map(([k, v, d, hero]) => `
      <div class="livebar__cell${hero ? ' livebar__cell--hero' : ''}">
        <span class="livebar__k">${hero ? '<i class="pulse" style="color:var(--danger)"></i>' : ''}${k}</span>
        <span class="livebar__v" data-live>${v()}</span>
        <span class="livebar__d">${d}</span>
      </div>`).join('');

    const nodes = els('[data-live]', node);
    setInterval(() => {
      browsing = Math.max(480, browsing + Math.round((Math.random() - 0.45) * 14));
      totals.players += Math.round((Math.random() - 0.4) * 900);
      totals.visits += Math.round(Math.random() * 40000);
      const i = Math.floor(Math.random() * 4);
      nodes[0].textContent = fmt.full(browsing);
      nodes[1].textContent = fmt.compact(totals.players);
      nodes[3].textContent = fmt.compact(totals.visits);
      nodes[i].classList.remove('tick');
      void nodes[i].offsetWidth;
      nodes[i].classList.add('tick');
    }, 2600);
  }

  /* =========================================================== ACTIVITY FEED */
  function activityFeed(node, n = 7) {
    if (!node) return;
    const pool = D.ranked();
    const make = (age) => {
      const g = pool[Math.floor(Math.random() * Math.min(16, pool.length))];
      const t = D.ACTIVITY_TEMPLATES[Math.floor(Math.random() * D.ACTIVITY_TEMPLATES.length)];
      const amt = g.bid + MIN_INCREMENT * (1 + Math.floor(Math.random() * 6));
      return `<div class="feed__item">
        <span class="feed__dot">${t.icon}</span>
        <span class="feed__txt">${t.text(g, fmt.full(amt))}</span>
        <span class="feed__time">${age}</span>
      </div>`;
    };
    node.innerHTML = Array.from({ length: n }, (_, i) => make(`${i * 3 + 2}m`)).join('');
    setInterval(() => {
      node.insertAdjacentHTML('afterbegin', make('now'));
      if (node.children.length > n) node.lastElementChild.remove();
    }, 4200);
  }

  /* ============================================================ CATEGORIES */
  const catCount = (slug) => D.GAMES.filter((g) => g.categorySlug === slug).length;

  function categoryTiles(node, list = D.CATEGORIES) {
    if (!node) return;
    node.innerHTML = list.map((c) => `
      <a class="cat reveal" href="categories.html?c=${c.slug}">
        <span class="cat__icon">${c.icon}</span>
        <span>
          <span class="cat__name">${c.name}</span>
          <span class="cat__count">${catCount(c.slug)} games</span>
        </span>
      </a>`).join('');
    revealOn(node);
  }

  /* ============================================================== CHAMPIONS */
  function champions(node, list = D.CHAMPIONS) {
    if (!node) return;
    node.innerHTML = list.map((c) => `
      <a class="card card--hover champ reveal" href="${gameUrl(c.game)}">
        <span class="champ__date">${c.date} <span class="badge badge--blue">#1</span></span>
        <span class="champ__body">
          <span class="champ__crown">👑</span>
          <span style="min-width:0">
            <span class="champ__name">${esc(c.game.name)}</span>
            <span class="champ__meta">${esc(c.game.group)}</span>
          </span>
        </span>
        <span class="champ__foot">
          <span>Winning bid <b>${fmt.money(c.heldBid)}</b></span>
          <span>${fmt.compact(c.clicks)} clicks</span>
        </span>
      </a>`).join('');
    revealOn(node);
  }

  /* ================================================================ PAGES */
  const PAGES = {
    /* ------------------------------------------------------------- HOME */
    home() {
      liveBar(el('#livebar'));
      activityFeed(el('#feed'));
      categoryTiles(el('#catGrid'), D.CATEGORIES.slice(0, 12));
      champions(el('#champs'));

      const tabs = el('#modeTabs'), out = el('#homeBoard');
      const draw = (mode) => {
        document.body.dataset.mode = mode;
        out.innerHTML = board(D.ranked(mode).slice(0, 10));
        el('#modeNote').innerHTML = mode === 'today'
          ? `<span class="badge badge--outline">UTC</span> Resets in <b style="margin-left:4px">${untilMidnightUTC()}</b>`
          : 'Ranked by highest all-time bid';
      };
      draw('all-time');
      tabs.addEventListener('click', (e) => {
        const b = e.target.closest('[data-mode]'); if (!b) return;
        els('[data-mode]', tabs).forEach((x) => x.setAttribute('aria-selected', x === b));
        draw(b.dataset.mode);
      });

      el('#trendingGrid').innerHTML = cards(D.FEEDS.trending(D.ranked()).slice(0, 4));
      el('#risingGrid').innerHTML = cards(D.FEEDS.rising(D.ranked()).slice(0, 4));
      el('#mostPlayed').innerHTML = board(
        D.FEEDS['most-players'](D.ranked()).slice(0, 5), { showHead: false, compact: true });
      revealOn();
    },

    /* ------------------------------------------------------------ GAMES */
    games() {
      const chips = el('#filterChips'), out = el('#gamesGrid'), count = el('#gamesCount');
      let current = params.get('filter') || 'trending';

      chips.innerHTML = D.FILTERS.map(([k, label, icon]) =>
        `<button class="chip" data-filter="${k}" aria-pressed="${k === current}">${icon} ${label}</button>`).join('');

      const draw = () => {
        const list = D.FEEDS[current](D.ranked());
        out.innerHTML = cards(list);
        count.textContent = `${list.length} games`;
        el('#filterTitle').textContent = D.FILTERS.find(([k]) => k === current)[1];
        revealOn(out);
      };
      draw();

      chips.addEventListener('click', (e) => {
        const b = e.target.closest('[data-filter]'); if (!b) return;
        current = b.dataset.filter;
        els('[data-filter]', chips).forEach((x) => x.setAttribute('aria-pressed', x === b));
        history.replaceState(null, '', `games.html?filter=${current}`);
        draw();
      });
    },

    /* --------------------------------------------------------- RANKINGS */
    rankings() {
      let mode = params.get('mode') === 'today' ? 'today' : 'all-time';
      let cat = params.get('c') || 'all';
      const out = el('#fullBoard');
      bindCountdown(el('#resetNote'));

      el('#catFilter').innerHTML =
        `<button class="chip" data-cat="all" aria-pressed="true">🌐 All Roblox games</button>` +
        D.CATEGORIES.map((c) => `<button class="chip" data-cat="${c.slug}">${c.icon} ${c.name}</button>`).join('');

      const draw = () => {
        document.body.dataset.mode = mode;
        const pool = cat === 'all' ? D.GAMES : D.GAMES.filter((g) => g.categorySlug === cat);
        out.innerHTML = board(D.ranked(mode, pool));
        el('#boardScope').textContent = cat === 'all'
          ? 'All Roblox games' : D.CATEGORIES.find((c) => c.slug === cat).name;
        el('#boardCount').textContent = `${pool.length} listed`;
        els('[data-cat]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.cat === cat));
        els('[data-mode]').forEach((x) => x.setAttribute('aria-selected', x.dataset.mode === mode));
      };
      draw();

      el('#modeTabs').addEventListener('click', (e) => {
        const b = e.target.closest('[data-mode]'); if (!b) return;
        mode = b.dataset.mode; draw();
      });
      el('#catFilter').addEventListener('click', (e) => {
        const b = e.target.closest('[data-cat]'); if (!b) return;
        cat = b.dataset.cat; draw();
      });
    },

    /* ------------------------------------------------------- CATEGORIES */
    categories() {
      const slug = params.get('c');
      if (!slug) { categoryTiles(el('#allCats')); return; }

      const c = D.CATEGORIES.find((x) => x.slug === slug);
      if (!c) { categoryTiles(el('#allCats')); return; }

      el('#catAll').hidden = true;
      el('#catOne').hidden = false;
      el('#catTitle').textContent = c.name;
      el('#catTitleCrumb').textContent = c.name;
      document.title = `${c.name} — BloxBid.lol`;
      el('#catIcon').textContent = c.icon;
      el('#catDesc').textContent =
        `Every ${c.name} experience listed on BloxBid, ranked by bid. Switch between the all-time board and today's board.`;

      const pool = D.GAMES.filter((g) => g.categorySlug === slug);
      let mode = 'all-time';
      const draw = () => {
        document.body.dataset.mode = mode;
        el('#catBoard').innerHTML = board(D.ranked(mode, pool));
        el('#catCount').textContent = `${pool.length} games`;
      };
      draw();
      el('#catModeTabs').addEventListener('click', (e) => {
        const b = e.target.closest('[data-mode]'); if (!b) return;
        els('[data-mode]').forEach((x) => x.setAttribute('aria-selected', x === b));
        mode = b.dataset.mode; draw();
      });
      el('#catOther').innerHTML = D.CATEGORIES.filter((x) => x.slug !== slug).map((x) =>
        `<a class="chip" href="categories.html?c=${x.slug}">${x.icon} ${x.name}</a>`).join('');
    },

    /* -------------------------------------------------------------- GAME */
    game() {
      const g = rankOf(params.get('g')) || D.ranked()[0];
      const today = rankOf(g.id, 'today');
      document.title = `${g.name} — BloxBid.lol`;

      el('#gThumb').outerHTML = thumb(g, 'gamehead__thumb');
      el('#gName').textContent = g.name;
      el('#gCrumbCat').textContent = g.genre;
      el('#gCrumbCat').href = `categories.html?c=${g.categorySlug}`;
      el('#gCrumbName').textContent = g.name;
      el('#gCreator').textContent = g.creator;
      el('#gGroup').textContent = g.group;
      el('#gDesc').textContent = g.desc;
      el('#gTags').innerHTML = [
        `<span class="badge badge--blue">${esc(g.genre)}</span>`,
        `<span class="badge">${esc(g.subgenre)}</span>`,
        `<span class="badge">Server size ${g.serverSize}</span>`,
        `<span class="badge badge--up">${g.rating}% rating</span>`
      ].join('');

      /* Bid panel */
      el('#gRank').textContent = g.rank;
      el('#gRank').className = 'rank' + (g.rank <= 3 ? ` rank--${g.rank}` : '');
      el('#gRankToday').textContent = `#${today.rank} today`;
      el('#gBid').textContent = fmt.money(g.bid);
      const leader = D.ranked()[0];
      el('#gHint').innerHTML = g.rank === 1
        ? `Holding <b>#1</b>. Nearest challenger is ${fmt.money(D.ranked()[1].bid)}.`
        : `Take <b>#1</b> with ${fmt.money(leader.bid + MIN_INCREMENT)} — that's ${fmt.money(leader.bid + MIN_INCREMENT - g.bid)} more than your bid.`;
      el('#gOutbid').innerHTML = `Outbid for ${fmt.money(leader.bid + MIN_INCREMENT)}`;
      el('#gOutbid').dataset.outbid = g.id;
      el('#clickCount').textContent = fmt.full(localClicks(g));
      el('#gPlayers').textContent = fmt.compact(g.players);
      el('#gPlay').dataset.play = g.id;

      /* Roblox stats */
      el('#gStats').innerHTML = [
        ['Playing now', fmt.full(g.players)],
        ['Visits', fmt.full(g.visits)],
        ['Favorites', fmt.full(g.favorites)],
        ['Rating', g.rating + '%'],
        ['Server size', g.serverSize],
        ['BloxBid clicks', fmt.full(localClicks(g))]
      ].map(([k, v]) => `
        <div class="card stat-tile reveal">
          <span class="stat-tile__k">${k}</span>
          <span class="stat-tile__v">${v}</span>
        </div>`).join('');

      /* Rank history */
      el('#gChart').innerHTML = sparkline(g.history);
      const best = Math.min(...g.history), worst = Math.max(...g.history);
      el('#gChartMeta').innerHTML = `
        <span><i style="background:#0A6CFF"></i>Rank position (lower is better)</span>
        <span>Best <b>#${best}</b></span><span>Worst <b>#${worst}</b></span>
        <span>Outbid <b>${g.outbidCount}×</b></span>`;

      /* Similar games */
      const similar = D.ranked().filter((x) => x.categorySlug === g.categorySlug && x.id !== g.id).slice(0, 4);
      el('#gSimilar').innerHTML = similar.length
        ? cards(similar) : cards(D.ranked().filter((x) => x.id !== g.id).slice(0, 4));
      el('#gSimilarTitle').textContent = similar.length ? `More in ${g.genre}` : 'Top games on BloxBid';
      revealOn();
    },

    /* -------------------------------------------------------------- LIST */
    list() {
      const input = el('#gameUrl'), wrap = el('#urlWrap'), msg = el('#urlMsg'), submit = el('#detectBtn');
      const preview = el('#preview');

      /* Only official Roblox experience URLs are accepted.
         Matched on the parsed hostname, never as a substring — "roblox.com" itself
         ends in "x.com", so naive blocklists reject every valid link. */
      const BLOCKED = ['discord.gg', 'discord.com', 'youtube.com', 'youtu.be', 'tiktok.com',
                       'instagram.com', 'twitter.com', 'x.com', 'linktr.ee', 'facebook.com',
                       'twitch.tv', 'linktree.com'];

      const validate = (v) => {
        const s = v.trim();
        if (!s) return { state: '', msg: '' };
        let u;
        try { u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); }
        catch { return { state: 'error', msg: 'That does not look like a valid link.' }; }

        const host = u.hostname.toLowerCase().replace(/^www\./, '');
        if (BLOCKED.includes(host))
          return { state: 'error', msg: 'Only official Roblox experience links are allowed — no social or custom URLs.' };
        if (host !== 'roblox.com')
          return { state: 'error', msg: 'That is not a Roblox experience URL. Expected roblox.com/games/…' };
        if (!/^\/games\/\d+/.test(u.pathname))
          return { state: 'error', msg: 'Link a specific experience: roblox.com/games/<id>/<name>' };
        return { state: 'ok', msg: 'Valid Roblox experience link detected.' };
      };

      const refresh = () => {
        const r = validate(input.value);
        wrap.dataset.state = r.state;
        msg.className = 'msg ' + (r.state === 'error' ? 'msg--err' : r.state === 'ok' ? 'msg--ok' : '');
        msg.innerHTML = r.msg ? `${r.state === 'ok' ? '✓' : '✕'} ${esc(r.msg)}` : '';
        submit.disabled = r.state !== 'ok';
      };
      input.addEventListener('input', refresh);
      refresh();

      el('#sampleLink').addEventListener('click', () => {
        input.value = 'https://www.roblox.com/games/1962086868/Tower-Escape-Ultimate';
        refresh(); input.focus();
      });

      submit.addEventListener('click', () => {
        preview.hidden = false;
        preview.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setStep(2);

        const g = D.ranked()[0];
        const fields = [
          ['Game name', g.name], ['Creator', g.creator], ['Group', g.group, true],
          ['Genre', g.genre], ['Subgenre', g.subgenre],
          ['Playing now', fmt.full(g.players)], ['Visits', fmt.compact(g.visits)],
          ['Favorites', fmt.compact(g.favorites)]
        ];
        el('#detectedThumb').outerHTML = thumb(g, 'detected__thumb');
        el('#detectedName').textContent = g.name;
        el('#detectedSub').textContent = `${g.creator} · ${g.genre}`;
        el('#detectedGrid').innerHTML = fields.map(([k, v, lock]) => `
          <div class="detected__f${lock ? ' detected__f--lock' : ''}">
            <span>${k}</span><b class="skel">${esc(String(v))}</b>
          </div>`).join('');

        /* Simulated autodetect: fields resolve one by one */
        els('#detectedGrid b').forEach((b, i) => setTimeout(() => {
          b.classList.remove('skel');
          if (fields[i][2]) b.innerHTML = `${esc(fields[i][1])} <span class="badge badge--up" title="Verified from the Roblox API">🔒 verified</span>`;
        }, 260 + i * 130));
        setTimeout(() => { setStep(3); el('#publishBtn').disabled = false; }, 260 + fields.length * 130);
      });

      el('#publishBtn').addEventListener('click', () => {
        toast('🚀 <span>Game listed. You entered the board at <b>#12</b> — raise your bid to climb.</span>', 4200);
        setTimeout(() => location.href = 'dashboard.html', 1400);
      });

      function setStep(n) {
        els('.step').forEach((s, i) =>
          s.dataset.state = i + 1 < n ? 'done' : i + 1 === n ? 'active' : '');
      }
      setStep(1);
    },

    /* --------------------------------------------------------- DASHBOARD */
    dashboard() {
      const g = rankOf(params.get('g') || D.ranked()[2].id);
      const beater = D.ranked()[g.rank - 2] || D.ranked()[0];

      el('#dThumb').outerHTML = thumb(g, 'mygame__thumb');
      el('#dName').textContent = g.name;
      el('#dGroup').textContent = `${g.group} · ${g.genre}`;
      el('#dOutbidBtn').dataset.outbid = g.id;
      el('#dPlay').dataset.play = g.id;
      el('#dGameLink').href = gameUrl(g);

      el('#kpis').innerHTML = [
        ['Current rank', '#' + g.rank, `${g.rank === 1 ? 'Holding the top spot' : `${fmt.money(D.ranked()[0].bid + MIN_INCREMENT - g.bid)} from #1`}`],
        ['Current bid', fmt.money(g.bid), 'All-time board'],
        ['BloxBid clicks', fmt.compact(localClicks(g)), 'Sent to Roblox'],
        ['Players', fmt.compact(g.players), 'Live on Roblox'],
        ['Visits', fmt.compact(g.visits), 'All-time']
      ].map(([k, v, d]) => `
        <div class="card stat-tile reveal">
          <span class="stat-tile__k">${k}</span>
          <span class="stat-tile__v">${v}</span>
          <span class="stat-tile__d">${d}</span>
        </div>`).join('');

      el('#outbidAlert').innerHTML = g.rank === 1 ? `
        <div class="outbid-alert" style="background:var(--success-bg);border-color:#BFE9D5">
          <span class="outbid-alert__i">👑</span>
          <span><b style="color:#0B7A4B">You are #1 right now.</b>
            <p style="color:#0B6B44">Keep an eye on the board — anyone can outbid you at any moment.</p></span>
        </div>` : `
        <div class="outbid-alert">
          <span class="outbid-alert__i">⚔️</span>
          <span>
            <b>${esc(beater.name)} took position #${beater.rank}.</b>
            <p>They bid ${fmt.money(beater.bid)} — that's ${fmt.money(beater.bid - g.bid)} above you. Raise to reclaim it.</p>
          </span>
          <span class="spacer"></span>
          <button class="btn btn--sm" data-outbid="${g.id}">Increase bid</button>
        </div>`;

      el('#dChart').innerHTML = sparkline(g.history);
      el('#dChartMeta').innerHTML =
        `<span><i style="background:#0A6CFF"></i>Your rank, last 14 days</span>
         <span>Best <b>#${Math.min(...g.history)}</b></span>
         <span>Times outbid <b>${g.outbidCount}</b></span>`;

      el('#dHistory').innerHTML = g.history.slice(-8).reverse().map((r, i) => {
        const prev = g.history.slice(-8).reverse()[i + 1];
        const move = prev == null ? 0 : prev - r;
        const d = new Date(); d.setUTCDate(d.getUTCDate() - i);
        return `<tr>
          <td>${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</td>
          <td><b>#${r}</b></td>
          <td>${fmt.money(Math.round(g.bid * (1 - i * 0.04)))}</td>
          <td>${fmt.compact(Math.round(g.clicks / 14 * (1 + i * 0.05)))}</td>
          <td>${move > 0 ? `<span class="badge badge--up">▲ ${move}</span>`
                : move < 0 ? `<span class="badge badge--down">▼ ${-move}</span>`
                : '<span class="badge">—</span>'}</td>
        </tr>`;
      }).join('');

      el('#dSwitch').innerHTML = D.ranked().slice(0, 6).map((x) =>
        `<a class="chip" href="dashboard.html?g=${x.id}"${x.id === g.id ? ' aria-pressed="true"' : ''}>${x.glyph} ${esc(x.name)}</a>`).join('');
      revealOn();
    },

    /* -------------------------------------------------------------- DAILY */
    daily() {
      bindCountdown(el('#dailyCountdown'), 'Today\'s board closes in');
      document.body.dataset.mode = 'today';
      el('#todayBoard').innerHTML = board(D.ranked('today').slice(0, 10));
      const archive = D.CHAMPIONS.concat(D.CHAMPIONS.map((c, i) => ({
        ...c, game: D.GAMES[(i + 7) % D.GAMES.length],
        date: (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - (i + 5));
          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }); })()
      })));
      champions(el('#dailyArchive'), archive);
    },

    info() { /* static content */ }
  };

  (PAGES[page] || (() => {}))();
})();
