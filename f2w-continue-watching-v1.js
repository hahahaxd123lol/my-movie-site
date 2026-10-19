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
      (data || []).map(fromRemoteRow)
        .filter(item => !window.__f2wCwManager?.isItemDismissed?.(item))
        .forEach(item => merged.set(itemKey(item), item));
      // The authenticated account's database rows are authoritative.
      const items = [...merged.values()]
        .filter(item => Number(item.seconds || 0) >= MIN_SECONDS)
        .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
        .slice(0, MAX_ITEMS);
      writeIndex(items);
      // Reading the account rows is enough here. Re-upserting unchanged rows
      // on every page visit only creates needless writes and database log traffic.
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
    if (!userId || !client?.from || window.__f2wCwManager?.isItemDismissed?.(item)) return;
    // Player telemetry may arrive every second. Keep local progress responsive,
    // but write the account copy at most once per item/episode per minute.
    const saveKey = `${userId}:${itemKey(item)}:${Number(item.season || 1)}:${Number(item.episode || 1)}`;
    const lastAt = Number(window.__f2wCwAccountSaveTimes?.get(saveKey) || 0);
    const now = Date.now();
    if (now - lastAt < 60000) return;
    if (!window.__f2wCwAccountSaveTimes) window.__f2wCwAccountSaveTimes = new Map();
    window.__f2wCwAccountSaveTimes.set(saveKey, now);
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
    const normalized = {
      id: String(partial.id).replace(/\D/g, '') || String(partial.id),
      type: partial.type === 'tv' ? 'tv' : 'movie',
      season: partial.type === 'tv' ? Number(partial.season || 1) : null,
      episode: partial.type === 'tv' ? Number(partial.episode || 1) : null,
      seconds, duration, title: partial.title || '', poster_path: partial.poster_path || ''
    };
    if (window.__f2wCwManager?.isItemDismissed?.(normalized)) return;
    if (window.__f2wCwManager?.onProgress?.(normalized)) return;
    if (seconds < MIN_SECONDS) return;
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

  // Accept progress events from the active embedded source, not just the
  // Flix2Watch API. Providers use different origins and several common payload
  // shapes; cross-origin safety is preserved by requiring the active iframe as
  // event.source and validating the progress fields before saving.
  window.addEventListener('message', (event) => {
    try {
      const frame = document.getElementById('video-frame');
      if (!frame || event.source !== frame.contentWindow) return;
      let payload = event.data;
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch { return; }
      }
      if (!payload || typeof payload !== 'object') return;
      const data = payload.data && typeof payload.data === 'object' ? payload.data
        : payload.detail && typeof payload.detail === 'object' ? payload.detail : payload;
      const info = data.player_info || data.playerInfo || data.info || {};
      const rawStatus = data.player_status ?? data.status ?? data.event ?? data.action ?? payload.type ?? '';
      let status = String(rawStatus).toLowerCase();
      const progressValue = data.player_progress ?? data.currentTime ?? data.current_time ??
        data.position_seconds ?? data.position ?? data.time ?? info.currentTime ?? info.current_time;
      const durationValue = data.player_duration ?? data.duration ?? data.duration_seconds ??
        info.duration ?? info.duration_seconds;
      const progress = Number(progressValue);
      const duration = Number(durationValue || 0);
      if (!Number.isFinite(progress) || progress < 0) return;
      if (!status || /timeupdate|time_update|progress|playing|playback|player_event/i.test(status)) status = 'playing';
      if (/pause/.test(status)) status = 'paused';
      else if (/seek/.test(status)) status = 'seeked';
      else if (/ended|complete|finished/.test(status)) status = 'completed';
      else if (!/^(playing|paused|seeked|completed)$/.test(status)) return;
      const params = new URLSearchParams(location.search);
      const type = (info.mediaType === 'tv' || info.media_type === 'tv' || params.get('type') === 'tv') ? 'tv' : 'movie';
      let id = String(params.get('id') || '').trim();
      const providerId = info.tmdb || info.tmdbId || info.mediaId || info.media_id;
      if (providerId) id = String(providerId).replace(/\D/g, '') || id;
      id = String(id).replace(/\D/g, '') || id;
      if (!id) return;
      const season = Number(info.season || document.getElementById('season-select')?.value || params.get('season') || 1);
      const episode = Number(info.episode || document.getElementById('episode-select')?.value || params.get('episode') || 1);
      let title = document.querySelector('h1, .watch-title, #media-title')?.textContent?.trim() || '';
      if (!title || /watch|flix2/i.test(title)) title = document.title.split('|')[0].trim();
      let poster_path = '';
      const og = document.querySelector('meta[property="og:image"]')?.content || '';
      const pm = og.match(/\/t\/p\/\w+(\/[^?\s]+)/);
      if (pm) poster_path = pm[1];
      upsertItem({ id, type, season, episode, seconds: progress, duration, title, poster_path });
    } catch {}
  });

  window.addEventListener('f2w:cw-progress', event => {
    try { if (event.detail) upsertItem(event.detail); } catch {}
  });

  function snapshotWatchPage() {
    if (!isWatchPage()) return;
    const params = new URLSearchParams(location.search);
    const id = String(params.get('id') || '').replace(/\D/g, '') || params.get('id');
    const type = params.get('type') === 'tv' ? 'tv' : 'movie';
    if (!id) return;
    const season = Number(document.getElementById('season-select')?.value || params.get('season') || 1);
    const episode = Number(document.getElementById('episode-select')?.value || params.get('episode') || 1);
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

  // Continue Watching is updated from player events and a 30-second snapshot
  // heartbeat, preserving the last known timestamp while paused.
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
      #f2w-continue-watching-strip{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(140px,160px);gap:12px;overflow-x:auto;overflow-y:hidden;padding:0 2px 10px;scroll-snap-type:x mandatory;overscroll-behavior-x:contain;align-items:start;min-width:0;max-width:100%;box-sizing:border-box;-webkit-overflow-scrolling:touch;}
      #f2w-continue-watching-strip>*{min-width:0;box-sizing:border-box;}
      .f2w-cw-card{cursor:pointer;scroll-snap-align:start;min-width:0;width:100%;max-width:100%;align-self:start}
      @media(max-width:640px){
        #f2w-continue-watching-section{width:100%;max-width:100%;min-width:0;margin:12px 0 18px;padding:0 12px;box-sizing:border-box;overflow:hidden;}
        #f2w-continue-watching-section .section-heading-row{align-items:center;gap:8px;min-width:0;}
        #f2w-continue-watching-section h2{font-size:1.15rem;line-height:1.25;}
        #f2w-continue-watching-strip{display:flex!important;flex-flow:row nowrap!important;align-items:flex-start!important;gap:10px;width:100%;max-width:100%;min-width:0;overflow-x:auto!important;overflow-y:hidden!important;scroll-snap-type:x mandatory;padding:0 0 12px;margin:0;}
        #f2w-continue-watching-strip>.f2w-cw-card{display:block!important;flex:0 0 clamp(118px,38vw,148px)!important;width:clamp(118px,38vw,148px)!important;min-width:0!important;max-width:clamp(118px,38vw,148px)!important;margin:0!important;float:none!important;grid-column:auto!important;grid-row:auto!important;}
        #f2w-continue-watching-strip .f2w-cw-poster-shell{width:100%;aspect-ratio:2/3;}
        #f2w-continue-watching-strip .f2w-cw-title{font-size:12px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        #f2w-continue-watching-strip .f2w-cw-meta{font-size:10px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      }
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

    let items = readIndex().filter(it =>
      Number(it.seconds || 0) >= MIN_SECONDS && !window.__f2wCwManager?.isItemDismissed?.(it)
    );
    items = [...new Map(items.map(it => [itemKey(it), it])).values()].slice(0, MAX_ITEMS);
    if (items.length) {
      items = await ensureMeta(items);
      items = [...new Map(readIndex().filter(it =>
        Number(it.seconds || 0) >= MIN_SECONDS && !window.__f2wCwManager?.isItemDismissed?.(it)
      ).map(it => [itemKey(it), it])).values()].slice(0, MAX_ITEMS);
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
        if (!url) return;
        try {
          const destination = new URL(url, location.origin);
          const params = destination.searchParams;
          const id = String(params.get('id') || '').replace(/\D/g, '');
          const type = params.get('type') === 'tv' ? 'tv' : 'movie';
          const seconds = Math.max(0, Math.floor(Number(params.get('resume') || 0)));
          const season = Math.max(1, Number(params.get('season') || 1));
          const episode = Math.max(1, Number(params.get('episode') || 1));
          if (id && seconds > 10) {
            const key = type === 'tv'
              ? 'f2w_resume_tv_' + id + '_s' + season + 'e' + episode
              : 'f2w_resume_movie_' + id;
            localStorage.setItem(key, String(seconds));
          }
          location.href = destination.pathname + destination.search + destination.hash;
        } catch {
          location.href = url;
        }
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

  // Keep the account-linked Continue Watching row fresh every 30 seconds,
  // including when a paused player has stopped sending progress events.
  setInterval(() => {
    if (!isWatchPage()) return;
    snapshotWatchPage();
  }, 30000);

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


(() => {
  'use strict';
  if (window.__f2wCwNetflixV1) return;
  window.__f2wCwNetflixV1 = true;
  const INDEX_KEY = 'f2w_continue_watching_v1';
  const ACCOUNT_TABLE = 'continue_watching_v260';
  const DISMISSED_PREFIX = 'f2w_continue_watching_dismissed_v1:';
  const TMDB_KEY = '925c48dd6e24fd5e975fe224238bbb45';
  let activeUid = '', lastBridgeKey = '', lastBridgePos = null, lastBridgeStatus = '';
  const seriesCache = new Map(), seriesChecks = new Set(), removingKeys = new Set();
  function client() { return window.f2wSupabase || window.chatSupabase || window.supabaseClient || null; }
  async function refreshUser() {
    try { const c = client(); const { data } = await c?.auth?.getSession?.(); activeUid = String(data?.session?.user?.id || ''); }
    catch { activeUid = ''; }
    return activeUid;
  }
  function itemKey(item) {
    const id = String(item?.id || '').replace(/\D/g, '');
    return id ? ((item.type === 'tv' ? 'tv:' : 'movie:') + id) : '';
  }
  function readDismissed(uid = activeUid) {
    if (!uid) return {};
    try { const value = JSON.parse(localStorage.getItem(DISMISSED_PREFIX + uid) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
    catch { return {}; }
  }
  function isItemDismissed(item) {
    const key = itemKey(item);
    return Boolean(key && (removingKeys.has(key) || readDismissed()[key]));
  }
  function rememberDismissal(item, reason, uid) {
    const key = itemKey(item); if (!key || !uid) return;
    const entries = readDismissed(uid); entries[key] = { reason: String(reason || 'manual'), at: Date.now() };
    try { localStorage.setItem(DISMISSED_PREFIX + uid, JSON.stringify(entries)); } catch {}
  }
  function clearDismissal(item, uid) {
    const key = itemKey(item); if (!key || !uid) return;
    const entries = readDismissed(uid); if (!entries[key]) return;
    delete entries[key]; try { localStorage.setItem(DISMISSED_PREFIX + uid, JSON.stringify(entries)); } catch {}
  }
  function readIndex() {
    try { const items = JSON.parse(localStorage.getItem(INDEX_KEY) || '[]'); return Array.isArray(items) ? items : []; }
    catch { return []; }
  }
  function writeIndex(items) { try { localStorage.setItem(INDEX_KEY, JSON.stringify(items)); } catch {} }
  function clearResumeKeys(item) {
    const id = String(item?.id || '').replace(/\D/g, ''); if (!id) return;
    try {
      const remove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i); if (!key) continue;
        if (item.type === 'movie' && key === 'f2w_resume_movie_' + id) remove.push(key);
        if (item.type === 'tv' && key.startsWith('f2w_resume_tv_' + id + '_s')) remove.push(key);
      }
      remove.forEach(key => localStorage.removeItem(key));
    } catch {}
  }
  function cardItem(card) {
    try {
      const url = new URL(card.getAttribute('data-cw-url') || '', location.origin), p = url.searchParams;
      const id = String(p.get('id') || '').replace(/\D/g, ''), type = p.get('type') === 'tv' ? 'tv' : 'movie';
      if (!id) return null;
      return { id, type, season: Number(p.get('season') || 1), episode: Number(p.get('episode') || 1),
        seconds: Number(p.get('resume') || 0), title: card.querySelector('.f2w-cw-title')?.textContent?.trim() || '', poster_path: '' };
    } catch { return null; }
  }
  async function deleteRemote(item, uid) {
    const c = client(), id = Number(String(item?.id || '').replace(/\D/g, ''));
    if (!uid || !c?.from || !Number.isSafeInteger(id) || id <= 0) return;
    const { error } = await c.from(ACCOUNT_TABLE).delete().eq('user_id', uid)
      .eq('media_type', item.type === 'tv' ? 'tv' : 'movie').eq('media_id', id);
    if (error) throw error;
  }
  async function removeItem(item, card, reason = 'manual') {
    const key = itemKey(item); if (!key || removingKeys.has(key)) return;
    removingKeys.add(key);
    try {
      const uid = activeUid || await refreshUser();
      if (uid) rememberDismissal(item, reason, uid);
      writeIndex(readIndex().filter(entry => itemKey(entry) !== key));
      clearResumeKeys(item);
      if (card) {
        card.classList.add('f2w-cw-removing');
        setTimeout(() => {
          card.remove();
          const strip = document.getElementById('f2w-continue-watching-strip');
          if (strip && !strip.querySelector('.f2w-cw-card')) {
            strip.innerHTML = '<div class="f2w-cw-empty">Your Continue Watching list is clear. Start a movie or series to add something here.</div>';
          }
        }, 230);
      }
      try { await deleteRemote(item, uid); }
      catch (error) { console.warn('Continue Watching removal sync failed:', error?.message || error); }
    } finally { setTimeout(() => removingKeys.delete(key), 1500); }
  }
  function atWatchedThreshold(position, duration) {
    if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0 || position < 0) return false;
    return position >= (duration > 300 ? duration - 300 : duration * 0.5);
  }
  async function seriesMetadata(id) {
    const key = String(id); if (seriesCache.has(key)) return seriesCache.get(key);
    const promise = (async () => {
      const response = await fetch('https://api.themoviedb.org/3/tv/' + encodeURIComponent(key) +
        '?api_key=' + encodeURIComponent(TMDB_KEY) + '&language=en-US', { cache: 'force-cache' });
      if (!response.ok) throw new Error('Series metadata request failed');
      const data = await response.json();
      return { status: String(data?.status || '').trim().toLowerCase(),
        seasons: (Array.isArray(data?.seasons) ? data.seasons : [])
          .map(s => ({ number: Number(s.season_number), count: Number(s.episode_count) }))
          .filter(s => s.number > 0 && s.count > 0 && Number.isFinite(s.count)) };
    })();
    seriesCache.set(key, promise);
    try { return await promise; } catch (error) { seriesCache.delete(key); throw error; }
  }
  async function checkFullyWatchedSeries(item) {
    const id = Number(String(item?.id || '').replace(/\D/g, ''));
    const season = Number(item?.season || 0), episode = Number(item?.episode || 0);
    const position = Math.floor(Number(item?.seconds || 0)), duration = Math.floor(Number(item?.duration || 0));
    if (!id || season <= 0 || episode <= 0 || !atWatchedThreshold(position, duration)) return;
    const key = [id, season, episode].join(':'); if (seriesChecks.has(key)) return;
    seriesChecks.add(key);
    try {
      const uid = activeUid || await refreshUser(), c = client();
      if (!uid || !c?.rpc) return;
      const meta = await seriesMetadata(id);
      if (!['ended', 'canceled', 'cancelled'].includes(meta.status) || !meta.seasons.length) return;
      const { error: markError } = await c.rpc('mark_my_watched_media_v1', {
        p_media_id: id, p_media_type: 'tv', p_season: season, p_episode: episode,
        p_position_seconds: position, p_duration_seconds: duration
      });
      if (markError) throw markError;
      const { data, error } = await c.rpc('get_my_watched_media_v1', { p_media_id: id, p_media_type: 'tv' });
      if (error) throw error;
      const watched = new Set((Array.isArray(data) ? data : []).map(row => Number(row.season) + ':' + Number(row.episode)));
      const complete = meta.seasons.every(s => {
        for (let ep = 1; ep <= s.count; ep++) if (!watched.has(s.number + ':' + ep)) return false;
        return true;
      });
      if (complete) await removeItem({ id: String(id), type: 'tv', season, episode }, null, 'series-watched');
    } catch (error) { console.warn('Full-series Continue Watching cleanup unavailable:', error?.message || error); }
    finally { setTimeout(() => seriesChecks.delete(key), 60000); }
  }
  function onProgress(item) {
    if (!item?.id || !item?.type) return false;
    if (isItemDismissed(item)) return true;
    if (item.type === 'movie' && atWatchedThreshold(Number(item.seconds), Number(item.duration))) {
      void removeItem(item, null, 'movie-watched'); return true;
    }
    if (item.type === 'tv' && atWatchedThreshold(Number(item.seconds), Number(item.duration))) void checkFullyWatchedSeries(item);
    return false;
  }
  function attachDismissButtons() {
    document.querySelectorAll('.f2w-cw-card').forEach(card => {
      if (card.querySelector('.f2w-cw-dismiss') || card.dataset.f2wCwDismissBound === '1') return;
      card.dataset.f2wCwDismissBound = '1'; card.style.position = 'relative';
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'f2w-cw-dismiss'; button.textContent = '×';
      button.title = 'Remove from Continue Watching';
      button.setAttribute('aria-label', 'Remove ' + (card.querySelector('.f2w-cw-title')?.textContent?.trim() || 'title') + ' from Continue Watching');
      button.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation();
        if (button.disabled) return; button.disabled = true;
        const item = cardItem(card); if (item) void removeItem(item, card, 'manual');
      });
      card.appendChild(button);
    });
  }
  function installStyles() {
    if (document.getElementById('f2w-cw-dismiss-v1-style')) return;
    const style = document.createElement('style'); style.id = 'f2w-cw-dismiss-v1-style';
    style.textContent = '.f2w-cw-card{position:relative;transition:opacity .22s ease,transform .22s ease}.f2w-cw-card.f2w-cw-removing{opacity:0;transform:translateY(7px) scale(.965);pointer-events:none}.f2w-cw-dismiss{position:absolute;top:8px;right:8px;z-index:8;width:30px;height:30px;display:grid;place-items:center;padding:0;border:1px solid rgba(255,255,255,.2);border-radius:50%;background:rgba(8,11,17,.84);color:#fff;font:700 21px/1 system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.36);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);cursor:pointer;opacity:0;pointer-events:none;transform:translateY(-3px) scale(.94);transition:opacity .16s ease,transform .16s ease,background .16s ease}.f2w-cw-card:hover .f2w-cw-dismiss,.f2w-cw-card:focus-within .f2w-cw-dismiss,.f2w-cw-dismiss:focus-visible{opacity:1;pointer-events:auto;transform:none}.f2w-cw-dismiss:hover{background:rgba(229,9,20,.96)}.f2w-cw-dismiss:focus-visible{outline:2px solid #fff;outline-offset:3px}@media(hover:none){.f2w-cw-dismiss{opacity:1;pointer-events:auto;transform:none}}@media(prefers-reduced-motion:reduce){.f2w-cw-card,.f2w-cw-dismiss{transition:none!important}}';
    (document.head || document.documentElement).appendChild(style);
  }
  function currentMediaOnWatch() {
    if (!location.pathname.toLowerCase().startsWith('/watch')) return null;
    const p = new URLSearchParams(location.search), id = String(p.get('id') || '').replace(/\D/g, '');
    return id ? { id, type: p.get('type') === 'tv' ? 'tv' : 'movie' } : null;
  }
  function sampleSharedTelemetry() {
    const current = currentMediaOnWatch(); if (!current) return;
    const state = document.getElementById('f2w-premid-state')?.dataset;
    if (!state || Number(state.mediaId) !== Number(current.id) ||
        (String(state.mediaType || '').toLowerCase() === 'tv' ? 'tv' : 'movie') !== current.type) return;
    const seconds = Number(state.position), duration = Number(state.duration);
    if (!Number.isFinite(seconds) || seconds < 0) return;
    const season = current.type === 'tv' ? Number(state.season || 1) : null;
    const episode = current.type === 'tv' ? Number(state.episode || 1) : null;
    const status = String(state.status || '').toLowerCase();
    const key = [current.id, current.type, season || 0, episode || 0].join(':');
    if (key === lastBridgeKey && lastBridgePos !== null && Math.abs(seconds - lastBridgePos) < 4 && status === lastBridgeStatus) return;
    lastBridgeKey = key; lastBridgePos = seconds; lastBridgeStatus = status;
    let title = document.getElementById('detail-title')?.textContent?.trim() || document.title.split('|')[0].trim();
    let poster_path = '';
    const poster = String(document.querySelector('#detail-poster img,.detail-poster img,#detail-poster,.poster img')?.currentSrc || '');
    const chunks = poster.split('/t/p/');
    if (chunks.length > 1) { const tail = chunks[1].split('?')[0], slash = tail.indexOf('/'); if (slash >= 0) poster_path = tail.slice(slash); }
    window.dispatchEvent(new CustomEvent('f2w:cw-progress', { detail: { id: current.id, type: current.type, season, episode, seconds, duration, title, poster_path } }));
  }
  window.__f2wCwManager = { isItemDismissed, onProgress, removeItem: (item, reason) => removeItem(item, null, reason || 'manual') };
  installStyles(); attachDismissButtons();
  const observer = new MutationObserver(() => attachDismissButtons());
  function observe() {
    if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });
    attachDismissButtons();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, { once: true }); else observe();
  void refreshUser();
  client()?.auth?.onAuthStateChange?.((_event, session) => { activeUid = String(session?.user?.id || ''); attachDismissButtons(); });
  const current = currentMediaOnWatch();
  if (current) refreshUser().then(uid => { if (uid) clearDismissal(current, uid); });
  setInterval(sampleSharedTelemetry, 1500);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sampleSharedTelemetry(); });
})();
// f2w-force-save: Netflix-style Continue Watching removal and completion 2026-10-12
