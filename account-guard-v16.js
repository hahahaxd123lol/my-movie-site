
(() => {
  'use strict';

  const SUPABASE_URL = 'https://viqufxlcxwgboyxbdhjb.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_zdfvnwwgL9LI3yTK0-1Sbg_RsYRvNge';
  const OWNER_UUID = 'f5454804-a2a6-4602-9086-51cf51f11c77';
  const POLL_MS = 120000;

  let client = null;
  let activeUser = null;
  let currentState = null;
  let eventQueue = [];
  let eventOpen = false;
  let pollTimer = null;
  let realtimeChannel = null;
  let blocked = false;
  let changedUsernameTarget = '';

  window.__flix2watchAccountGuardReady=false;
  window.__flix2watchAccountState=null;

  function ensureClient() {
    if (client) return client;
    if (!window.supabase?.createClient) return null;
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    });
    window.__flix2watchAccountGuardClient = client;
    return client;
  }

  function esc(value = '') {
    return String(value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[ch]));
  }

  function injectStyles() {
    if (document.getElementById('f2w-account-guard-style')) return;

    const style = document.createElement('style');
    style.id = 'f2w-account-guard-style';
    style.textContent = `
            .f2w-account-event-overlay,
      .f2w-account-block-overlay{
        position:fixed;
        inset:0;
        z-index:2147483647;
        display:grid;
        place-items:center;
        padding:22px;
        background:rgba(0,0,0,.82);
        backdrop-filter:blur(14px);
        -webkit-backdrop-filter:blur(14px);
      }

      .f2w-account-event-card,
      .f2w-account-block-card{
        width:min(520px,100%);
        border:1px solid rgba(255,255,255,.12);
        border-radius:18px;
        background:#09090f;
        color:#f8fafc;
        box-shadow:0 34px 100px rgba(0,0,0,.72);
        overflow:hidden;
        font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .f2w-event-accent{height:4px;background:var(--f2w-event-color,#94a3b8)}
      .f2w-event-body{padding:25px}
      .f2w-event-icon{
        width:52px;height:52px;border-radius:14px;
        display:grid;place-items:center;
        margin-bottom:16px;
        background:color-mix(in srgb,var(--f2w-event-color,#94a3b8) 13%,transparent);
        border:1px solid color-mix(in srgb,var(--f2w-event-color,#94a3b8) 34%,transparent);
        color:var(--f2w-event-color,#94a3b8);
        font-size:21px;
      }
      .f2w-event-kicker{
        color:var(--f2w-event-color,#94a3b8);
        font-size:11px;font-weight:900;letter-spacing:1.25px;
        text-transform:uppercase;
      }
      .f2w-event-title{
        margin:6px 0 8px;
        color:#fff;
        font-size:24px;
        font-weight:850;
        line-height:1.12;
      }
      .f2w-event-message{
        color:#b4bdcc;
        font-size:14px;
        line-height:1.6;
        white-space:pre-wrap;
      }
      .f2w-event-meta{
        margin-top:15px;
        padding:11px 12px;
        border:1px solid rgba(255,255,255,.075);
        border-radius:10px;
        background:rgba(255,255,255,.025);
        color:#d5dbe5;
        font-size:12px;
        line-height:1.55;
      }
      .f2w-event-actions{
        display:flex;justify-content:flex-end;gap:9px;
        margin-top:20px;
      }
      .f2w-event-btn{
        border:1px solid rgba(255,255,255,.11);
        border-radius:9px;
        padding:10px 14px;
        background:#13131b;
        color:#fff;
        cursor:pointer;
        font:800 13px Inter,system-ui,sans-serif;
      }
      .f2w-event-btn.primary{
        background:#fff;color:#050507;border-color:#fff;
      }

      body.f2w-account-blocked{
        overflow:hidden!important;
      }
      body.f2w-account-blocked > *:not(.f2w-account-block-overlay):not(script):not(style){
        pointer-events:none!important;
        user-select:none!important;
      }
      .f2w-account-block-overlay{
        background:#020204;
      }
      .f2w-account-block-card{
        text-align:center;
        width:min(620px,100%);
      }
      .f2w-block-logo{
        width:118px;
        max-width:40vw;
        display:block;
        margin:0 auto 19px;
      }
      .f2w-block-icon{
        width:66px;height:66px;
        display:grid;place-items:center;
        border-radius:18px;
        margin:0 auto 16px;
        background:rgba(239,68,68,.09);
        border:1px solid rgba(239,68,68,.28);
        color:#ff4655;
        font-size:27px;
      }
      .f2w-block-title{
        font-size:29px;
        line-height:1.08;
        font-weight:900;
        margin:0 0 9px;
      }
      .f2w-block-copy{
        max-width:470px;
        margin:0 auto;
        color:#9da7b8;
        font-size:14px;
        line-height:1.65;
      }
      .f2w-block-details{
        margin:18px auto 0;
        max-width:470px;
        padding:12px;
        border:1px solid rgba(255,255,255,.075);
        border-radius:10px;
        background:rgba(255,255,255,.025);
        color:#d8dee9;
        font-size:12px;
        line-height:1.55;
      }
      .f2w-block-actions{
        display:flex;justify-content:center;gap:10px;flex-wrap:wrap;
        margin-top:21px;
      }
      .f2w-block-actions button{
        border:1px solid rgba(255,255,255,.11);
        border-radius:9px;
        padding:10px 15px;
        background:#111118;
        color:#fff;
        cursor:pointer;
        font:800 13px Inter,system-ui,sans-serif;
      }

      .f2w-username-change-status{
        margin-top:7px;
        min-height:18px;
        color:#94a3b8;
        font-size:12px;
        line-height:1.4;
      }
      .f2w-username-change-status.error{color:#f87171}
      .f2w-username-change-status.success{color:#86efac}
    `;
    document.head.appendChild(style);
  }

  function eventVisual(type) {
    const map = {
      ban: ['#ff4655', 'fa-ban', 'Account action'],
      unban: ['#22c55e', 'fa-circle-check', 'Account action'],
      mute: ['#f59e0b', 'fa-volume-xmark', 'Chat moderation'],
      unmute: ['#22c55e', 'fa-volume-high', 'Chat moderation'],
      warning: ['#f59e0b', 'fa-triangle-exclamation', 'Staff warning'],
      staff_granted: ['#a855f7', 'fa-shield-halved', 'Role updated'],
      staff_revoked: ['#94a3b8', 'fa-shield', 'Role updated'],
      username_changed: ['#3b82f6', 'fa-at', 'Account updated']
    };
    return map[type] || ['#94a3b8', 'fa-circle-info', 'Flix2Watch notice'];
  }

  async function rpc(name, args = {}) {
    const db = ensureClient();
    if (!db) throw new Error('Supabase is unavailable.');
    const { data, error } = await db.rpc(name, args);
    if (error) throw error;
    return data;
  }

  async function getState() {
    if (!activeUser) return null;
    try {
      currentState = await rpc('get_my_account_state');
      return currentState;
    } catch (error) {
      console.warn('Flix2Watch account state unavailable:', error);
      return null;
    }
  }

  async function getPendingEvents() {
    if (!activeUser) return [];
    const db = ensureClient();
    if (!db) return [];

    try {
      const { data, error } = await db
        .from('account_events')
        .select('id,event_type,title,message,details,created_at')
        .eq('user_id', activeUser.id)
        .is('acknowledged_at', null)
        .order('created_at', { ascending: true })
        .limit(20);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.warn('Flix2Watch account events unavailable:', error);
      return [];
    }
  }

  function removeEventOverlay() {
    document.getElementById('f2w-account-event-overlay')?.remove();
    eventOpen = false;
  }

  async function acknowledgeEvent(id) {
    try {
      await rpc('acknowledge_account_event', { p_event_id: id });
    } catch (error) {
      console.warn('Could not acknowledge account event:', error);
    }
  }

  async function closeCurrentEvent(eventId, eventType) {
    const localEvent=String(eventId||'').startsWith('local-');

    if (!localEvent) {
      await acknowledgeEvent(eventId);
    }

    removeEventOverlay();

    if(localEvent && eventType==='username_changed'){
      if(
        changedUsernameTarget &&
        window.location.pathname.startsWith('/profile/')
      ){
        window.location.href=`/profile/?user=${encodeURIComponent(changedUsernameTarget)}`;
      }else{
        window.location.reload();
      }
      return;
    }

    showNextEvent();

    if(!eventOpen&&!eventQueue.length){
      await refreshAccountGuardState();
    }
  }

  function showNextEvent() {
    if (eventOpen || !eventQueue.length) return;

    const event = eventQueue.shift();
    if (!event) return;

    eventOpen = true;
    const [color, icon, kicker] = eventVisual(event.event_type);
    const details = event.details || {};

    const metaParts = [];
    if (details.reason) metaParts.push(`<strong>Reason:</strong> ${esc(details.reason)}`);
    if (details.expires_at) {
      const expires = new Date(details.expires_at);
      if (!Number.isNaN(expires.getTime())) {
        metaParts.push(`<strong>Until:</strong> ${esc(expires.toLocaleString())}`);
      }
    }
    if (details.duration_minutes) {
      metaParts.push(`<strong>Duration:</strong> ${esc(details.duration_minutes)} minute${Number(details.duration_minutes) === 1 ? '' : 's'}`);
    }

    const overlay = document.createElement('div');
    overlay.className = 'f2w-account-event-overlay';
    overlay.id = 'f2w-account-event-overlay';
    overlay.dataset.eventId = String(event.id || '');
    overlay.style.setProperty('--f2w-event-color', color);
    overlay.innerHTML = `
      <div class="f2w-account-event-card" role="dialog" aria-modal="true" aria-labelledby="f2w-event-title">
        <div class="f2w-event-accent"></div>
        <div class="f2w-event-body">
          <div class="f2w-event-icon"><i class="fa-solid ${esc(icon)}"></i></div>
          <div class="f2w-event-kicker">${esc(kicker)}</div>
          <div class="f2w-event-title" id="f2w-event-title">${esc(event.title || 'Account notice')}</div>
          <div class="f2w-event-message">${esc(event.message || '')}</div>
          ${metaParts.length ? `<div class="f2w-event-meta">${metaParts.join('<br>')}</div>` : ''}
          <div class="f2w-event-actions">
            <button class="f2w-event-btn primary" type="button" id="f2w-event-close">Understood</button>
          </div>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    overlay.querySelector('#f2w-event-close')?.addEventListener('click', () => {
      closeCurrentEvent(event.id, event.event_type);
    });
  }

  async function pollEvents() {
    if (!activeUser) return;
    const events = await getPendingEvents();

    const existing = new Set([
      ...eventQueue.map(item => item.id),
      document.querySelector('#f2w-account-event-overlay')?.dataset?.eventId
    ].filter(Boolean));

    for (const event of events) {
      if (!existing.has(event.id)) eventQueue.push(event);
    }

    showNextEvent();
  }

  function stopEmbeddedPlayback() {
    document.querySelectorAll('iframe').forEach(frame => {
      if (
        frame.id === 'video-frame' ||
        /embed|stream|player|vid/i.test(frame.src || '')
      ) {
        try { frame.src = 'data:text/html,%3Cbody%20style%3D%22margin%3A0%3Bbackground%3A%23000%22%3E'; } catch {}
      }
    });

    document.querySelectorAll('video,audio').forEach(media => {
      try {
        media.pause();
        media.removeAttribute('src');
        media.load?.();
      } catch {}
    });
  }

  function removeBlockOverlay() {
    blocked = false;
    document.body?.classList.remove('f2w-account-blocked');
    document.getElementById('f2w-account-block-overlay')?.remove();
  }

  function showBlockOverlay(state) {
    // v211: Support is always reachable for both site suspensions and account-login bans.
    // This legacy guard must never recreate its blocker on /support/.
    if (location.pathname === '/support' || location.pathname.startsWith('/support/')) {
      removeBlockOverlay();
      return;
    }
    // v165 is the authoritative suspension/login-ban UI. Keeping this legacy
    // blocker active as well causes duplicate flashing overlays and duplicate polling.
    if (window.__f2wV165Enforcement) { removeBlockOverlay(); return; }
    if (!state?.banned) {
      removeBlockOverlay();
      return;
    }

    blocked = true;
    stopEmbeddedPlayback();

    let overlay = document.getElementById('f2w-account-block-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'f2w-account-block-overlay';
      overlay.className = 'f2w-account-block-overlay';
      document.body.appendChild(overlay);
    }

    const expiry = state.ban_expires_at
      ? new Date(state.ban_expires_at).toLocaleString()
      : 'Permanent until removed by Staff';

    overlay.innerHTML = `
      <div class="f2w-account-block-card" role="alertdialog" aria-modal="true">
        <div class="f2w-event-body">
          <img src="/flix2watch-logo-red-v34.png" alt="Flix2Watch" class="f2w-block-logo">
          <div class="f2w-block-icon"><i class="fa-solid fa-ban"></i></div>
          <div class="f2w-block-title">Account suspended</div>
          <div class="f2w-block-copy">
            This signed-in account is banned from using Flix2Watch. Playback, chat and the rest of the signed-in website are disabled for this account.
          </div>
          <div class="f2w-block-details">
            <strong>Reason:</strong> ${esc(state.ban_reason || 'No reason supplied.')}<br>
            <strong>Ends:</strong> ${esc(expiry)}<br>
            <strong>Account:</strong> @${esc(state.username || 'user')}
          </div>
          <div class="f2w-block-actions">
            <button type="button" id="f2w-block-signout"><i class="fa-solid fa-right-from-bracket"></i> Sign out</button>
          </div>
        </div>
      </div>`;

    document.body.classList.add('f2w-account-blocked');

    overlay.querySelector('#f2w-block-signout')?.addEventListener('click', async () => {
      try {
        await ensureClient()?.auth.signOut();
      } finally {
        localStorage.removeItem('josh_chat_token');
        window.location.href = '/home/';
      }
    });
  }

  async function refreshAccountGuardState() {
    if (location.pathname === '/support' || location.pathname.startsWith('/support/')) { removeBlockOverlay(); }
    if (!activeUser) {
      removeBlockOverlay();
      return null;
    }

    const state = await getState();
    if (!state) return null;

    if (state?.banned || (!eventOpen && !eventQueue.length)) {
      // Site suspension must lock the page immediately, even if a moderation
      // event toast/modal is also waiting to be acknowledged.
      showBlockOverlay(state);
    }

    window.__flix2watchAccountState=state;
    window.__flix2watchAccountGuardReady=true;

    window.dispatchEvent(new CustomEvent('flix2watch:account-state', {
      detail: state
    }));

    return state;
  }

  async function checkNow() {
    if (location.pathname === '/support' || location.pathname.startsWith('/support/')) { removeBlockOverlay(); }
    if (!activeUser) return;
    await pollEvents();

    const state = await getState();
    if (state && !eventOpen && !eventQueue.length) {
      showBlockOverlay(state);
    }

    window.__flix2watchAccountState=state;
    window.__flix2watchAccountGuardReady=true;

    window.dispatchEvent(new CustomEvent('flix2watch:account-state', {
      detail: state
    }));
  }


  function stopAccountRealtime(){
    if(realtimeChannel&&client){
      try{client.removeChannel(realtimeChannel)}catch{}
    }
    realtimeChannel=null;
  }

  function startAccountRealtime(){
    stopAccountRealtime();
    if(!activeUser)return;

    const db=ensureClient();
    if(!db)return;

    realtimeChannel=db
      .channel(`flix2watch-account-${activeUser.id}`)
      .on(
        'postgres_changes',
        {
          event:'INSERT',
          schema:'public',
          table:'account_events',
          filter:`user_id=eq.${activeUser.id}`
        },
        async payload=>{
          const event=payload.new;
          if(!event?.id)return;

          const exists=
            eventQueue.some(item=>item.id===event.id)
            || document.getElementById('f2w-account-event-overlay')?.dataset?.eventId===String(event.id);

          if(!exists){
            eventQueue.push(event);
            showNextEvent();
          }

          await refreshAccountGuardState();
        }
      )
      .subscribe(status=>{
        document.documentElement.dataset.flixAccountRealtime=
          status==='SUBSCRIBED'?'live':'connecting';
      });
  }

  async function initialize() {
    injectStyles();

    const db = ensureClient();
    if (!db) {
      return;
    }

    try {
      const { data } = await db.auth.getUser();
      activeUser = data?.user || null;

      if (!activeUser) {
        removeBlockOverlay();
        window.__flix2watchAccountState=null;
        window.__flix2watchAccountGuardReady=true;
        return;
      }

      await pollEvents();
      const state = await getState();
      window.__flix2watchAccountState=state;
      window.__flix2watchAccountGuardReady=true;
      if (state && !eventOpen && !eventQueue.length) {
        showBlockOverlay(state);
      }

      window.dispatchEvent(new CustomEvent('flix2watch:account-state', {
        detail: state
      }));

      startAccountRealtime();

      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(checkNow, POLL_MS);
    } catch (error) {
      console.warn('Flix2Watch account guard failed:', error);
      window.__flix2watchAccountGuardReady=true;
    }

    db.auth.onAuthStateChange((_event, session) => {
      activeUser = session?.user || null;
      if (!activeUser) {
        eventQueue = [];
        window.__flix2watchAccountState=null;
        window.__flix2watchAccountGuardReady=true;
        stopAccountRealtime();
        removeEventOverlay();
        removeBlockOverlay();
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
        return;
      }

      setTimeout(async () => {
        await checkNow();
        startAccountRealtime();
        if (!pollTimer) pollTimer = setInterval(checkNow, POLL_MS);
      }, 0);
    });
  }

  async function changeUsername(newUsername, statusElement = null) {
    const db = ensureClient();
    if (!db) return false;

    const username = String(newUsername || '').trim();
    const status = typeof statusElement === 'string'
      ? document.getElementById(statusElement)
      : statusElement;

    const setStatus = (message, kind = '') => {
      if (!status) return;
      status.textContent = message;
      status.className = `f2w-username-change-status ${kind}`.trim();
    };

    if (!/^[A-Za-z0-9]{2,30}$/.test(username)) {
      setStatus('Use 2–30 English letters or numbers only.', 'error');
      return false;
    }

    setStatus('Changing username…');

    try {
      const { data: userData, error: userError } = await db.auth.getUser();
      if (userError || !userData?.user) {
        throw new Error('You need to be signed in.');
      }

      const result = await rpc('change_my_username', {
        p_new_username: username
      });

      if (String(userData.user.id) !== OWNER_UUID) {
        localStorage.removeItem('josh_chat_token');
      }

      try {
        await db.auth.refreshSession();
      } catch {}

      changedUsernameTarget=String(result?.username||username);
      setStatus(`Username changed to @${changedUsernameTarget}.`, 'success');

      const localEvent = {
        id: `local-${Date.now()}`,
        event_type: 'username_changed',
        title: 'Username updated',
        message: `Your Flix2Watch username is now @${changedUsernameTarget}. Your warnings, bans, mutes and Staff permissions stay attached to your account.`,
        details: {}
      };
      eventQueue.push(localEvent);

      // Local-only event does not exist in the database.
      showNextEvent();
      return true;
    } catch (error) {
      setStatus(error.message || 'Could not change username.', 'error');
      return false;
    }
  }

  window.changeFlix2WatchUsername = (inputId = 'account-change-username', statusId = 'account-change-username-status') => {
    const input = document.getElementById(inputId);
    return changeUsername(input?.value || '', statusId);
  };

  window.refreshFlix2WatchAccountState = refreshAccountGuardState;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();

// f2w-force-save:v183-account-guard-low-egress-no-duplicate-blocker:20260902

// f2w-force-save:v211-support-account-ban-legacy-guard-exemption:20260902
