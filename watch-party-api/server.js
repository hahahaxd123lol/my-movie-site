'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.PORT || 10000);
const MAX_BODY = 8192;
const MAX_ROOM_PEOPLE = 25;
const ROOM_TTL_MS = 10 * 60 * 1000;
const rooms = new Map();
const allowedOrigins = new Set(String(process.env.ALLOWED_ORIGINS || 'https://flix2watch.com,https://www.flix2watch.com,https://flix2watch-watch-party-preview.onrender.com')
  .split(',').map(value => value.trim()).filter(Boolean));

function safeName(value) {
  return String(value || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 28) || 'Guest';
}
function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}
function originAllowed(origin) {
  return Boolean(origin && allowedOrigins.has(origin));
}
function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && originAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY) {
        reject(Object.assign(new Error('Request body too large'), { statusCode: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (_) { reject(Object.assign(new Error('Invalid JSON'), { statusCode: 400 })); }
    });
    req.on('error', reject);
  });
}
function token() { return crypto.randomBytes(32).toString('base64url'); }
function roomId() { return crypto.randomBytes(12).toString('hex'); }
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function roomCode() {
  let code = '';
  do {
    code = Array.from(crypto.randomBytes(6), byte => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]).join('');
  } while ([...rooms.values()].some(room => room.code === code));
  return code;
}
function roomByCode(code) {
  const normalized = String(code || '').toUpperCase();
  return /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(normalized)
    ? [...rooms.values()].find(room => room.code === normalized) || null
    : null;
}
function roomById(id) {
  return /^[a-f0-9]{24}$/i.test(String(id || '')) ? rooms.get(String(id)) : null;
}
function memberFor(room, key) {
  return room && typeof key === 'string' ? room.members.get(key) : null;
}
function publicParticipants(room) {
  return [...room.clients].filter(client => client.ws.readyState === WebSocket.OPEN)
    .map(client => ({ id: client.participantId, name: client.name, host: client.member.host }));
}
function send(client, payload) {
  if (client.ws.readyState === WebSocket.OPEN) client.ws.send(JSON.stringify(payload));
}
function broadcast(room, payload, except) {
  for (const client of room.clients) if (client !== except) send(client, payload);
}
function syncPresence(room) {
  broadcast(room, { type: 'presence-sync', participants: publicParticipants(room) });
}
function safeMessage(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try { return Buffer.byteLength(JSON.stringify(value)) <= 4096; } catch (_) { return false; }
}
function cleanMedia(value) {
  const input = value && typeof value === 'object' ? value : {};
  const type = input.type === 'tv' ? 'tv' : 'movie';
  const id = String(input.id || '').slice(0, 32);
  return { id: /^[0-9]+$/.test(id) ? id : '', type, title: String(input.title || '').slice(0, 160) };
}

