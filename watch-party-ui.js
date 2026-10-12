/* Flix2Watch Watch Party: invite links, visible participants, chat and TV episode sync. */
(function () {
  'use strict';
  const PARAM = 'party';
  const ROOM_PATTERN = /^[a-zA-Z0-9_-]{12,96}$/;
  let connection = null;
  let participantId = '';
  let displayName = '';
  let applyingRemoteEpisode = false;
  let applyingRemoteSource = false;
  let lastSentEpisode = '';
  let lastSentSource = '';
  let observedPlaybackStatus = '';
  let observedPlaybackSeconds = null;
  let lastPlaybackBroadcastAt = 0;
  let lastRemoteCommandAt = 0;
  let lastRemoteSeekAt = 0;
  let suppressPlaybackBroadcastUntil = 0;
  const participants = new Map();
  const seenChat = new Set();

  function makeId() {
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }
  function cleanName(value) {
    return String(value || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 28);
  }
  function defaultName() {
    const saved = cleanName(localStorage.getItem('f2w_party_name'));
    if (saved) return saved;
    return 'Guest ' + Math.floor(100 + Math.random() * 900);
  }
  function currentEpisode() {
    const params = new URLSearchParams(location.search);
    const type = String(params.get('type') || params.get('mediaType') || params.get('media_type') || '').toLowerCase();
    const id = String(params.get('id') || params.get('mediaId') || params.get('tmdb') || '');
    const season = document.getElementById('season-select');
    const episode = document.getElementById('episode-select');
    if (type !== 'tv' || !id || !season || !episode || !season.value || !episode.value) return null;
    return { mediaType: 'tv', mediaId: id, season: Number(season.value), episode: Number(episode.value) };
  }
  function episodeKey(value) {
    return value ? [value.mediaType, value.mediaId, value.season, value.episode].join(':') : '';
  }
  function currentSource() {
    const active = document.querySelector('.server-btn.active');
    return active?.dataset?.server ? String(active.dataset.server) : '';
  }
  function applySource(source) {
    if (!source || typeof source !== 'string' || source.length > 80) return;
    const button = [...document.querySelectorAll('.server-btn')].find(item => item.dataset.server === source);
    if (!button || button.classList.contains('active')) return;
    applyingRemoteSource = true;
    button.click();
    setTimeout(() => { applyingRemoteSource = false; }, 800);
  }
  function broadcastSource() {
    if (!connection || applyingRemoteSource) return;
    const source = currentSource();
    if (!source || source === lastSentSource) return;
    lastSentSource = source;
    connection.send({ type: 'source-change', source }).catch(error => console.warn('[Watch Party] source sync failed', error));
  }
  function currentMedia() {
    const params = new URLSearchParams(location.search);
    return {
      mediaId: String(params.get('id') || params.get('mediaId') || params.get('tmdb') || ''),
      mediaType: String(params.get('type') || params.get('mediaType') || 'movie').toLowerCase() === 'tv' ? 'tv' : 'movie'
    };
  }
  function sendPlayerCommand(action, seconds) {
    const frame = document.getElementById('video-frame');
    if (!frame?.contentWindow) return false;
    let target = 'https://player.flix2watch.com';
    try { target = new URL(String(frame.src || ''), location.href).origin; } catch (_) {}
    const position = Math.max(0, Number(seconds) || 0);
    // Different player builds expose slightly different postMessage command
    // shapes. Send the documented command form plus compatible legacy aliases.
    const messages = action === 'seek'
      ? [
          { command: 'seek', time: position },
          { type: 'PLAYER_COMMAND', action: 'seek', command: 'seek', value: position, seconds: position, position, time: position },
          { action: 'seek', time: position }
        ]
      : [
          { command: action },
          { type: 'PLAYER_COMMAND', action, command: action },
          { action }
        ];
    let sent = false;
    for (const payload of messages) {
      try { frame.contentWindow.postMessage(payload, target); sent = true; } catch (_) {}
    }
    return sent;
  }
  function applyRemotePlayback(state) {
    if (!state || state.mediaId == null) return;
    const media = currentMedia();
    if (String(state.mediaId) !== media.mediaId || String(state.mediaType || 'movie') !== media.mediaType) return;
    const now = Date.now();
    const targetStatus = String(state.status || '').toLowerCase();
    const isPlaying = /play|resume|start/.test(targetStatus);
    const isPaused = /pause|stop/.test(targetStatus);
    if ((isPlaying || isPaused) && now - lastRemoteCommandAt > 1800 && observedPlaybackStatus !== (isPlaying ? 'playing' : 'paused')) {
      suppressPlaybackBroadcastUntil = now + 1800;
      sendPlayerCommand(isPlaying ? 'play' : 'pause');
      observedPlaybackStatus = isPlaying ? 'playing' : 'paused';
      lastRemoteCommandAt = now;
    }
    const remoteSeconds = state.seconds == null ? NaN : Number(state.seconds);
    const isExplicitSeek = /seek/.test(targetStatus);
    if (Number.isFinite(remoteSeconds) && remoteSeconds >= 0 &&
        (observedPlaybackSeconds == null || Math.abs(observedPlaybackSeconds - remoteSeconds) > (isExplicitSeek ? 1.5 : 3)) &&
        now - lastRemoteSeekAt > (isExplicitSeek ? 900 : 2500)) {
      suppressPlaybackBroadcastUntil = now + 1200;
      sendPlayerCommand('seek', remoteSeconds);
      observedPlaybackSeconds = remoteSeconds;
      lastRemoteSeekAt = now;
    }
  }
  function buildPanel() {
    const panel = document.createElement('section');
    panel.id = 'f2w-watch-party';
    panel.setAttribute('aria-label', 'Watch Party');
    panel.innerHTML = `
      <style>
        #f2w-watch-party{--wp-accent:var(--accent,#e50914);position:fixed;z-index:2147483000;right:0;top:clamp(240px, 28vh, 280px);bottom:12px;width:min(430px,calc(100vw - 48px));height:auto;margin:0;border:1px solid rgba(255,255,255,.14);border-right:0;border-radius:20px 0 0 20px;overflow:hidden;transform:translateX(calc(100% - 48px));transition:transform .28s cubic-bezier(.2,.8,.2,1);background:radial-gradient(ellipse at 8% 0%,color-mix(in srgb,var(--wp-accent) 20%,transparent),transparent 42%),linear-gradient(135deg,#15151d,#09090d 75%);color:#f7f7fb;box-shadow:0 18px 50px #0008;font-family:var(--font-body,Arial,sans-serif);display:flex;flex-direction:column} 
        #f2w-watch-party.is-open{transform:translateX(0)}
        #f2w-watch-party .wp-drawer-tab{position:absolute;left:0;top:28%;width:47px;height:164px;border-radius:0 12px 12px 0;border-left:0;background:linear-gradient(180deg,var(--wp-accent),#9b1020);display:flex;align-items:center;justify-content:center;gap:10px;writing-mode:vertical-rl;transform:none;letter-spacing:.12em;font-size:11px;font-weight:900;box-shadow:8px 8px 24px #0005;z-index:5}
        #f2w-watch-party .wp-drawer-tab .wp-tab-dot{width:7px;height:7px;border-radius:50%;background:#fff;box-shadow:0 0 12px #fff9}
        #f2w-watch-party .wp-drawer-content{height:100%;min-height:0;overflow-y:auto;overscroll-behavior:contain;margin-left:47px;display:flex;flex-direction:column}
        #f2w-watch-party .wp-top{padding:20px 18px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
        #f2w-watch-party .wp-grid{display:grid;grid-template-columns:minmax(0,1fr);border-top:1px solid #ffffff12}
        #f2w-watch-party .wp-main{padding:17px;border-right:0;border-bottom:1px solid #ffffff12;min-width:0}
        #f2w-watch-party .wp-side{padding:17px;min-width:0;background:#0002}
        #f2w-watch-party .wp-foot{border-top:1px solid #ffffff12;padding:12px 17px;color:#898997;font-size:11px;display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}
        #f2w-watch-party .wp-title{font-size:22px;font-weight:800;letter-spacing:-.04em;margin:4px 0}
        #f2w-watch-party *{box-sizing:border-box}
        #f2w-watch-party .wp-top{padding:22px 24px 18px;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
        #f2w-watch-party .wp-kicker{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#ffb3b7;font-weight:700}
        #f2w-watch-party .wp-title{font-size:24px;font-weight:800;letter-spacing:-.04em;margin:4px 0}
        #f2w-watch-party .wp-sub{font-size:12px;color:#aaaab8}
        #f2w-watch-party .wp-actions{display:flex;gap:8px;flex-wrap:wrap}
        #f2w-watch-party button{font:inherit;cursor:pointer;border:1px solid #ffffff20;border-radius:10px;padding:10px 13px;color:#f8f8fb;background:#ffffff0b;transition:transform .15s,border-color .15s,background .15s}
        #f2w-watch-party button:hover{transform:translateY(-1px);border-color:#ffffff55;background:#ffffff14}
        #f2w-watch-party .wp-primary{background:var(--wp-accent);border-color:transparent;color:white;font-weight:800}
        #f2w-watch-party .wp-primary:hover{filter:brightness(1.12)}
        #f2w-watch-party .wp-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(250px,.72fr);border-top:1px solid #ffffff12}
        #f2w-watch-party .wp-main{padding:20px 24px;border-right:1px solid #ffffff12;min-width:0}
        #f2w-watch-party .wp-side{padding:20px;min-width:0;background:#0002}
        #f2w-watch-party .wp-label{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#9292a2;font-weight:800;margin-bottom:12px}
        #f2w-watch-party .wp-name-row{display:flex;gap:8px;margin-bottom:18px}
        #f2w-watch-party input{min-width:0;width:100%;background:#08080d;border:1px solid #ffffff20;border-radius:10px;padding:11px 12px;color:white;font:inherit;font-size:13px;outline:none}
        #f2w-watch-party input:focus{border-color:var(--wp-accent)}
        #f2w-watch-party .wp-status{font-size:12px;color:#c5c5d0;margin-top:10px;min-height:18px}
        #f2w-watch-party .wp-password-box{padding:14px 20px 18px;border-top:1px solid #ffffff12;border-bottom:1px solid #ffffff12;background:#0003}
        #f2w-watch-party .wp-password-box label{display:block;font-size:12px;font-weight:700;margin-bottom:8px}
        #f2w-watch-party .wp-password-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}
        #f2w-watch-party .wp-password-actions button{flex:0 1 auto}

        #f2w-watch-party .wp-status:before{content:'';display:inline-block;width:7px;height:7px;border-radius:50%;background:#747482;margin-right:8px}
        #f2w-watch-party .wp-status[data-connected="true"]:before{background:#4ade80;box-shadow:0 0 10px #4ade8088}
        #f2w-watch-party .wp-people{display:flex;flex-direction:column;gap:9px;max-height:190px;overflow:auto}
        #f2w-watch-party .wp-person{display:flex;align-items:center;gap:10px;padding:9px;border:1px solid #ffffff0d;background:#ffffff05;border-radius:12px}
        #f2w-watch-party .wp-avatar{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:color-mix(in srgb,var(--wp-accent) 30%,#252530);font-size:12px;font-weight:900;flex:none}
        #f2w-watch-party .wp-person-name{font-size:12px;font-weight:700;overflow-wrap:anywhere}
        #f2w-watch-party .wp-you{font-size:10px;color:#a5a5b3;margin-top:2px}
        #f2w-watch-party .wp-chat{height:190px;overflow:auto;display:flex;flex-direction:column;gap:10px;margin:0 0 12px}
        #f2w-watch-party .wp-message{font-size:12px;line-height:1.45;overflow-wrap:anywhere;background:#ffffff08;padding:9px 11px;border-radius:4px 12px 12px 12px}
        #f2w-watch-party .wp-message strong{display:block;color:#ffb3b7;font-size:10px;margin-bottom:3px}
        #f2w-watch-party .wp-message-time{display:block;color:#777785;font-size:9px;text-align:right;margin-top:5px}
        #f2w-watch-party .wp-chat-row{display:flex;gap:7px}
        #f2w-watch-party .wp-chat-row input{flex:1}
        #f2w-watch-party .wp-empty{color:#777785;font-size:12px;padding:8px 0}
        #f2w-watch-party .wp-foot{border-top:1px solid #ffffff12;padding:12px 24px;color:#898997;font-size:11px;display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}
        #f2w-watch-party [hidden]{display:none!important}
        /* Compact the right-edge slider tab so it doesn't dominate the page. */
        #f2w-watch-party .wp-drawer-tab{top:0;width:40px;height:118px;gap:7px;font-size:10px;letter-spacing:.1em}
        #f2w-watch-party .wp-drawer-content{margin-left:40px}
        /* Layout polish: keep the narrow drawer readable instead of squeezing two columns together. */
        #f2w-watch-party{width:min(460px,calc(100vw - 20px))}
        #f2w-watch-party .wp-drawer-content{min-width:0;margin-left:47px;gap:0}
        #f2w-watch-party .wp-top{align-items:flex-start;padding:20px 20px 18px;gap:14px}
        #f2w-watch-party .wp-actions{width:100%;display:flex;align-items:center;gap:8px}
        #f2w-watch-party .wp-actions button{flex:1 1 auto;min-width:0;padding:10px 11px;font-size:12px}
        #f2w-watch-party .wp-grid{display:flex;flex-direction:column;min-width:0}
        #f2w-watch-party .wp-main,#f2w-watch-party .wp-side{width:100%;min-width:0;padding:18px 20px}
        #f2w-watch-party .wp-main{border-right:0;border-bottom:1px solid #ffffff12}
        #f2w-watch-party .wp-label{margin-bottom:10px}
        #f2w-watch-party .wp-name-row{display:flex;gap:8px;margin-bottom:22px}
        #f2w-watch-party .wp-name-row input{flex:1 1 auto;width:0}
        #f2w-watch-party .wp-name-row button{flex:0 0 auto;white-space:nowrap;font-size:12px;padding:10px}
        #f2w-watch-party .wp-chat{height:clamp(150px,24vh,250px);min-height:130px;padding:2px 3px 2px 0;margin-bottom:12px}
        #f2w-watch-party .wp-chat-row{align-items:stretch;gap:8px}
        #f2w-watch-party .wp-chat-row input{flex:1 1 auto;width:0}
        #f2w-watch-party .wp-chat-row button{flex:0 0 auto}
        #f2w-watch-party .wp-status{line-height:1.5;margin-top:14px}
        #f2w-watch-party .wp-people{max-height:220px;gap:8px}
        #f2w-watch-party .wp-foot{padding:14px 20px;line-height:1.5}
        #f2w-watch-party button{max-width:100%;white-space:normal}
        @media(max-width:650px){
          #f2w-watch-party{top:clamp(200px,24vh,230px);bottom:8px;width:calc(100vw - 12px)}
          #f2w-watch-party .wp-top{padding:18px 16px 16px}
          #f2w-watch-party .wp-main,#f2w-watch-party .wp-side{padding:16px}
          #f2w-watch-party .wp-title{font-size:21px}
          #f2w-watch-party .wp-actions{gap:6px}
          #f2w-watch-party .wp-actions button{padding:10px 8px;font-size:11px}
          #f2w-watch-party .wp-name-row{gap:6px}
          #f2w-watch-party .wp-name-row button{padding:10px 8px}
          #f2w-watch-party .wp-chat-row button{padding:10px 12px}
          #f2w-watch-party .wp-foot{padding:12px 16px}
        }
      </style>
      <button class="wp-drawer-tab" id="f2w-party-toggle" type="button" aria-expanded="false" aria-controls="f2w-watch-party"><span class="wp-tab-dot"></span><span>WATCH PARTY</span></button>
      <div class="wp-drawer-content">
      <div class="wp-top">
        <div><div class="wp-kicker">FLIX2WATCH · WATCH TOGETHER</div><div class="wp-title">Watch Party <span style="font-size:13px;color:#8f8f9d;font-weight:500">/ your room</span></div><div class="wp-sub">Bring your people. Watch the same stream together.</div></div>
        <div class="wp-actions"><button type="button" id="f2w-party-copy" hidden>↗ Copy invite</button><button type="button" id="f2w-party-create" class="wp-primary">＋ Create party</button><button type="button" id="f2w-party-leave" hidden>Leave room</button></div>
      </div>
      <div id="f2w-party-password-box" class="wp-password-box" hidden>
        <label id="f2w-party-password-label" for="f2w-party-password">Room password (optional)</label>
        <input id="f2w-party-password" type="password" maxlength="64" autocomplete="new-password" placeholder="Set a password or leave blank">
        <div class="wp-password-actions"><button type="button" id="f2w-party-password-cancel">Cancel</button><button type="button" id="f2w-party-password-submit" class="wp-primary">Create room</button></div>
      </div>
      <div class="wp-grid">
        <div class="wp-main">
          <div class="wp-label">Your party identity</div>
          <div class="wp-name-row"><input id="f2w-party-name" maxlength="28" aria-label="Your party username" placeholder="Choose a username"><button type="button" id="f2w-party-save">Save name</button></div>
          <div class="wp-label">Party chat</div>
          <div class="wp-chat" id="f2w-party-chat" aria-live="polite"><div class="wp-empty">Your party chat will appear here.</div></div>
          <form class="wp-chat-row" id="f2w-party-chat-form"><input id="f2w-party-chat-input" maxlength="500" placeholder="Say something to the party…" aria-label="Party message" autocomplete="off"><button class="wp-primary" type="submit">Send</button></form>
          <div class="wp-status" id="f2w-party-status" role="status">Create a room or open a friend's invite link.</div>
        </div>
        <aside class="wp-side"><div class="wp-label">In this room <span id="f2w-party-count" style="color:#f7f7fb">· 0</span></div><div class="wp-people" id="f2w-party-people"><div class="wp-empty">No one here yet. Invite your friends.</div></div><div style="margin-top:20px"><div class="wp-label">Shared playback</div><div class="wp-sub">Source, season, episode and playback controls are shared with your party. Player commands depend on provider support.</div></div></aside>
      </div>
      <div class="wp-foot"><span>🔒 Invite-only room</span><span id="f2w-party-room-label">No room created</span></div>
      </div>`;
    document.body.appendChild(panel);
    // Align the visible edge tab and drawer with the actual top of the player.
    const alignToPlayer = () => {
      const player = document.getElementById('flix-player-container');
      if (!player || !panel.isConnected) return;
      const playerTop = player.getBoundingClientRect().top;
      if (Number.isFinite(playerTop)) panel.style.top = Math.max(0, Math.round(playerTop)) + 'px';
    };
    requestAnimationFrame(alignToPlayer);
    window.addEventListener('resize', alignToPlayer, { passive: true });

    return panel;
  }
  function init() {
    if (!document.querySelector('.player-wrapper') || document.getElementById('f2w-watch-party')) return;
    const panel = buildPanel();
    if (!panel) return;
    const $ = selector => panel.querySelector(selector);
    const status = $('#f2w-party-status');
    const createButton = $('#f2w-party-create');
    const copyButton = $('#f2w-party-copy');
    const leaveButton = $('#f2w-party-leave');
    const nameInput = $('#f2w-party-name');
    const peopleEl = $('#f2w-party-people');
    const chatEl = $('#f2w-party-chat');
    const roomLabel = $('#f2w-party-room-label');
    const chatSendTimes = [];
    let chatCooldownUntil = 0;
    // Every tab gets its own identity; sessionStorage can be cloned when a tab is duplicated.
    participantId = makeId();
    displayName = defaultName();
    nameInput.value = displayName;
    // Prefer the signed-in Flix2Watch account name; guests can still choose their own.
    (async function loadAccountName() {
      if (cleanName(localStorage.getItem('f2w_party_name')) || !window.f2wSupabase?.auth?.getSession) return;
      try {
        const result = await window.f2wSupabase.auth.getSession();
        const user = result?.data?.session?.user;
        if (!user) return;
        const meta = user.user_metadata || {};
        const accountName = cleanName(meta.username || meta.user_name || meta.display_name || meta.full_name || meta.name || String(user.email || '').split('@')[0]);
        if (!accountName) return;
        displayName = accountName;
        nameInput.value = accountName;
        if (connection) {
          participants.set(participantId, myHello());
          renderPeople();
          await connection.send({ type: 'hello', participant: myHello(), episode: currentEpisode(), source: currentSource() });
        }
      } catch (_) {}
    })();
    function setStatus(message, connected) {
      status.textContent = message;
      if (connected !== undefined) status.dataset.connected = String(connected);
    }
    function renderPeople() {
      peopleEl.replaceChildren();
      $('#f2w-party-count').textContent = '· ' + participants.size;
      if (!participants.size) {
        const empty = document.createElement('div'); empty.className = 'wp-empty'; empty.textContent = 'No one here yet. Invite your friends.'; peopleEl.append(empty); return;
      }
      participants.forEach(person => {
        const item = document.createElement('div'); item.className = 'wp-person';
        const avatar = document.createElement('div'); avatar.className = 'wp-avatar'; avatar.textContent = (person.name || '?').slice(0, 1).toUpperCase();
        const meta = document.createElement('div'); meta.style.minWidth = '0';
        const name = document.createElement('div'); name.className = 'wp-person-name'; name.textContent = person.name || 'Guest';
        const you = document.createElement('div'); you.className = 'wp-you';
        you.textContent = (person.host ? '★ Host' : 'In this room') + (person.id === participantId ? ' · You' : '');
        meta.append(name, you); item.append(avatar, meta); peopleEl.append(item);
      });
    }
    function addChatMessage(person, text, id) {
      if (id && seenChat.has(id)) return;
      if (id) { seenChat.add(id); if (seenChat.size > 300) seenChat.delete(seenChat.values().next().value); }
      if (chatEl.querySelector('.wp-empty')) chatEl.replaceChildren();
      const item = document.createElement('div'); item.className = 'wp-message';
      const author = document.createElement('strong'); author.textContent = person || 'Guest';
      const body = document.createElement('div'); body.textContent = String(text || '').slice(0, 500);
      const time = document.createElement('time'); time.className = 'wp-message-time';
      time.dateTime = new Date().toISOString(); time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      item.append(author, body, time); chatEl.append(item); chatEl.scrollTop = chatEl.scrollHeight;
    }
    function myHello() { return { id: participantId, name: displayName }; }
    async function apiRequest(path, body) {
      const base = window.F2WWatchPartyRealtime?.API_BASE;
      if (!base) throw new Error('The Watch Party API is not configured.');
      let lastError;
      // Render's free API may need time to wake after inactivity. Allow a long
      // first request and retry transient gateway/network failures automatically.
      for (let attempt = 0; attempt < 3; attempt++) {
        let timer;
        try {
          const controller = new AbortController();
          timer = setTimeout(() => controller.abort(), 90000);
          const response = await fetch(base + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body || {}),
            signal: controller.signal,
            cache: 'no-store'
          });
          const data = await response.json().catch(() => ({}));
          if (response.ok) return data;
          const error = new Error(data.error || 'The Watch Party API request failed.');
          error.statusCode = response.status;
          if (![502, 503, 504, 522, 524].includes(response.status) || attempt === 2) throw error;
          lastError = error;
        } catch (error) {
          lastError = error;
          const transient = error.name === 'AbortError' || error instanceof TypeError ||
            [502, 503, 504, 522, 524].includes(error.statusCode) ||
            /fetch|network|temporar|timeout|gateway|unavailable/i.test(String(error.message || ''));
          if (attempt === 2 || !transient) throw error;
        } finally {
          clearTimeout(timer);
        }
        setStatus(attempt === 0 ? 'Waking the party service… retrying automatically.' : 'Still reconnecting to the party service…', false);
        await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 1800 : 3500));
      }
      throw new Error('The party service is taking too long to wake. Please try again in a moment. ' + (lastError?.message || ''));
    }
    function navigateToMedia(media, roomId) {
      const id = String(media?.id || '');
      const type = media?.type === 'tv' ? 'tv' : 'movie';
      if (!/^[0-9]+$/.test(id)) return;
      const url = new URL(location.href);
      url.searchParams.set('id', id);
      url.searchParams.set('type', type);
      if (roomId) url.searchParams.set(PARAM, roomId);
      location.assign(url.href);
    }
    const passwordBox = $('#f2w-party-password-box');
    const passwordInput = $('#f2w-party-password');
    const passwordLabel = $('#f2w-party-password-label');
    const passwordSubmit = $('#f2w-party-password-submit');
    let passwordFlow = null;
    function showPasswordForm(flow) {
      passwordFlow = flow;
      passwordBox.hidden = false;
      passwordInput.value = '';
      const creating = flow.mode === 'create';
      passwordLabel.textContent = creating ? 'Room password (optional)' : 'Enter the room password (if required)';
      passwordInput.placeholder = creating ? 'Set a password or leave blank' : 'Room password';
      passwordInput.autocomplete = creating ? 'new-password' : 'current-password';
      passwordSubmit.textContent = creating ? 'Create room' : 'Join room';
      passwordInput.setAttribute('aria-label', creating ? 'Optional room password' : 'Party room password');
      setStatus(creating ? 'Add a password to protect your room, or leave it blank.' : 'Enter the room password, or leave blank if it has none.', false);
      passwordInput.focus();
    }
    function hidePasswordForm() {
      passwordBox.hidden = true;
      passwordFlow = null;
      passwordInput.value = '';
    }
    async function createRoom(password) {
      if (password === undefined) { showPasswordForm({ mode: 'create' }); return; }
      if (password && (password.length < 4 || password.length > 64)) {
        setStatus('Room passwords must be 4–64 characters.'); passwordInput.focus(); return;
      }
      hidePasswordForm();
      try {
        setStatus('Creating your room…', false);
        const media = currentMedia();
        const result = await apiRequest('/api/rooms', {
          name: displayName, password,
          media: { id: media.mediaId, type: media.mediaType, title: document.getElementById('detail-title')?.textContent || '' }
        });
        await join(result.roomId, result.token, result.passwordProtected);
      } catch (error) {
        setStatus(error.message || 'Could not create a party.');
      }
    }
    async function join(roomId, issuedToken, passwordProtected, suppliedPassword) {
      if (!window.F2WWatchPartyRealtime) { setStatus('Party service is unavailable. Refresh and try again.'); return; }
      if (!/^[a-f0-9]{24}$/i.test(String(roomId || ''))) { setStatus('That invite link is invalid.'); return; }
      if (connection) await connection.close();
      participants.clear(); renderPeople();
      setStatus('Connecting to your room…', false);
      try {
        let token = issuedToken || sessionStorage.getItem('f2w_party_token_' + roomId) || '';
        if (!token) {
          if (suppliedPassword === undefined) {
            showPasswordForm({ mode: 'join', roomId });
            return;
          }
          const result = await apiRequest('/api/rooms/' + encodeURIComponent(roomId) + '/join', { name: displayName, password: suppliedPassword });
          token = result.token;
          passwordProtected = result.passwordProtected;
        }
        sessionStorage.setItem('f2w_party_token_' + roomId, token);
        connection = window.F2WWatchPartyRealtime.connect({
          roomId, token, participantId, name: displayName,
          onDisconnect: function () {
            participants.clear(); renderPeople();
            createButton.hidden = false; copyButton.hidden = true; leaveButton.hidden = true;
            setStatus('Connection lost. Rejoin the room to continue.', false);
          },
          onPresence: function (list) {
            participants.clear();
            (Array.isArray(list) ? list : []).forEach(person => {
              if (!person || !person.id) return;
              participants.set(String(person.id), { id: String(person.id), name: cleanName(person.name) || 'Guest', host: Boolean(person.host) });
            });
            renderPeople();
          },
          onMessage: function (message) {
            if (message.type === 'room-state') {
              if (message.media && (String(message.media.id) !== currentMedia().mediaId || message.media.type !== currentMedia().mediaType)) {
                navigateToMedia(message.media, roomId);
                return;
              }
              if (Array.isArray(message.participants)) {
                participants.clear();
                message.participants.forEach(person => {
                  if (person?.id) participants.set(String(person.id), { id: String(person.id), name: cleanName(person.name) || 'Guest', host: Boolean(person.host) });
                });
                renderPeople();
              }
              if (message.source) applySource(message.source);
              if (message.season) applyRemoteSeason(message.season);
              if (message.episode) applyEpisode(message.episode);
              if (message.playbackState) applyRemotePlayback(message.playbackState);
              passwordProtected = Boolean(message.passwordProtected);
              setStatus('Connected · invite your friends to join.', true);
            } else if (message.type === 'hello' && message.participant) {
              const person = message.participant;
              if (!person.id || person.id === participantId) return;
              participants.set(person.id, { id: String(person.id), name: cleanName(person.name) || 'Guest', host: Boolean(person.host) });
              renderPeople();
              if (message.source) applySource(message.source);
              if (message.episode) applyEpisode(message.episode);
            } else if (message.type === 'presence-sync') {
              // The transport normally consumes this event; keep this defensive fallback.
              if (Array.isArray(message.participants)) {
                participants.clear();
                message.participants.forEach(person => { if (person?.id) participants.set(String(person.id), { id: String(person.id), name: cleanName(person.name) || 'Guest', host: Boolean(person.host) }); });
                renderPeople();
              }
            } else if (message.type === 'participant-left') {
              participants.delete(String(message.participantId || '')); renderPeople();
            } else if (message.type === 'media-change' && message.media) {
              const activeRoom = new URLSearchParams(location.search).get(PARAM) || roomId;
              navigateToMedia(message.media, activeRoom);
            } else if (message.type === 'season-change') {
              applyRemoteSeason(message);
            } else if (message.type === 'episode-change') {
              applyEpisode(message.episode);
            } else if (message.type === 'source-change') {
              applySource(message.source);
            } else if (message.type === 'playback-state' && message.state) {
              applyRemotePlayback(message.state);
              const label = message.state.status ? String(message.state.status) : 'updated';
              setStatus('Room connected · playback sync active (' + label + ').', true);
            } else if (message.type === 'playback-command') {
              const media = currentMedia();
              applyRemotePlayback({ mediaId: media.mediaId, mediaType: media.mediaType, status: message.action, seconds: message.seconds });
            } else if (message.type === 'chat-message' && message.participantId !== participantId) {
              addChatMessage(message.name, message.text, message.messageId);
            } else if (message.type === 'chat-cooldown') {
              chatCooldownUntil = Number(message.until) || Date.now() + 30000;
              setStatus('Spam protection: chat paused for ' + Math.ceil((chatCooldownUntil - Date.now()) / 1000) + ' seconds.', true);
            }
          }
        });
        await connection.ready;
        const url = new URL(location.href); url.searchParams.set(PARAM, roomId); history.replaceState(null, '', url);
        createButton.hidden = true; copyButton.hidden = false; leaveButton.hidden = false;
        roomLabel.textContent = (passwordProtected ? '🔒 ' : '') + 'ROOM ' + roomId.slice(0, 8).toUpperCase();
        await connection.send({ type: 'hello', participant: myHello(), episode: currentEpisode(), source: currentSource() });
        setStatus('Connected · invite your friends to join.', true);
      } catch (error) {
        console.error('[Watch Party] connection failed', error);
        connection = null;
        try { sessionStorage.removeItem('f2w_party_token_' + roomId); } catch (_) {}
        if (suppliedPassword !== undefined && /password|too many/i.test(String(error.message || ''))) {
          showPasswordForm({ mode: 'join', roomId });
          setStatus(error.message || 'Could not join with that password.', false);
          return;
        }
        setStatus(error.message || 'Could not connect. Check the connection and try again.', false);
      }
    }
    function applyRemoteSeason(message) {
      const media = currentMedia();
      const season = document.getElementById('season-select');
      const episodeSelect = document.getElementById('episode-select');
      const target = String(Number(message?.season));
      if (media.mediaType !== 'tv' || media.mediaId !== String(message?.mediaId || '') ||
          !Number.isFinite(Number(message?.season)) || !season || season.value === target ||
          ![...season.options].some(option => option.value === target)) return;
      applyingRemoteEpisode = true;
      let finished = false;
      const finish = () => { if (finished) return; finished = true; observer.disconnect(); applyingRemoteEpisode = false; };
      const observer = new MutationObserver(() => finish());
      if (episodeSelect) observer.observe(episodeSelect, { childList: true, subtree: true });
      season.value = target;
      if (typeof window.onSeasonChange === 'function') window.onSeasonChange();
      setTimeout(finish, 6000);
    }
    function applyEpisode(episode) {
      if (!episode || episode.mediaType !== 'tv') return;
      const current = currentEpisode();
      if (!current || current.mediaId !== String(episode.mediaId) || !Number.isFinite(Number(episode.season)) || !Number.isFinite(Number(episode.episode))) return;
      if (current.season === Number(episode.season) && current.episode === Number(episode.episode)) return;
      const season = document.getElementById('season-select');
      const episodeSelect = document.getElementById('episode-select');
      if (!season || !episodeSelect) return;
      const targetSeason = String(Number(episode.season));
      const targetEpisode = String(Number(episode.episode));
      if (![...season.options].some(option => option.value === targetSeason)) return;
      applyingRemoteEpisode = true;
      const finish = () => { applyingRemoteEpisode = false; };
      const applyTargetEpisode = () => {
        if (![...episodeSelect.options].some(option => option.value === targetEpisode)) return false;
        episodeSelect.value = targetEpisode;
        if (typeof window.onEpisodeChange === 'function') window.onEpisodeChange();
        finish();
        return true;
      };
      if (season.value === targetSeason) {
        if (!applyTargetEpisode()) finish();
        return;
      }
      let done = false;
      const observer = new MutationObserver(() => {
        if (done) return;
        if (applyTargetEpisode()) { done = true; observer.disconnect(); }
      });
      observer.observe(episodeSelect, { childList: true, subtree: true });
      season.value = targetSeason;
      if (typeof window.onSeasonChange === 'function') window.onSeasonChange();
      setTimeout(() => {
        if (done) return;
        done = true; observer.disconnect();
        applyTargetEpisode();
        finish();
      }, 6000);
    }
    const toggleButton = $('#f2w-party-toggle');
    toggleButton.addEventListener('click', () => {
      const open = panel.classList.toggle('is-open');
      toggleButton.setAttribute('aria-expanded', String(open));
      toggleButton.innerHTML = '<span class="wp-tab-dot"></span><span>' + (open ? 'CLOSE PARTY' : 'WATCH PARTY') + '</span>';
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && panel.classList.contains('is-open')) {
        panel.classList.remove('is-open');
        toggleButton.setAttribute('aria-expanded', 'false');
        toggleButton.innerHTML = '<span class="wp-tab-dot"></span><span>WATCH PARTY</span>';
      }
    });
    createButton.addEventListener('click', () => createRoom());
    passwordSubmit.addEventListener('click', async () => {
      if (!passwordFlow) return;
      const flow = passwordFlow;
      const password = passwordInput.value;
      if (flow.mode === 'create') await createRoom(password);
      else {
        if (password.length > 64) { setStatus('Room passwords must be 64 characters or fewer.'); return; }
        hidePasswordForm();
        await join(flow.roomId, null, null, password);
      }
    });
    passwordInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); passwordSubmit.click(); }
      if (event.key === 'Escape') hidePasswordForm();
    });
    $('#f2w-party-password-cancel').addEventListener('click', () => {
      hidePasswordForm(); setStatus('Cancelled.', Boolean(connection));
    });
    $('#f2w-party-save').addEventListener('click', () => {
      const name = cleanName(nameInput.value);
      if (!name) { setStatus('Choose a name first.'); return; }
      displayName = name; nameInput.value = name;
      localStorage.setItem('f2w_party_name', name);
      if (connection) {
        participants.set(participantId, myHello()); renderPeople();
        connection.send({ type: 'hello', participant: myHello(), episode: currentEpisode(), source: currentSource() }).catch(() => {});
      }
      setStatus('Your party name is saved.', Boolean(connection));
    });
    copyButton.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(location.href); setStatus('Invite link copied.', true); }
      catch (_) { setStatus('Copy failed. Copy the URL from your address bar.', true); }
    });
    leaveButton.addEventListener('click', async () => {
      if (connection) {
        try { await connection.send({ type: 'participant-left', participantId }); } catch (_) {}
        await connection.close();
      }
      connection = null; participants.clear(); renderPeople();
      try { sessionStorage.removeItem('f2w_party_token_' + new URLSearchParams(location.search).get(PARAM)); } catch (_) {}
      const url = new URL(location.href); url.searchParams.delete(PARAM); history.replaceState(null, '', url);
      createButton.hidden = false; copyButton.hidden = true; leaveButton.hidden = true; roomLabel.textContent = 'No room created';
      setStatus('You left the room.', false);
    });
    $('#f2w-party-chat-form').addEventListener('submit', async event => {
      event.preventDefault();
      const input = $('#f2w-party-chat-input');
      const text = String(input.value || '').trim().slice(0, 500);
      if (!text) return;
      if (!connection) { setStatus('Join a party before chatting.'); return; }
      const now = Date.now();
      if (now < chatCooldownUntil) {
        setStatus('Spam protection: chat unlocks in ' + Math.ceil((chatCooldownUntil - now) / 1000) + 's.', true);
        return;
      }
      while (chatSendTimes.length && now - chatSendTimes[0] > 3000) chatSendTimes.shift();
      chatSendTimes.push(now);
      if (chatSendTimes.length >= 5) {
        chatCooldownUntil = now + 30000;
        chatSendTimes.length = 0;
        setStatus('Too many messages too quickly. Chat is paused for 30 seconds.', true);
        return;
      }
      const messageId = makeId();
      const message = { type: 'chat-message', participantId, name: displayName, text, messageId };
      try {
        await connection.send(message);
        addChatMessage(displayName, text, messageId);
        input.value = '';
      } catch (_) { setStatus('Message could not be sent. Try again.'); }
    });
    document.addEventListener('change', async event => {
      if (applyingRemoteEpisode || !connection || !event.target) return;
      const episode = currentEpisode();
      if (event.target.id === 'season-select') {
        if (!episode) return;
        try { await connection.send({ type: 'season-change', mediaId: episode.mediaId, season: episode.season }); }
        catch (error) { console.warn('[Watch Party] season sync failed', error); }
        return;
      }
      if (event.target.id !== 'episode-select') return;
      const key = episodeKey(episode);
      if (!episode || !key || key === lastSentEpisode) return;
      lastSentEpisode = key;
      try { await connection.send({ type: 'episode-change', episode }); } catch (error) { console.warn('[Watch Party] episode sync failed', error); }
    });
    const episodeSelect = document.getElementById('episode-select');
    if (episodeSelect) {
      let optionSignature = [...episodeSelect.options].map(option => option.value).join(',');
      new MutationObserver(() => {
        const nextSignature = [...episodeSelect.options].map(option => option.value).join(',');
        if (nextSignature === optionSignature) return;
        optionSignature = nextSignature;
        if (applyingRemoteEpisode || !connection) return;
        const episode = currentEpisode(); const key = episodeKey(episode);
        if (!episode || !key || key === lastSentEpisode) return;
        lastSentEpisode = key;
        connection.send({ type: 'episode-change', episode }).catch(error => console.warn('[Watch Party] episode sync failed', error));
      }).observe(episodeSelect, { childList: true, subtree: true });
    }
    document.addEventListener('click', event => {
      if (!connection || event.defaultPrevented) return;
      const link = event.target?.closest?.('a[href]');
      if (!link || (link.target && link.target !== '_self')) return;
      let next;
      try { next = new URL(link.href, location.href); } catch (_) { return; }
      if (next.origin !== location.origin || !next.pathname.startsWith('/watch')) return;
      const nextId = String(next.searchParams.get('id') || '');
      const nextType = next.searchParams.get('type') === 'tv' ? 'tv' : 'movie';
      const current = currentMedia();
      if (!/^[0-9]+$/.test(nextId) || (nextId === current.mediaId && nextType === current.mediaType)) return;
      event.preventDefault();
      const roomId = new URLSearchParams(location.search).get(PARAM);
      next.searchParams.set(PARAM, roomId);
      const media = { id: nextId, type: nextType, title: String(link.textContent || '').trim().slice(0, 160) };
      connection.send({ type: 'media-change', media }).catch(() => {}).finally(() => location.assign(next.href));
    }, true);
    const sourceObserver = new MutationObserver(broadcastSource);
    sourceObserver.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    document.addEventListener('click', event => {
      if (event.target?.closest?.('.server-btn')) setTimeout(broadcastSource, 120);
    });
    window.addEventListener('message', event => {
      if (!connection) return;
      const frame = document.getElementById('video-frame');
      if (!frame?.contentWindow || event.source !== frame.contentWindow) return;
      let payload = event.data;
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch (_) { return; }
      }
      if (!payload || typeof payload !== 'object') return;
      const nested = payload.data || payload.payload || payload.detail || payload.state || payload;
      if (!nested || typeof nested !== 'object') return;
      const type = String(payload.type || payload.event || payload.action || payload.command || nested.type || nested.event || nested.action || nested.command || '').toLowerCase();
      const rawStatus = nested.player_status ?? nested.status ?? nested.playbackState ?? nested.state ?? nested.event ?? nested.action ?? type;
      const status = typeof rawStatus === 'string' ? rawStatus.toLowerCase() : type;
      const progressRaw = nested.player_progress ?? nested.currentTime ?? nested.current_time ?? nested.seconds ?? nested.position ?? nested.time ?? payload.player_progress ?? payload.currentTime;
      const progress = Number(progressRaw);
      const hasProgress = progressRaw !== undefined && progressRaw !== null && Number.isFinite(progress) && progress >= 0;
      const isPlaying = /(^|[^a-z])(play|playing|resume|resumed|start|started)([^a-z]|$)/.test(status) || /player.?play/.test(type);
      const isPaused = /(^|[^a-z])(pause|paused|stop|stopped)([^a-z]|$)/.test(status) || /player.?pause/.test(type);
      const isSeek = /seek|time.?update|progress|timeupdate/.test(status + ' ' + type);
      if (!isPlaying && !isPaused && !isSeek && !hasProgress) return;
      if (hasProgress) observedPlaybackSeconds = progress;
      if (isPlaying) observedPlaybackStatus = 'playing';
      else if (isPaused) observedPlaybackStatus = 'paused';
      const now = Date.now();
      if (now < suppressPlaybackBroadcastUntil) return;
      const media = currentMedia();
      const episode = currentEpisode();
      const seconds = hasProgress ? progress : observedPlaybackSeconds;
      const state = {
        mediaId: media.mediaId, mediaType: media.mediaType,
        status: isPlaying ? 'playing' : isPaused ? 'paused' : isSeek ? 'seeked' : status,
        seconds,
        duration: Number(nested.player_duration || nested.duration || payload.duration || 0),
        season: episode?.season || null, episode: episode?.episode || null
      };
      if (isPlaying || isPaused) {
        connection.send({ type: 'playback-command', action: isPlaying ? 'play' : 'pause', seconds }).catch(() => {});
      } else if (isSeek && hasProgress) {
        connection.send({ type: 'playback-command', action: 'seek', seconds }).catch(() => {});
      } else if (now - lastPlaybackBroadcastAt < 1000) return;
      lastPlaybackBroadcastAt = now;
      connection.send({ type: 'playback-state', state }).catch(() => {});
    });
    // Reuse the watch page's established telemetry bridge. It already normalizes
    // provider-specific player messages into playback status and timeline updates.
    let lastTelemetryStatus = '';
    let lastTelemetryPosition = null;
    let lastTelemetryCommandAt = 0;
    let telemetryChannel = null;
    try {
      telemetryChannel = new BroadcastChannel('f2w-playback-v182');
      telemetryChannel.addEventListener('message', event => {
        if (!connection || !event.data || event.data.type !== 'f2w-playback-v182') return;
        const data = event.data;
        const media = currentMedia();
        if (String(data.media_id || '') !== media.mediaId ||
            String(data.media_type || 'movie').toLowerCase() !== media.mediaType) return;
        const status = String(data.playback_status || '').toLowerCase();
        const rawPosition = data.position_seconds;
        const position = rawPosition == null ? null : Number(rawPosition);
        const hasPosition = Number.isFinite(position) && position >= 0;
        const now = Date.now();
        const statusChanged = (status === 'playing' || status === 'paused') && status !== lastTelemetryStatus;
        const jumped = hasPosition && lastTelemetryPosition != null && Math.abs(position - lastTelemetryPosition) > 2.25;
        if (now >= suppressPlaybackBroadcastUntil && (statusChanged || jumped) && now - lastTelemetryCommandAt > 800) {
          if (statusChanged) {
            connection.send({ type: 'playback-command', action: status === 'playing' ? 'play' : 'pause', seconds: hasPosition ? position : null }).catch(() => {});
          } else if (jumped) {
            connection.send({ type: 'playback-command', action: 'seek', seconds: position }).catch(() => {});
          }
          lastTelemetryCommandAt = now;
        }
        if (status === 'playing' || status === 'paused') lastTelemetryStatus = status;
        if (hasPosition) lastTelemetryPosition = position;
        if (now - lastPlaybackBroadcastAt >= 900 && (status === 'playing' || status === 'paused' || hasPosition)) {
          lastPlaybackBroadcastAt = now;
          connection.send({ type: 'playback-state', state: {
            mediaId: media.mediaId, mediaType: media.mediaType,
            status: status || observedPlaybackStatus || 'unknown',
            seconds: hasPosition ? position : null,
            duration: Number(data.duration_seconds) || 0
          }}).catch(() => {});
        }
      });
    } catch (_) {}
    const initialRoom = new URLSearchParams(location.search).get(PARAM);
    if (initialRoom) join(initialRoom);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
