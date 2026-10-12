/* Flix2Watch Watch Party transport. Room access and password checks live on the API. */
(function (global) {
  'use strict';
  const API_BASE = 'https://flix2watch-watch-party-api.onrender.com';
  const ROOM_ID_PATTERN = /^[a-f0-9]{24}$/i;

  function connect(options) {
    const config = options || {};
    if (!ROOM_ID_PATTERN.test(String(config.roomId || '')) ||
        !String(config.token || '') || !String(config.participantId || '')) {
      throw new TypeError('A valid room and API-issued membership token are required.');
    }
    const url = new URL('/ws', API_BASE);
    url.protocol = 'wss:';
    url.searchParams.set('room', config.roomId);
    url.searchParams.set('token', config.token);
    url.searchParams.set('participantId', config.participantId);
    url.searchParams.set('name', String(config.name || 'Guest').slice(0, 28));
    const socket = new WebSocket(url.toString());
    let closed = false;
    let opened = false;
    let resolveReady, rejectReady;
    const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    socket.addEventListener('open', () => { opened = true; resolveReady(); });
    socket.addEventListener('message', event => {
      let message;
      try { message = JSON.parse(String(event.data)); } catch (_) { return; }
      if (!message || typeof message !== 'object') return;
      if (message.type === 'presence-sync') {
        if (typeof config.onPresence === 'function') {
          try { config.onPresence(message.participants || []); } catch (_) {}
        }
        return;
      }
      if (!closed && typeof config.onMessage === 'function') config.onMessage(message);
    });
    socket.addEventListener('error', () => {
      if (!opened) rejectReady(new Error('Watch Party API connection failed.'));
    });
    socket.addEventListener('close', () => {
      if (!opened) rejectReady(new Error('Watch Party API refused the room connection.'));
      if (!closed && typeof config.onDisconnect === 'function') {
        try { config.onDisconnect(); } catch (_) {}
      }
    });
    return {
      ready,
      send: async function (message) {
        await ready;
        if (closed || socket.readyState !== WebSocket.OPEN) throw new Error('Watch Party connection is closed.');
        socket.send(JSON.stringify(message));
      },
      trackPresence: async function () { return 'ok'; },
      close: async function () {
        if (closed) return;
        closed = true;
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close(1000, 'left room');
        }
      }
    };
  }

  global.F2WWatchPartyRealtime = Object.freeze({ connect, API_BASE });
})(window);
