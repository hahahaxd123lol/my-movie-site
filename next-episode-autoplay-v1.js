/* Flix2Watch next-episode autoplay v1 — shared host UI for all iframe sources. */
(()=> {
  'use strict';
  if (window.__f2wNextEpisodeAutoplayV1) return;
  window.__f2wNextEpisodeAutoplayV1 = true;

  const params = new URLSearchParams(location.search);
  const mediaId = Number(params.get('id') || 0);
  const mediaType = String(params.get('type') || 'movie').toLowerCase();
  if (mediaType !== 'tv' || !Number.isFinite(mediaId) || mediaId <= 0) return;

  const $ = selector => document.querySelector(selector);
  const frame = () => $('#video-frame');
  const host = () => $('#flix-player-container');
  const seasonSelect = () => $('#season-select');
  const episodeSelect = () => $('#episode-select');

  let card = null;
  let countdownNode = null;
  let titleNode = null;
  let seasonNode = null;
  let progressNode = null;
  let interval = 0;
  let active = false;
  let remainingMs = 10000;
  let countdownTotalMs = 10000;
  let waitForEpisodeEnd = false;
  let previousTick = 0;
  let handledKey = '';
  let originKey = '';
  let target = null;

  const numberValue = value => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  function activeSource() {
    return String($('.server-btn.active')?.dataset?.server || frame()?.getAttribute('src') || 'unknown');
  }

  function playbackKey() {
    return [mediaId, numberValue(seasonSelect()?.value || params.get('season') || 1),
      numberValue(episodeSelect()?.value || params.get('episode') || 1), activeSource()].join('|');
  }

  function ensureStyles() {
    if ($('#f2w-next-episode-style-v1')) return;
    const style = document.createElement('style');
    style.id = 'f2w-next-episode-style-v1';
    style.textContent = `
      #flix-player-container.f2w-next-ep-host { position:relative!important; }
      #f2w-next-episode-card {
        box-sizing:border-box; display:block; position:absolute;
        right:clamp(12px,2vw,24px); bottom:clamp(12px,2vw,24px);
        width:min(370px,calc(100% - 24px)); max-width:calc(100vw - 24px);
        margin:0; padding:17px 17px 15px; border:1px solid rgba(255,255,255,.17);
        border-radius:17px; color:#f8fafc;
        background:linear-gradient(145deg,rgba(9,18,31,.96),rgba(3,8,16,.94));
        box-shadow:0 22px 70px rgba(0,0,0,.58),0 0 0 1px rgba(255,255,255,.035) inset;
        backdrop-filter:blur(20px) saturate(135%); -webkit-backdrop-filter:blur(20px) saturate(135%);
        z-index:2147483647; font:500 13px/1.45 Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        text-align:left; opacity:0; visibility:hidden; pointer-events:none;
        transform:translate3d(0,12px,0) scale(.985);
        transition:opacity .24s ease,transform .28s cubic-bezier(.2,.8,.2,1),visibility .24s;
        overflow:hidden;
      }
      #f2w-next-episode-card[hidden] { display:none!important; }
      #f2w-next-episode-card.f2w-visible { opacity:1; visibility:visible; pointer-events:auto; transform:translate3d(0,0,0) scale(1); }
      #f2w-next-episode-card.f2w-is-popover {
        position:fixed!important; inset:auto max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) auto!important;
        width:min(370px,calc(100vw - 28px))!important; max-width:calc(100vw - 28px)!important;
        margin:0!important; max-height:calc(100dvh - 28px); overflow:auto;
      }
      #f2w-next-episode-card .f2w-next-top { display:flex; align-items:flex-start; gap:13px; }
      #f2w-next-episode-card .f2w-next-copy { flex:1 1 auto; min-width:0; }
      #f2w-next-episode-card .f2w-next-kicker {
        display:flex; align-items:center; gap:7px; margin:0 0 5px;
        color:#c3d2e6; font-size:10px; font-weight:800; letter-spacing:.17em; text-transform:uppercase;
      }
      #f2w-next-episode-card .f2w-next-dot { width:6px;height:6px;border-radius:50%;background:var(--accent,#e50914);box-shadow:0 0 12px var(--accent,#e50914); }
      #f2w-next-episode-card .f2w-next-title { margin:0; font-size:15px; line-height:1.35; font-weight:800; letter-spacing:-.015em; overflow-wrap:anywhere; }
      #f2w-next-episode-card .f2w-next-season { margin-top:4px; color:#97a9bd; font-size:12px; }
      #f2w-next-episode-card .f2w-next-clock {
        flex:0 0 47px; width:47px; height:47px; border-radius:50%; padding:3px;
        display:grid; place-items:center;
        background:conic-gradient(var(--accent,#e50914) var(--f2w-progress,100%),rgba(255,255,255,.12) 0);
        box-shadow:0 0 24px rgba(229,9,20,.12);
      }
      #f2w-next-episode-card .f2w-next-clock-inner { width:100%;height:100%;border-radius:50%;display:grid;place-items:center;background:#091321;font-size:17px;font-weight:850;font-variant-numeric:tabular-nums; }
      #f2w-next-episode-card .f2w-next-note { margin:12px 0 10px; color:#c3d0df; font-size:12px; }
      #f2w-next-episode-card .f2w-next-track { height:3px; margin:0 0 14px; border-radius:10px; background:rgba(255,255,255,.1); overflow:hidden; }
      #f2w-next-episode-card .f2w-next-track-fill { display:block;width:100%;height:100%;border-radius:inherit;background:var(--accent,#e50914);transform-origin:left center;transition:width .12s linear;box-shadow:0 0 10px rgba(229,9,20,.45); }
      #f2w-next-episode-card .f2w-next-actions { display:flex; gap:8px; align-items:center; }
      #f2w-next-episode-card button {
        appearance:none; border:1px solid rgba(255,255,255,.13); border-radius:10px;
        min-height:38px; padding:0 13px; cursor:pointer; font:750 12px/1 Inter,system-ui,sans-serif;
        transition:transform .15s ease,background .15s ease,border-color .15s ease;
      }
      #f2w-next-episode-card button:focus-visible { outline:2px solid #fff;outline-offset:3px; }
      #f2w-next-episode-card button:active { transform:scale(.98); }
      #f2w-next-episode-card .f2w-next-play { flex:1; color:#fff; background:var(--accent,#e50914); border-color:transparent; box-shadow:0 5px 18px rgba(229,9,20,.2); }
      #f2w-next-episode-card .f2w-next-play:hover { filter:brightness(1.12); }
      #f2w-next-episode-card .f2w-next-cancel { color:#d9e2ee; background:rgba(255,255,255,.055); }
      #f2w-next-episode-card .f2w-next-cancel:hover { background:rgba(255,255,255,.11); border-color:rgba(255,255,255,.24); }
      @media(max-width:480px) {
        #f2w-next-episode-card { right:10px;bottom:10px;width:min(350px,calc(100% - 20px));padding:14px;border-radius:14px; }
        #f2w-next-episode-card .f2w-next-title { font-size:14px; }
      }
      @media(prefers-reduced-motion:reduce) {
        #f2w-next-episode-card,#f2w-next-episode-card button,#f2w-next-episode-card .f2w-next-track-fill { transition:none!important; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureCard() {
    if (card) return card;
    const container = host();
    if (!container) return null;
    ensureStyles();
    container.classList.add('f2w-next-ep-host');

    card = document.createElement('section');
    card.id = 'f2w-next-episode-card';
    card.hidden = true;
    card.setAttribute('role','dialog');
    card.setAttribute('aria-label','Next episode');
    card.setAttribute('aria-hidden','true');

    const top = document.createElement('div');
    top.className = 'f2w-next-top';
    const copy = document.createElement('div');
    copy.className = 'f2w-next-copy';
    const kicker = document.createElement('div');
    kicker.className = 'f2w-next-kicker';
    const dot = document.createElement('span');
    dot.className = 'f2w-next-dot';
    kicker.append(dot,document.createTextNode('UP NEXT'));
    titleNode = document.createElement('h3');
    titleNode.className = 'f2w-next-title';
    seasonNode = document.createElement('div');
    seasonNode.className = 'f2w-next-season';
    copy.append(kicker,titleNode,seasonNode);

    const clock = document.createElement('div');
    clock.className = 'f2w-next-clock';
    clock.setAttribute('aria-hidden','true');
    const clockInner = document.createElement('div');
    clockInner.className = 'f2w-next-clock-inner';
    countdownNode = clockInner;
    clock.append(clockInner);
    top.append(copy,clock);

    const note = document.createElement('p');
    note.className = 'f2w-next-note';
    note.textContent = 'Playing automatically in 10 seconds';
    const track = document.createElement('div');
    track.className = 'f2w-next-track';
    track.setAttribute('aria-hidden','true');
    progressNode = document.createElement('span');
    progressNode.className = 'f2w-next-track-fill';
    track.append(progressNode);

    const actions = document.createElement('div');
    actions.className = 'f2w-next-actions';
    const play = document.createElement('button');
    play.type = 'button';
    play.className = 'f2w-next-play';
    play.textContent = 'Play next now  →';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'f2w-next-cancel';
    cancel.textContent = 'Cancel';
    play.addEventListener('click',playNextNow);
    cancel.addEventListener('click',cancelCountdown);
    actions.append(play,cancel);

    card.append(top,note,track,actions);
    container.appendChild(card);
    return card;
  }

  function nextEpisodeTarget() {
    const season = seasonSelect();
    const episode = episodeSelect();
    if (!season || !episode || !season.options.length || !episode.options.length) return null;
    const currentSeason = numberValue(season.value);
    const currentEpisode = numberValue(episode.value);
    if (currentSeason <= 0 || currentEpisode <= 0) return null;

    const nextOption = [...episode.options].find(option => numberValue(option.value) === currentEpisode + 1);
    if (nextOption) {
      const name = String(nextOption.textContent || '').trim();
      return {
        kind:'episode', season:currentSeason, episode:currentEpisode + 1,
        title:name || ('Episode ' + (currentEpisode + 1)),
        subtitle:'Season ' + currentSeason + ' · Episode ' + (currentEpisode + 1)
      };
    }

    const nextSeasonOption = [...season.options]
      .filter(option => numberValue(option.value) > currentSeason)
      .sort((a,b) => numberValue(a.value) - numberValue(b.value))[0];
    if (nextSeasonOption) {
      return {
        kind:'season', season:numberValue(nextSeasonOption.value), episode:1,
        title:(String(nextSeasonOption.textContent || '').trim() || ('Season ' + nextSeasonOption.value)) + ' · Episode 1',
        subtitle:'Moving to the next season'
      };
    }
    return null;
  }

  function isPlayerFullscreen() {
    const container = host();
    const iframe = frame();
    const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement || null;
    if (!fullscreenElement) return false;
    return fullscreenElement === iframe || fullscreenElement === container ||
      Boolean(container && fullscreenElement !== card && container.contains(fullscreenElement));
  }

  function isPopoverOpen() {
    try { return Boolean(card && card.hasAttribute('popover') && card.matches(':popover-open')); } catch (_) { return false; }
  }

  function prepareLayering() {
    if (!card) return;
    const shouldPopover = isPlayerFullscreen() && typeof card.showPopover === 'function';
    if (shouldPopover) {
      card.classList.add('f2w-is-popover');
      card.setAttribute('popover','manual');
      if (!isPopoverOpen()) {
        try { card.showPopover(); } catch (error) {
          card.removeAttribute('popover');
          card.classList.remove('f2w-is-popover');
          console.warn('Next episode fullscreen overlay fallback:',error?.message || error);
        }
      }
    } else {
      if (isPopoverOpen()) {
        try { card.hidePopover(); } catch (_) {}
      }
      card.removeAttribute('popover');
      card.classList.remove('f2w-is-popover');
    }
  }

  function makeVisible() {
    const el = ensureCard();
    if (!el) return;
    el.hidden = false;
    el.setAttribute('aria-hidden','false');
    el.classList.add('f2w-visible');
    prepareLayering();
    // showPopover() changes rendering in the top layer. Re-apply the visible
    // state in the next frame so both the first entrance and transitions are smooth.
    requestAnimationFrame(() => {
      if (active && card) card.classList.add('f2w-visible');
    });
  }

  function hideCard() {
    if (!card) return;
    card.classList.remove('f2w-visible');
    card.setAttribute('aria-hidden','true');
    if (isPopoverOpen()) {
      try { card.hidePopover(); } catch (_) {}
    }
    card.removeAttribute('popover');
    card.classList.remove('f2w-is-popover');
    card.hidden = true;
  }

  function syncLayerForFullscreen() {
    if (active && card) prepareLayering();
  }
  document.addEventListener('fullscreenchange',syncLayerForFullscreen);
  document.addEventListener('webkitfullscreenchange',syncLayerForFullscreen);

  function formatClock(totalSeconds) {
    const seconds = Math.max(0,Math.ceil(totalSeconds));
    const minutes = Math.floor(seconds/60);
    const rest = seconds%60;
    return minutes > 0 ? minutes+':'+String(rest).padStart(2,'0') : String(rest);
  }

  function updateCountdown() {
    if (!active || !card) return;
    const now = Date.now();
    let reportedStatus = '';
    if (waitForEpisodeEnd) {
      const node = document.getElementById('f2w-premid-state');
      const state = node?.dataset || {};
      const updatedAt = numberValue(state.updatedAt);
      const validState = numberValue(state.mediaId) === mediaId &&
        String(state.mediaType || '').toLowerCase() === 'tv' &&
        (!updatedAt || now-updatedAt < 15000) &&
        numberValue(state.season || 0) === numberValue(seasonSelect()?.value || params.get('season') || 1) &&
        numberValue(state.episode || 0) === numberValue(episodeSelect()?.value || params.get('episode') || 1);
      if (validState) {
        reportedStatus = String(state.status || '').toLowerCase();
        const position = Number(state.position), duration = Number(state.duration);
        if (Number.isFinite(position) && Number.isFinite(duration) && duration > 0) {
          remainingMs = Math.max(0,(duration-position)*1000);
        }
        if (['ended','end','completed','complete','finished','finish'].includes(reportedStatus)) remainingMs = 0;
      }
    } else if (document.visibilityState !== 'hidden' && previousTick) {
      remainingMs = Math.max(0,remainingMs - Math.max(0,now-previousTick));
    }
    previousTick = now;
    const seconds = Math.ceil(remainingMs/1000);
    countdownNode.textContent = waitForEpisodeEnd ? formatClock(seconds) : String(seconds);
    const pct = Math.max(0,Math.min(100,remainingMs/Math.max(1000,countdownTotalMs)*100));
    card.style.setProperty('--f2w-progress',String(pct)+'%');
    card.querySelector('.f2w-next-clock')?.style.setProperty('--f2w-progress',String(pct)+'%');
    progressNode.style.width = String(pct) + '%';
    if (remainingMs <= 0 && (!waitForEpisodeEnd || !reportedStatus || reportedStatus === 'playing' ||
        ['ended','end','completed','complete','finished','finish'].includes(reportedStatus))) {
      clearInterval(interval);
      interval = 0;
      playNextNow();
    }
  }

  function beginCountdown(next, key, durationMs=10000, followsEpisodeEnd=false) {
    if (handledKey === key) return;
    handledKey = key;
    originKey = key;
    target = next;
    remainingMs = Math.max(1000,Number(durationMs)||10000);
    countdownTotalMs = remainingMs;
    waitForEpisodeEnd = Boolean(followsEpisodeEnd);
    previousTick = Date.now();
    active = true;

    const el = ensureCard();
    if (!el) { active = false; return; }
    titleNode.textContent = next.title;
    seasonNode.textContent = next.subtitle;
    const display = waitForEpisodeEnd ? formatClock(Math.ceil(remainingMs/1000)) : String(Math.ceil(remainingMs/1000));
    countdownNode.textContent = display;
    const pct = String(Math.max(0,Math.min(100,remainingMs/countdownTotalMs*100)))+'%';
    progressNode.style.width = pct;
    el.style.setProperty('--f2w-progress',pct);
    el.querySelector('.f2w-next-clock')?.style.setProperty('--f2w-progress',pct);
    const note = el.querySelector('.f2w-next-note');
    if (note) note.textContent = waitForEpisodeEnd
      ? 'Next episode starts when this episode finishes'
      : 'Playing automatically in 10 seconds';
    makeVisible();
    clearInterval(interval);
    interval = setInterval(updateCountdown,250);
  }

  function dismiss(markHandled=true) {
    clearInterval(interval);
    interval = 0;
    active = false;
    if (markHandled && originKey) handledKey = originKey;
    hideCard();
    target = null;
    originKey = '';
  }

  function cancelCountdown() {
    dismiss(true);
  }

  function playNextNow() {
    if (!active || !target) return;
    const next = target;
    const expectedKey = originKey;
    dismiss(true);

    // Never change an episode after the viewer has manually navigated elsewhere.
    if (playbackKey() !== expectedKey) return;

    const seasons = seasonSelect();
    const episodes = episodeSelect();
    if (!seasons || !episodes) return;

    if (next.kind === 'episode' && numberValue(seasons.value) === next.season) {
      const exists = [...episodes.options].some(option => numberValue(option.value) === next.episode);
      if (!exists) return;
      episodes.value = String(next.episode);
      if (typeof window.onEpisodeChange === 'function') window.onEpisodeChange();
      else episodes.dispatchEvent(new Event('change',{bubbles:true}));
      return;
    }

    const seasonExists = [...seasons.options].some(option => numberValue(option.value) === next.season);
    if (!seasonExists) return;
    seasons.value = String(next.season);
    if (typeof window.onSeasonChange === 'function') window.onSeasonChange();
    else seasons.dispatchEvent(new Event('change',{bubbles:true}));
  }

  function matchesCurrent(detail) {
    if (!detail || (detail.mediaType && !['tv','series','show'].includes(String(detail.mediaType).toLowerCase()))) return false;
    if (detail.mediaId && numberValue(detail.mediaId) !== mediaId) return false;
    const s = numberValue(seasonSelect()?.value || params.get('season') || 1);
    const e = numberValue(episodeSelect()?.value || params.get('episode') || 1);
    const detailSeason = numberValue(detail.season || detail.seasonNumber || 0);
    const detailEpisode = numberValue(detail.episode || detail.episodeNumber || 0);
    if (detailSeason > 0 && detailSeason !== s) return false;
    if (detailEpisode > 0 && detailEpisode !== e) return false;
    return true;
  }

  function handleCompletion(detail={}) {
    if (!matchesCurrent(detail)) return;
    const key = playbackKey();
    if (active && originKey === key) return;
    const next = nextEpisodeTarget();
    if (!next) return; // Nothing else in the currently listed seasons to play.
    beginCountdown(next,key,numberValue(detail.countdownMs)||10000,detail.waitForEpisodeEnd===true);
  }

  function rootsOf(value) {
    if (typeof value === 'string') {
      try { value = JSON.parse(value); } catch (_) { return []; }
    }
    if (!value || typeof value !== 'object') return [];
    const roots = [];
    const queue = [{value,depth:0}];
    const seen = new Set();
    const childKeys = ['data','payload','detail','event','player','player_info','info','message','result','state'];
    while (queue.length) {
      const item = queue.shift();
      if (!item.value || typeof item.value !== 'object' || seen.has(item.value)) continue;
      seen.add(item.value);
      roots.push(item.value);
      if (item.depth >= 4) continue;
      for (const k of childKeys) {
        const child = item.value[k];
        if (child && typeof child === 'object') queue.push({value:child,depth:item.depth+1});
        else if (typeof child === 'string' && (child.trimStart().startsWith('{') || child.trimStart().startsWith('['))) {
          try { queue.push({value:JSON.parse(child),depth:item.depth+1}); } catch (_) {}
        }
      }
    }
    return roots;
  }

  function isTerminalMessage(data) {
    const roots = rootsOf(data);
    for (const root of roots) {
      for (const key of ['ended','isEnded','is_ended','completed','isCompleted','is_completed','finished','isFinished','is_finished']) {
        if (root[key] === true || root[key] === 1) return true;
      }
      for (const key of ['player_status','playback_status','status','state','event','eventType','event_type','action','name','method','command','type']) {
        const value = root[key];
        if (typeof value !== 'string') continue;
        const normalized = value.trim().toLowerCase().replaceAll(' ','').replaceAll('_','').replaceAll('-','');
        if (['ended','end','completed','complete','finished','finish','playbackended','videoended','movieended','playbackcompleted','videocompleted','playbackcomplete','videocomplete','moviecomplete','oncomplete'].includes(normalized) ||
            /^(on|video|movie|playback)(ended|completed|complete|finished)$/.test(normalized)) return true;
      }
    }
    return false;
  }

  function detailFromMessage(data) {
    const roots = rootsOf(data);
    let season = 0, episode = 0, reportedMediaId = 0, reportedType = '';
    for (const root of roots) {
      if (!reportedMediaId) reportedMediaId = numberValue(root.media_id || root.mediaId || root.tmdb_id || root.tmdbId);
      if (!reportedType) reportedType = String(root.mediaType || root.media_type || root.content_type || '').toLowerCase();
      if (!season) season = numberValue(root.season || root.season_number || root.seasonNumber);
      if (!episode) episode = numberValue(root.episode || root.episode_number || root.episodeNumber);
    }
    return {mediaType:reportedType || 'tv',mediaId:reportedMediaId,season,episode};
  }

  // Poll the site's unified telemetry bridge as a fallback. This catches sources
  // that report a final position but omit a clean "ended" event from postMessage.
  function pollUnifiedEndState() {
    if (document.visibilityState === 'hidden') return;
    const node = document.getElementById('f2w-premid-state');
    if (!node) return;
    const state = node.dataset || {};
    if (numberValue(state.mediaId) !== mediaId || String(state.mediaType || '').toLowerCase() !== 'tv') return;
    const status = String(state.status || '').toLowerCase();
    const season = numberValue(state.season);
    const episode = numberValue(state.episode);
    if (season && season !== numberValue(seasonSelect()?.value || params.get('season') || 1)) return;
    if (episode && episode !== numberValue(episodeSelect()?.value || params.get('episode') || 1)) return;
    const terminal = ['ended','end','completed','complete','finished','finish'].includes(status);
    const position = Number(state.position);
    const duration = Number(state.duration);

    if (active) {
      if (originKey !== playbackKey()) { dismiss(false); return; }
      if (waitForEpisodeEnd && terminal) {
        remainingMs = 0;
        updateCountdown();
      }
      return;
    }
    if (terminal) {
      handleCompletion({mediaType:'tv',mediaId,season,episode});
      return;
    }
    // Show the card during the final five minutes. Its timer follows the shared
    // playback clock, so pausing or buffering will not skip content.
    if (status === 'playing' && Number.isFinite(position) && Number.isFinite(duration) &&
        duration > 0 && position > 0 && duration-position <= 300) {
      const next = nextEpisodeTarget();
      if (next) handleCompletion({
        mediaType:'tv',mediaId,season,episode,
        countdownMs:Math.max(1000,(duration-position)*1000),waitForEpisodeEnd:true
      });
    }
  }
  setInterval(pollUnifiedEndState,500);

  // Shared completion event is also emitted by the existing player bridge for
  // the primary source. The source/window listener below covers other embeds
  // that report ended/completed over postMessage.
  window.addEventListener('f2w:player-completed',event => {
    handleCompletion(event.detail || {});
  });

  window.addEventListener('message',event => {
    const f = frame();
    if (!f || event.source !== f.contentWindow || !isTerminalMessage(event.data)) return;
    handleCompletion(detailFromMessage(event.data));
  });

  document.addEventListener('ended',event => {
    if (event.target instanceof HTMLVideoElement && host()?.contains(event.target)) {
      handleCompletion({mediaType:'tv'});
    }
  },true);
  document.addEventListener('change',event => {
    if (event.target === seasonSelect() || event.target === episodeSelect()) {
      if (active) dismiss(true);
    }
  },true);
  document.addEventListener('click',event => {
    if (event.target.closest?.('.server-btn[data-server]') && active) dismiss(true);
  },true);
  window.addEventListener('pagehide',() => dismiss(false),{once:true});

  // Reposition the card if fullscreen begins or ends while the countdown is visible.
  document.addEventListener('visibilitychange',() => { previousTick = Date.now(); });
  document.addEventListener('fullscreenchange',() => {
    if (active) {
      clearTimeout(window.__f2wNextEpisodeLayerTimer);
      window.__f2wNextEpisodeLayerTimer = setTimeout(syncLayerForFullscreen,0);
    }
  });
})();
// f2w-force-save: next episode final-five-minutes countdown 2026-10-12
