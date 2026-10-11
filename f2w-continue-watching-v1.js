(()=>{
  'use strict';
  if (window.__f2wContinueWatchingV6) return;
  window.__f2wContinueWatchingV6 = true;
  window.__f2wContinueWatchingV5 = true;
  window.__f2wContinueWatchingV4 = true;
  window.__f2wContinueWatchingV3 = true;
  window.__f2wContinueWatchingV1 = true;

  const INDEX_KEY = 'f2w_continue_watching_v1';
  const RECENT_KEY = 'flix2watch_recently_viewed';
  const TMDB_KEY = '925c48dd6e24fd5e975fe224238bbb45';
  const MAX_ITEMS = 18;
  const MIN_SECONDS = 30;
  const DONE_RATIO = 0.92;
  const ACCOUNT_TABLE = 'continue_watching_v260';
  let accountSyncUserId = '';
  let accountSyncPromise = null;
  let accountSyncPromiseUserId = '';

  function supabaseClient() {
    return window.f2wSupabase || window.chatSupabase || window.supabaseClient || null;
  }

  async function activeAccountId() {
    try {
      const client = supabaseClient();
      if (!client?.auth?.getSession) return '';
      const { data } = await client.auth.getSession();
      return String(data?.session?.user?.id || '');
    } catch { return ''; }
  }

  function toRemoteRow(item, userId) {
    const mediaId = Number.parseInt(String(item.id || '').replace(/\\D/g, ''), 10);
    if (!userId || !Number.isFinite(mediaId) || mediaId <= 0) return null;
    return {
      user_id: userId,
      media_type: item.type === 'tv' ? 'tv' : 'movie',
      media_id: mediaId,
      season: item.type === 'tv' ? Math.max(1, Number(item.season || 1)) : null,
      episode: item.type === 'tv' ? Math.max(1, Number(item.episode || 1)) : null,
      seconds: Math.max(0, Math.floor(Number(item.seconds || 0))),
      duration: Math.max(0, Math.floor(Number(item.duration || 0))),
      title: String(item.title || '').slice(0, 250),
      poster_path: String(item.poster_path || '').slice(0, 500),
      updated_at: new Date(Number(item.updatedAt || Date.now())).toISOString()
    };
  }

  function fromRemoteRow(row) {
    return {
      id: String(row.media_id),
      type: row.media_type === 'tv' ? 'tv' : 'movie',
      season: row.media_type === 'tv' ? Number(row.season || 1) : null,
      episode: row.media_type === 'tv' ? Number(row.episode || 1) : null,
      seconds: Math.max(0, Number(row.seconds || 0)),
      duration: Math.max(0, Number(row.duration || 0)),
      title: row.title || '',
      poster_path: row.poster_path || '',
      updatedAt: Date.parse(row.updated_at || '') || Date.now()
    };
  }

  async function syncAccountItems(force = false) {
    const client = supabaseClient();
    const userId = await activeAccountId();
    if (!userId || !client?.from) {
      accountSyncUserId = '';
      return false;
    }
    if (!force && accountSyncUserId === userId) return true;
    // A request for the previous account may still be in flight. Wait for it,
    // then start a fresh request for this account rather than reusing its result.
    if (accountSyncPromise) {
      if (accountSyncPromiseUserId === userId) return accountSyncPromise;
      try { await accountSyncPromise; } catch {}
      if ((await activeAccountId()) !== userId) return false;
      if (!force && accountSyncUserId === userId) return true;
    }
    const currentPromise = (async () => {
      const { data, error } = await client.from(ACCOUNT_TABLE).select('*').eq('user_id', userId).order('updated_at', { ascending: false }).limit(MAX_ITEMS);
      if (error) {
        console.warn('Continue Watching account sync unavailable:', error.message || error);
        return false;
      }
      // Never let a slow response for an old session overwrite the local view.
      if ((await activeAccountId()) !== userId) return false;
      const merged = new Map();
      (data || []).map(fromRemoteRow).forEach(item => merged.set(itemKey(item), item));
      // The authenticated account's database rows are authoritative.
      const items = [...merged.values()]
        .filter(item => Number(item.seconds || 0) >= MIN_SECONDS)
        .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
        .slice(0, MAX_ITEMS);
      writeIndex(items);
      const rows = items.map(item => toRemoteRow(item, userId)).filter(Boolean);
      if (rows.length) {
        const saved = await client.from(ACCOUNT_TABLE).upsert(rows, { onConflict: 'user_id,media_type,media_id' });
        if (saved.error) console.warn('Continue Watching upload failed:', saved.error.message || saved.error);
      }
      if ((await activeAccountId()) !== userId) return false;
      accountSyncUserId = userId;
      return true;
    })();
    accountSyncPromise = currentPromise;
    accountSyncPromiseUserId = userId;
    try { return await currentPromise; }
    finally {
      if (accountSyncPromise === currentPromise) {
        accountSyncPromise = null;
        accountSyncPromiseUserId = '';
      }
    }
  }

  async function saveItemToAccount(item) {
    const client = supabaseClient();
    const userId = await activeAccountId();
    if (!userId || !client?.from) return;
    const row = toRemoteRow(item, userId);
    if (!row) return;
    const { error } = await client.from(ACCOUNT_TABLE).upsert(row, { onConflict: 'user_id,media_type,media_id' });
    if (error) console.warn('Continue Watching save failed:', error.message || error);
    else accountSyncUserId = userId;
  }

  function pathNorm() {
    return (location.pathname || '/').replace(/\/+$/, '') || '/';
  }

  /** Only: /home, movies, TV shows, genres — nowhere else */
  function isAllowedPage() {
    const p = pathNorm().toLowerCase();
    if (p === '/' || p === '/home') return true;
    if (p === '/movies' || p.startsWith('/movies/')) return true;
    if (p === '/tv' || p.startsWith('/tv/') || p === '/tv-shows' || p.startsWith('/tv-shows/')) return true;
    if (p === '/series' || p.startsWith('/series/') || p === '/shows' || p.startsWith('/shows/')) return true;
    if (p === '/genre' || p.startsWith('/genre/')) return true;
    if (p === '/genres' || p.startsWith('/genres/')) return true;
    return false;
  }

  function isWatchPage() {
    const p = pathNorm().toLowerCase();
    return p === '/watch' || p.startsWith('/watch/');
  }

  function readIndex() {
    try {
      const arr = JSON.parse(localStorage.getItem(INDEX_KEY) || '[]');
      if (!Array.isArray(arr)) return [];
      // Migrate old entries into one card per movie/show, retaining the
      // newest timestamp and the matching season/episode from that entry.
      const unique = new Map();
      for (const item of arr) {
        const key = itemKey(item);
        if (!key) continue;
        const prev = unique.get(key);
        if (!prev || Number(item.updatedAt || 0) >= Number(prev.updatedAt || 0) ||
            Number(item.seconds || 0) > Number(prev.seconds || 0)) unique.set(key, item);
      }
      const clean = [...unique.values()].sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0));
      if (clean.length !== arr.length) {
        try { localStorage.setItem(INDEX_KEY, JSON.stringify(clean.slice(0, MAX_ITEMS))); } catch {}
      }
      return clean;
    } catch { return []; }
  }

  function writeIndex(arr) {
    try { localStorage.setItem(INDEX_KEY, JSON.stringify(arr.slice(0, MAX_ITEMS))); } catch {}
  }

  function readRecent() {
    try {
      const arr = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }

  function itemKey(it) {
    if (!it) return '';
    if (it.type === 'tv') return 'tv:' + it.id;
    return 'movie:' + it.id;
  }

  function upsertItem(partial) {
    if (!partial || !partial.id || !partial.type) return;
    const seconds = Math.max(0, Math.floor(Number(partial.seconds || 0)));
    const duration = Math.max(0, Math.floor(Number(partial.duration || 0)));
    if (seconds < MIN_SECONDS) return;
    if (duration > 0 && seconds / duration >= DONE_RATIO) {
      writeIndex(readIndex().filter(x => itemKey(x) !== itemKey(partial)));
      return;
    }
    const recent = readRecent();
    const match = recent.find(r => String(r.id) === String(partial.id) && (!r.type || r.type === partial.type))
      || recent.find(r => String(r.id) === String(partial.id));
    const next = {
      id: String(partial.id).replace(/\D/g, '') || String(partial.id),
      type: partial.type === 'tv' ? 'tv' : 'movie',
      season: partial.type === 'tv' ? Number(partial.season || 1) : null,
      episode: partial.type === 'tv' ? Number(partial.episode || 1) : null,
      seconds,
      duration: duration || 0,
      title: partial.title || match?.title || match?.name || '',
      poster_path: partial.poster_path || match?.poster_path || match?.poster || '',
      updatedAt: Date.now()
    };
    const list = readIndex().filter(x => itemKey(x) !== itemKey(next));
    list.unshift(next);
    writeIndex(list);
    saveItemToAccount(next).catch(() => {});
  }

  function syncFromResumeKeys() {
    const recent = readRecent();
    const found = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith('f2w_resume_')) continue;
        const m = k.match(/^f2w_resume_(movie|tv)_([^_]+)(?:_s(\d+)e(\d+))?$/);
        if (!m) continue;
        const seconds = Math.floor(Number(localStorage.getItem(k) || 0));
        if (seconds < MIN_SECONDS) continue;
        const type = m[1];
        const id = String(m[2]).replace(/\D/g, '') || m[2];
        const season = m[3] ? Number(m[3]) : 1;
        const episode = m[4] ? Number(m[4]) : 1;
        const match = recent.find(r => String(r.id) === String(id) && (!r.type || r.type === type))
          || recent.find(r => String(r.id) === String(id));
        found.push({
          id: String(id), type,
          season: type === 'tv' ? season : null,
          episode: type === 'tv' ? episode : null,
          seconds, duration: 0,
          title: match?.title || match?.name || '',
          poster_path: match?.poster_path || match?.poster || '',
          updatedAt: Date.now()
        });
      }
    } catch {}
    if (!found.length) return;
    const map = new Map(readIndex().map(x => [itemKey(x), x]));
    found.forEach(it => {
      const k = itemKey(it);
      const prev = map.get(k);
      if (!prev || Number(it.seconds) >= Number(prev.seconds || 0)) {
        map.set(k, Object.assign({}, prev, it, {
          title: it.title || prev?.title || '',
          poster_path: it.poster_path || prev?.poster_path || ''
        }));
      }
    });
    writeIndex([...map.values()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
  }

  window.addEventListener('message', (event) => {
    try {
      if (event.origin !== 'https://player.flix2watch.com') return;
      const payload = event.data;
      if (!payload || payload.type !== 'PLAYER_EVENT' || !payload.data) return;
      const info = payload.data.player_info || {};
      const status = String(payload.data.player_status || '');
      const progress = Number(payload.data.player_progress || 0);
      const duration = Number(payload.data.player_duration || payload.data.duration || info.duration || 0);
      if (!(status === 'playing' || status === 'paused' || status === 'seeked' || status === 'completed')) return;
      const params = new URLSearchParams(location.search);
      const type = (info.mediaType === 'tv' || params.get('type') === 'tv') ? 'tv' : 'movie';
      let id = String(params.get('id') || '').trim();
      if (info.tmdb) id = String(info.tmdb).replace(/\D/g, '') || id;
      id = String(id).replace(/\D/g, '') || id;
      if (!id) return;
      const season = Number(info.season || params.get('season') || document.getElementById('season-select')?.value || 1);
      const episode = Number(info.episode || params.get('episode') || document.getElementById('episode-select')?.value || 1);
      let title = document.querySelector('h1, .watch-title, #media-title')?.textContent?.trim() || '';
      if (!title || /watch|flix2/i.test(title)) title = document.title.split('|')[0].trim();
      let poster_path = '';
      const og = document.querySelector('meta[property="og:image"]')?.content || '';
      const pm = og.match(/\/t\/p\/\w+(\/[^?\s]+)/);
      if (pm) poster_path = pm[1];
      upsertItem({ id, type, season, episode, seconds: progress, duration, title, poster_path });
    } catch {}
  });

  function snapshotWatchPage() {
    if (!isWatchPage()) return;
    const params = new URLSearchParams(location.search);
    const id = String(params.get('id') || '').replace(/\D/g, '') || params.get('id');
    const type = params.get('type') === 'tv' ? 'tv' : 'movie';
    if (!id) return;
    const season = Number(params.get('season') || document.getElementById('season-select')?.value || 1);
    const episode = Number(params.get('episode') || document.getElementById('episode-select')?.value || 1);
    const key = type === 'tv' ? ('f2w_resume_tv_' + id + '_s' + season + 'e' + episode) : ('f2w_resume_movie_' + id);
    let seconds = Math.floor(Number(localStorage.getItem(key) || 0));
    if (seconds < MIN_SECONDS) {
      const alt = type === 'tv'
        ? ('f2w_resume_tv_' + params.get('id') + '_s' + season + 'e' + episode)
        : ('f2w_resume_movie_' + params.get('id'));
      seconds = Math.floor(Number(localStorage.getItem(alt) || 0));
    }
    if (seconds < MIN_SECONDS) return;
    let title = document.querySelector('h1, .watch-title, #media-title')?.textContent?.trim() || '';
    let poster_path = '';
    const og = document.querySelector('meta[property="og:image"]')?.content || '';
    const pm = og.match(/\/t\/p\/\w+(\/[^?\s]+)/);
    if (pm) poster_path = pm[1];
    upsertItem({ id, type, season, episode, seconds, title, poster_path });
  }

  // Continue Watching is saved from authenticated player progress events.
  // Do not promote shared, device-wide resume keys into a user's account.
  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(Number(sec || 0)));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h) return h + 'h ' + m + 'm';
    if (m) return m + 'm';
    return sec + 's';
  }

  function watchUrl(it) {
    let u = '/watch/?id=' + encodeURIComponent(it.id) + '&type=' + encodeURIComponent(it.type) + '&resume=' + encodeURIComponent(Math.max(0, Math.floor(Number(it.seconds) || 0)));
    if (it.type === 'tv') {
      u += '&season=' + encodeURIComponent(it.season || 1) + '&episode=' + encodeURIComponent(it.episode || 1);
    }
    return u;
  }

  async function fetchTmdb(it) {
    const id = String(it.id || '').replace(/\D/g, '');
    if (!id) return it;
    const tries = it.type === 'tv' ? ['tv', 'movie'] : ['movie', 'tv'];
    for (const path of tries) {
      try {
        const r = await fetch('https://api.themoviedb.org/3/' + path + '/' + id + '?api_key=' + TMDB_KEY + '&language=en-US');
        if (!r.ok) continue;
        const j = await r.json();
        if (!j || (!j.title && !j.name)) continue;
        it.title = j.title || j.name || it.title || 'Untitled';
        it.poster_path = j.poster_path || it.poster_path || '';
        return it;
      } catch {}
    }
    return it;
  }

  async function ensureMeta(items) {
    const need = items.filter(it => !it.title || !it.poster_path);
    await Promise.all(need.slice(0, 12).map(it => fetchTmdb(it)));
    const map = new Map(readIndex().map(x => [itemKey(x), x]));
    items.forEach(it => {
      const prev = map.get(itemKey(it)) || {};
      map.set(itemKey(it), Object.assign({}, prev, it));
    });
    writeIndex([...map.values()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
    return items;
  }

  function ensureStyles() {
    if (document.getElementById('f2w-cw-v1-css')) return;
    const s = document.createElement('style');
    s.id = 'f2w-cw-v1-css';
    s.textContent = `
      #f2w-continue-watching-section{margin:12px 0 18px;padding:0 4px;}
      #f2w-continue-watching-section .section-heading-row{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:12px;}
      #f2w-continue-watching-section .section-kicker{color:#fb923c;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;}
      #f2w-continue-watching-section h2{margin:4px 0 0;font-size:1.35rem;}
      #f2w-continue-watching-strip{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(140px,160px);gap:12px;overflow-x:auto;padding-bottom:8px;scroll-snap-type:x mandatory;}
      .f2w-cw-card{cursor:pointer;scroll-snap-align:start;min-width:0}
      .f2w-cw-poster-shell{position:relative;aspect-ratio:2/3;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,.08);background:#09090d}
      .f2w-cw-card:hover .f2w-cw-poster-shell{border-color:#e50914;box-shadow:0 14px 28px rgba(0,0,0,.45);transform:translateY(-3px);transition:.18s ease}
      .f2w-cw-poster{width:100%;height:100%;object-fit:cover;display:block}
      .f2w-cw-play{position:absolute;right:8px;bottom:18px;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:rgba(229,9,20,.92);color:#fff;font-size:12px}
      .f2w-cw-bar{position:absolute;left:0;right:0;bottom:0;height:4px;background:rgba(255,255,255,.15)}
      .f2w-cw-bar>i{display:block;height:100%;background:linear-gradient(90deg,#e50914,#fb923c)}
      .f2w-cw-title{margin-top:8px;font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .f2w-cw-meta{font-size:11px;color:#94a3b8;margin-top:2px}
      .f2w-cw-empty{color:#64748b;font-size:13px;padding:8px 0}
      .f2w-cw-ph{width:100%;height:100%;display:grid;place-items:center;background:linear-gradient(145deg,#1a1a22,#0d0d12);color:#475569;font-size:28px}
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  function esc(s) {
    return String(s || '').replace(/&/g,'&').replace(/</g,'<').replace(/"/g,'"');
  }

  function posterUrl(path) {
    if (!path) return '';
    const p = String(path);
    if (p.startsWith('http')) return p;
    if (p.startsWith('/')) return 'https://image.tmdb.org/t/p/w342' + p;
    return 'https://image.tmdb.org/t/p/w342/' + p;
  }

  function buildCard(it) {
    const title = it.title || 'Untitled';
    const poster = posterUrl(it.poster_path);
    const pct = it.duration > 0 ? Math.min(99, Math.round((it.seconds / it.duration) * 100)) : 0;
    const ep = it.type === 'tv' ? ('S' + (it.season || 1) + ' E' + (it.episode || 1) + ' · ') : '';
    const meta = ep + 'Resume ' + fmtTime(it.seconds);
    const barW = pct > 0 ? pct : 8;
    const img = poster
      ? '<img class="f2w-cw-poster" src="' + esc(poster) + '" alt="' + esc(title) + '" loading="lazy">'
      : '<div class="f2w-cw-ph">🎬</div>';
    return (
      '<article class="f2w-cw-card" data-cw-url="' + esc(watchUrl(it)) + '" title="' + esc(title) + '">' +
        '<div class="f2w-cw-poster-shell">' + img +
          '<div class="f2w-cw-play"><i class="fa-solid fa-play"></i></div>' +
          '<div class="f2w-cw-bar"><i style="width:' + barW + '%"></i></div>' +
        '</div>' +
        '<div class="f2w-cw-title">' + esc(title) + '</div>' +
        '<div class="f2w-cw-meta">' + esc(meta) + '</div>' +
      '</article>'
    );
  }

  function placeSection(section) {
    const filterTabs = document.querySelector('main .filter-tabs');
    if (filterTabs && filterTabs.parentNode) {
      filterTabs.insertAdjacentElement('afterend', section);
      return;
    }
    const main = document.querySelector('main');
    if (main) {
      const hero = document.getElementById('hero-banner');
      if (hero && hero.parentNode === main) main.insertBefore(section, hero.nextSibling);
      else main.insertBefore(section, main.firstChild);
      return;
    }
    // genre pages etc.
    const content = document.querySelector('.content, .page-content, #content') || document.body;
    content.insertBefore(section, content.firstChild);
  }

  function removeSection() {
    const sec = document.getElementById('f2w-continue-watching-section');
    if (sec) sec.remove();
  }

  async function renderUI() {
    if (!isAllowedPage() || isWatchPage()) {
      removeSection();
      return;
    }

    const userId = await activeAccountId();
    if (!userId) {
      removeSection();
      return;
    }
    const synced = await syncAccountItems();
    // A sign-in can change while the network request is in flight. Do not
    // render another account's cached list, or stale cache after a sync error.
    if (!synced || (await activeAccountId()) !== userId || accountSyncUserId !== userId) {
      removeSection();
      return;
    }
    ensureStyles();

    let items = readIndex().filter(it => Number(it.seconds || 0) >= MIN_SECONDS);
    items = [...new Map(items.map(it => [itemKey(it), it])).values()].slice(0, MAX_ITEMS);
    if (items.length) {
      items = await ensureMeta(items);
      items = [...new Map(readIndex().filter(it => Number(it.seconds || 0) >= MIN_SECONDS).map(it => [itemKey(it), it])).values()].slice(0, MAX_ITEMS);
    }

    let section = document.getElementById('f2w-continue-watching-section');
    if (!section) {
      section = document.createElement('section');
      section.id = 'f2w-continue-watching-section';
      section.className = 'recent-section';
      section.innerHTML =
        '<div class="section-heading-row">' +
          '<div class="section-heading-copy">' +
            '<div class="section-kicker">Pick up where you left off</div>' +
            '<h2>Continue Watching</h2>' +
            '<p>Jump back to the exact moment — movies & episodes, any source.</p>' +
          '</div>' +
          '<span class="glass-chip"><i class="fa-solid fa-play"></i> Resume</span>' +
        '</div>' +
        '<div class="recent-strip" id="f2w-continue-watching-strip"></div>';
      placeSection(section);
    }

    const strip = document.getElementById('f2w-continue-watching-strip');
    if (!strip) return;

    if (!items.length) {
      strip.innerHTML = '<div class="f2w-cw-empty">Start watching a movie or episode — it will show up here so you can resume later.</div>';
      return;
    }

    strip.innerHTML = items.map(buildCard).join('');
    strip.querySelectorAll('.f2w-cw-card').forEach(card => {
      card.addEventListener('click', () => {
        const url = card.getAttribute('data-cw-url');
        if (url) location.href = url;
      });
    });
  }

  function boot() {
    // Always track progress on watch; never show UI there
    if (isWatchPage()) {
      document.body.classList.add('f2w-watch-page');
      removeSection();
      syncAccountItems().catch(() => {});
      return;
    }
    if (!isAllowedPage()) {
      removeSection();
      return;
    }
    renderUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  const accountClient = supabaseClient();
  accountClient?.auth?.onAuthStateChange?.(() => {
    accountSyncUserId = '';
    // Remove the previous account's visible list immediately on sign-out or
    // account switch; the new list is rendered only after its own sync passes.
    removeSection();
    if (isAllowedPage() && !isWatchPage()) renderUI();
    else if (isWatchPage()) syncAccountItems(true).catch(() => {});
  });

  setTimeout(boot, 500);
  setTimeout(boot, 1500);

  // Some pages mount their main content after the initial boot. Retry only
  // while the section is absent, so late-rendered home/genre content gets it
  // without creating a mutation-observer loop.
  let cwMountQueued = false;
  const cwMountObserver = new MutationObserver(() => {
    if (cwMountQueued || !isAllowedPage() || isWatchPage() ||
        document.getElementById('f2w-continue-watching-section')) return;
    cwMountQueued = true;
    requestAnimationFrame(() => {
      cwMountQueued = false;
      if (!document.getElementById('f2w-continue-watching-section')) renderUI();
    });
  });
  cwMountObserver.observe(document.documentElement, { childList: true, subtree: true });
})();
