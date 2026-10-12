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
    const payload = { type: 'PLAYER_COMMAND', action: action, command: action };
    if (action === 'seek') {
      const position = Math.max(0, Number(seconds) || 0);
      Object.assign(payload, { value: position, seconds: position, position: position, time: position });
    }
    try { frame.contentWindow.postMessage(payload, target); return true; }
    catch (_) { return false; }
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
    const remoteSeconds = Number(state.seconds);
    if (Number.isFinite(remoteSeconds) && remoteSeconds >= 0 &&
        (observedPlaybackSeconds == null || Math.abs(observedPlaybackSeconds - remoteSeconds) > 6) &&
        now - lastRemoteSeekAt > 6000) {
      suppressPlaybackBroadcastUntil = now + 1800;
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
        #f2w-watch-party{--wp-accent:var(--accent,#e50914);margin:22px 0 28px;border:1px solid rgba(255,255,255,.12);border-radius:20px;overflow:hidden;background:radial-gradient(ellipse at 8% 0%,color-mix(in srgb,var(--wp-accent) 20%,transparent),transparent 42%),linear-gradient(135deg,#15151d,#09090d 75%);color:#f7f7fb;box-shadow:0 18px 50px #0005;font-family:var(--font-body,Arial,sans-serif)}
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
        #f2w-watch-party .wp-chat-row{display:flex;gap:7px}
        #f2w-watch-party .wp-chat-row input{flex:1}
        #f2w-watch-party .wp-empty{color:#777785;font-size:12px;padding:8px 0}
        #f2w-watch-party .wp-foot{border-top:1px solid #ffffff12;padding:12px 24px;color:#898997;font-size:11px;display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}
        #f2w-watch-party [hidden]{display:none!important}
        @media(max-width:650px){#f2w-watch-party .wp-grid{grid-template-columns:1fr}#f2w-watch-party .wp-main{border-right:0;border-bottom:1px solid #ffffff12;padding:18px}#f2w-watch-party .wp-side{padding:18px}#f2w-watch-party .wp-top{padding:18px}#f2w-watch-party .wp-title{font-size:21px}}
      </style>
      <div class="wp-top">
        <div><div class="wp-kicker">Flix2Watch · Watch together</div><div class="wp-title">Watch Party <span style="font-size:13px;color:#8f8f9d;font-weight:500">/ your room</span></div><div class="wp-sub">Bring your people. Watch the same stream together.</div></div>
        <div class="wp-actions"><button type="button" id="f2w-party-copy" hidden>↗ Copy invite</button><button type="button" id="f2w-party-create" class="wp-primary">＋ Create party</button><button type="button" id="f2w-party-leave" hidden>Leave room</button></div>
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
      <div class="wp-foot"><span>🔒 Private invite link · Only people with the link can join</span><span id="f2w-party-room-label">No room created</span></div>`;
    const ratingCard = document.getElementById('f2w-v34-rating-card');
    const player = document.querySelector('.player-wrapper');
    if (ratingCard?.parentNode) ratingCard.parentNode.insertBefore(panel, ratingCard);
    else if (player?.parentNode) player.parentNode.insertBefore(panel, player.nextSibling);
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
    participantId = sessionStorage.getItem('f2w_party_participant_id') || makeId();
    sessionStorage.setItem('f2w_party_participant_id', participantId);
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
        const you = document.createElement('div'); you.className = 'wp-you'; you.textContent = person.id === participantId ? 'You · in this room' : 'In this room';
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
      item.append(author, body); chatEl.append(item); chatEl.scrollTop = chatEl.scrollHeight;
    }
    function myHello() { return { id: participantId, name: displayName }; }
    async function join(roomId) {
      if (!window.F2WWatchPartyRealtime || !window.f2wSupabase) { setStatus('Party service is unavailable. Refresh and try again.'); return; }
      if (!ROOM_PATTERN.test(roomId)) { setStatus('That invite link is invalid.'); return; }
      if (connection) await connection.close();
      setStatus('Connecting to your room…', false);
      try {
        connection = window.F2WWatchPartyRealtime.connect({
          supabase: window.f2wSupabase, roomId,
          onMessage: function (message) {
            if (message.type === 'hello' && message.participant) {
              const person = message.participant;
              if (!person.id || person.id === participantId) return;
              const isNew = !participants.has(person.id);
              participants.set(person.id, { id: String(person.id), name: cleanName(person.name) || 'Guest' });
              renderPeople();
              if (isNew && connection) connection.send({ type: 'hello', participant: myHello(), episode: currentEpisode(), source: currentSource() }).catch(() => {});
              if (message.source) applySource(message.source);
              if (message.episode) applyEpisode(message.episode);
            } else if (message.type === 'participant-left') {
              participants.delete(String(message.participantId || '')); renderPeople();
            } else if (message.type === 'episode-change') {
              applyEpisode(message.episode);
            } else if (message.type === 'source-change') {
              applySource(message.source);
            } else if (message.type === 'playback-state' && message.state) {
              applyRemotePlayback(message.state);
              const label = message.state.status ? String(message.state.status) : 'updated';
              setStatus('Room connected · playback sync active (' + label + ').', true);
            } else if (message.type === 'chat-message' && message.participantId !== participantId) {
              addChatMessage(message.name, message.text, message.messageId);
            }
          }
        });
        await connection.ready;
        const url = new URL(location.href); url.searchParams.set(PARAM, roomId); history.replaceState(null, '', url);
        createButton.hidden = true; copyButton.hidden = false; leaveButton.hidden = false;
        roomLabel.textContent = 'ROOM ' + roomId.slice(0, 8).toUpperCase();
        participants.set(participantId, myHello()); renderPeople();
        setStatus('Connected · invite your friends to join.', true);
        await connection.send({ type: 'hello', participant: myHello(), episode: currentEpisode() });
      } catch (error) {
        console.error('[Watch Party] connection failed', error);
        setStatus('Could not connect. Check the connection and try again.', false);
      }
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
    createButton.addEventListener('click', () => join(makeId()));
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
      const messageId = makeId();
      const message = { type: 'chat-message', participantId, name: displayName, text, messageId };
      try {
        await connection.send(message);
        addChatMessage(displayName, text, messageId);
        input.value = '';
      } catch (_) { setStatus('Message could not be sent. Try again.'); }
    });
    document.addEventListener('change', async event => {
      if (applyingRemoteEpisode || !connection || !event.target || event.target.id !== 'episode-select') return;
      const episode = currentEpisode(); const key = episodeKey(episode);
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
    const sourceObserver = new MutationObserver(broadcastSource);
    sourceObserver.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    document.addEventListener('click', event => {
      if (event.target?.closest?.('.server-btn')) setTimeout(broadcastSource, 120);
    });
    window.addEventListener('message', event => {
      if (!connection || event.origin !== 'https://player.flix2watch.com') return;
      const payload = event.data;
      if (!payload || payload.type !== 'PLAYER_EVENT' || !payload.data) return;
      const progress = Number(payload.data.player_progress || 0);
      const status = String(payload.data.player_status || '').toLowerCase();
      if (Number.isFinite(progress) && progress >= 0) observedPlaybackSeconds = progress;
      if (/play|resume|start/.test(status)) observedPlaybackStatus = 'playing';
      else if (/pause|stop/.test(status)) observedPlaybackStatus = 'paused';
      const now = Date.now();
      if (now < suppressPlaybackBroadcastUntil || now - lastPlaybackBroadcastAt < 700) return;
      const media = currentMedia();
      const episode = currentEpisode();
      const state = {
        mediaId: media.mediaId, mediaType: media.mediaType,
        status: status, seconds: Number.isFinite(progress) && progress >= 0 ? progress : 0,
        duration: Number(payload.data.player_duration || payload.data.duration || 0),
        season: episode?.season || null, episode: episode?.episode || null
      };
      lastPlaybackBroadcastAt = now;
      connection.send({ type: 'playback-state', state }).catch(() => {});
    });
    const initialRoom = new URLSearchParams(location.search).get(PARAM);
    if (initialRoom) join(initialRoom);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
