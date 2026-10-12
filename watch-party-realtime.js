/* Flix2Watch Watch Party realtime transport.
 * This module deliberately does not issue player commands: the external
 * cross-origin player control API must be verified before playback is driven.
 * Load after the Supabase client is available, then call
 * F2WWatchPartyRealtime.connect({ supabase, roomId, onMessage }).
 */
(function (global) {
  'use strict';

  const ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]{12,96}$/;
  const EVENT_NAME = 'party-message';
  const MAX_MESSAGE_BYTES = 4096;
  const ALLOWED_TYPES = new Set([
    'hello',
    'participant-left',
    'playback-state',
    'episode-change',
    'source-change',
    'playback-command',
    'chat-message'
  ]);

  function validMessage(message) {
    if (!message || typeof message !== 'object' || Array.isArray(message)) return false;
    if (!ALLOWED_TYPES.has(message.type)) return false;
    try {
      return new TextEncoder().encode(JSON.stringify(message)).length <= MAX_MESSAGE_BYTES;
    } catch (_) {
      return false;
    }
  }

  function connect(options) {
    const config = options || {};
    if (!config.supabase || typeof config.supabase.channel !== 'function') {
      throw new TypeError('A configured Supabase client is required.');
    }
    if (typeof config.roomId !== 'string' || !ROOM_ID_PATTERN.test(config.roomId)) {
      throw new TypeError('Invalid Watch Party room ID.');
    }

    const onMessage = typeof config.onMessage === 'function' ? config.onMessage : function () {};
    const channel = config.supabase.channel('watch-party:' + config.roomId, {
      config: {
        broadcast: { self: false },
        presence: { key: String(config.participantId || '') }
      }
    });
    let closed = false;

    channel.on('broadcast', { event: EVENT_NAME }, function (event) {
      const message = event && event.payload;
      if (!closed && validMessage(message)) onMessage(message);
    });
    channel.on('presence', { event: 'sync' }, function () {
      if (!closed && typeof config.onPresence === 'function') {
        try { config.onPresence(channel.presenceState()); } catch (_) {}
      }
    });

    const ready = new Promise(function (resolve, reject) {
      channel.subscribe(function (status) {
        if (status === 'SUBSCRIBED') resolve();
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          reject(new Error('Watch Party realtime channel status: ' + status));
        }
      });
    });

    return {
      ready: ready,
      send: async function (message) {
        if (closed) throw new Error('Watch Party channel is closed.');
        if (!validMessage(message)) throw new TypeError('Invalid Watch Party message.');
        await ready;
        if (closed) throw new Error('Watch Party channel is closed.');
        const result = await channel.send({ type: 'broadcast', event: EVENT_NAME, payload: message });
        if (result !== 'ok') throw new Error('Watch Party message was not accepted.');
      },
      trackPresence: async function (payload) {
        if (closed) throw new Error('Watch Party channel is closed.');
        await ready;
        if (closed) throw new Error('Watch Party channel is closed.');
        return channel.track(payload);
      },
      close: async function () {
        if (closed) return;
        closed = true;
        await config.supabase.removeChannel(channel);
      }
    };
  }

  global.F2WWatchPartyRealtime = Object.freeze({ connect: connect });
})(window);