const server = http.createServer(async (req, res) => {
  cors(req, res);
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'OPTIONS') {
    if (!originAllowed(req.headers.origin)) return json(res, 403, { error: 'Origin not allowed' });
    res.writeHead(204); return res.end();
  }
  if (req.method === 'GET' && url.pathname === '/healthz') {
    return json(res, 200, { ok: true, service: 'flix2watch-watch-party-api', rooms: rooms.size });
  }
  if (!originAllowed(req.headers.origin)) return json(res, 403, { error: 'Origin not allowed' });

  if (req.method === 'POST' && url.pathname === '/api/rooms') {
    try {
      const body = await readBody(req);
      const name = safeName(body.name);
      const id = roomId();
      const code = roomCode();
      const hostToken = token();
      const room = {
        id, code, createdAt: Date.now(), emptySince: Date.now(), state: { media: cleanMedia(body.media), episode: null, source: '', playbackState: null },
        members: new Map(), clients: new Set(), joinAttempts: new Map()
      };
      room.members.set(hostToken, { host: true, name });
      rooms.set(id, room);
      return json(res, 201, { roomId: id, roomCode: code, token: hostToken });
    } catch (error) {
      return json(res, error.statusCode || 400, { error: error.message || 'Could not create room.' });
    }
  }

  const codeJoinMatch = url.pathname.match(/^\/api\/rooms\/code\/([ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6})\/join$/i);
  if (req.method === 'POST' && codeJoinMatch) {
    try {
      const room = roomByCode(codeJoinMatch[1]);
      if (!room) return json(res, 404, { error: 'Room code not found. Check the code and try again.' });
      const body = await readBody(req);
      const name = safeName(body.name);
      if (publicParticipants(room).length >= MAX_ROOM_PEOPLE) return json(res, 409, { error: 'This room is full.' });
      const memberToken = token();
      room.members.set(memberToken, { host: false, name });
      return json(res, 200, { roomId: room.id, roomCode: room.code, token: memberToken });
    } catch (error) {
      return json(res, error.statusCode || 400, { error: error.message || 'Could not join room.' });
    }
  }

  const joinMatch = url.pathname.match(/^\/api\/rooms\/([a-f0-9]{24})\/join$/i);
  if (req.method === 'POST' && joinMatch) {
    try {
      const room = roomById(joinMatch[1]);
      if (!room) return json(res, 404, { error: 'Room not found or expired.' });
      const body = await readBody(req);
      const name = safeName(body.name);
      if (publicParticipants(room).length >= MAX_ROOM_PEOPLE) return json(res, 409, { error: 'This room is full.' });
      const memberToken = token();
      room.members.set(memberToken, { host: false, name });
      return json(res, 200, { roomId: room.id, roomCode: room.code, token: memberToken });
    } catch (error) {
      return json(res, error.statusCode || 400, { error: error.message || 'Could not join room.' });
    }
  }
  return json(res, 404, { error: 'Not found' });
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
server.on('upgrade', (req, socket, head) => {
  const origin = req.headers.origin;
  const url = new URL(req.url, 'http://localhost');
  const room = roomById(url.searchParams.get('room'));
  const member = memberFor(room, url.searchParams.get('token'));
  const participantId = String(url.searchParams.get('participantId') || '');
  if (url.pathname !== '/ws' || !originAllowed(origin) || !room || !member ||
      !/^[a-f0-9]{12,96}$/i.test(participantId) || publicParticipants(room).length >= MAX_ROOM_PEOPLE) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, ws => {
    const client = {
      ws, room, member, participantId, name: member.name,
      chatTimes: [], chatCooldownUntil: 0, closed: false
    };
    room.clients.add(client);
    room.emptySince = 0;
    ws.on('message', raw => {
      let message;
      try { message = JSON.parse(raw.toString()); } catch (_) { return; }
      if (!safeMessage(message) || typeof message.type !== 'string') return;
      if (message.type === 'hello') {
        client.name = safeName(message.participant && message.participant.name || client.name);
        member.name = client.name;
        const episode = message.episode;
        if (episode && episode.mediaType === 'tv' && String(episode.mediaId) === room.state.media.id &&
            Number.isInteger(Number(episode.season)) && Number(episode.season) >= 0 &&
            Number.isInteger(Number(episode.episode)) && Number(episode.episode) >= 0) {
          room.state.episode = { mediaType: 'tv', mediaId: room.state.media.id, season: Number(episode.season), episode: Number(episode.episode) };
          room.state.season = { mediaId: room.state.media.id, season: Number(episode.season) };
        }
        const source = String(message.source || '').slice(0, 80);
        if (/^[a-z0-9_-]+$/i.test(source)) room.state.source = source;
        broadcast(room, { type: 'hello', participant: { id: client.participantId, name: client.name, host: member.host }, episode: room.state.episode, source: room.state.source }, client);
        return;
      }
      if (message.type === 'media-change') {
        const media = cleanMedia(message.media);
        if (!media.id) return;
        room.state.media = media;
        room.state.episode = null;
        room.state.season = null;
        room.state.source = '';
        room.state.playbackState = null;
        broadcast(room, { type: 'media-change', media }, client);
        return;
      }
      if (message.type === 'chat-message') {
        const now = Date.now();
        if (now < client.chatCooldownUntil) {
          send(client, { type: 'chat-cooldown', until: client.chatCooldownUntil });
          return;
        }
        client.chatTimes = client.chatTimes.filter(at => now - at <= 3000);
        client.chatTimes.push(now);
        if (client.chatTimes.length >= 5) {
          client.chatCooldownUntil = now + 30000;
          client.chatTimes = [];
          send(client, { type: 'chat-cooldown', until: client.chatCooldownUntil });
          return;
        }
        const text = String(message.text || '').trim().slice(0, 500);
        if (text) broadcast(room, {
          type: 'chat-message', participantId: client.participantId, name: client.name,
          text, messageId: String(message.messageId || crypto.randomUUID())
        }, client);
        return;
      }
      if (message.type === 'participant-left') {
        broadcast(room, { type: 'participant-left', participantId: client.participantId });
        try { ws.close(1000, 'left room'); } catch (_) {}
        return;
      }
      if (message.type === 'season-change') {
        const season = Number(message.season);
        if (room.state.media.type === 'tv' && Number.isInteger(season) && season >= 0 && season <= 500) {
          room.state.season = { mediaId: room.state.media.id, season };
          broadcast(room, { type: 'season-change', mediaId: room.state.media.id, season }, client);
        }
        return;
      }
      if (message.type === 'episode-change') {
        const episode = message.episode;
        if (episode && episode.mediaType === 'tv' && String(episode.mediaId) === room.state.media.id &&
            Number.isInteger(Number(episode.season)) && Number(episode.season) >= 0 &&
            Number.isInteger(Number(episode.episode)) && Number(episode.episode) >= 0) {
          room.state.episode = { mediaType: 'tv', mediaId: room.state.media.id, season: Number(episode.season), episode: Number(episode.episode) };
          broadcast(room, { type: 'episode-change', episode: room.state.episode }, client);
        }
        return;
      }
      if (message.type === 'source-change') {
        const source = String(message.source || '').slice(0, 80);
        if (/^[a-z0-9_-]+$/i.test(source)) {
          room.state.source = source;
          broadcast(room, { type: 'source-change', source }, client);
        }
        return;
      }
      if (message.type === 'playback-state') {
        const state = message.state;
        if (state && String(state.mediaId) === room.state.media.id && state.mediaType === room.state.media.type) {
          room.state.playbackState = {
            mediaId: room.state.media.id, mediaType: room.state.media.type,
            status: String(state.status || '').slice(0, 24),
            seconds: state.seconds == null || !Number.isFinite(Number(state.seconds)) ? null : Math.max(0, Math.min(864000, Number(state.seconds))),
            duration: Math.max(0, Math.min(864000, Number(state.duration) || 0))
          };
          broadcast(room, { type: 'playback-state', state: room.state.playbackState }, client);
        }
        return;
      }
      if (message.type === 'playback-command') {
        if (['play', 'pause', 'seek'].includes(message.action)) {
          const seconds = message.seconds == null || !Number.isFinite(Number(message.seconds)) ? null : Math.max(0, Math.min(864000, Number(message.seconds)));
          room.state.playbackState = {
            mediaId: room.state.media.id,
            mediaType: room.state.media.type,
            status: message.action === 'seek' ? 'seeked' : message.action,
            seconds,
            duration: Number(room.state.playbackState?.duration) || 0
          };
          broadcast(room, { type: 'playback-command', action: message.action, seconds }, client);
        }
      }
    });
    ws.on('close', () => {
      if (client.closed) return;
      client.closed = true;
      room.clients.delete(client);
      broadcast(room, { type: 'participant-left', participantId: client.participantId });
      syncPresence(room);
      if (!room.clients.size) room.emptySince = Date.now();
    });
    ws.on('error', () => {});
    send(client, {
      type: 'room-state', roomId: room.id, passwordProtected: Boolean(room.passwordHash),
      isHost: member.host, media: room.state.media, episode: room.state.episode,
      season: room.state.season, source: room.state.source, playbackState: room.state.playbackState,
      participants: publicParticipants(room)
    });
    syncPresence(room);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [id, room] of rooms) {
    if (!room.clients.size && room.emptySince && now - room.emptySince > ROOM_TTL_MS) rooms.delete(id);
  }
}, 60000).unref();

server.listen(PORT, '0.0.0.0', () => {
  console.log('Flix2Watch Watch Party API listening on ' + PORT);
});
