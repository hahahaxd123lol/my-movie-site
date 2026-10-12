const API_BASE = "https://flix2watch-watch-party-api.onrender.com";
let socket = null;
let activeRoom = null;
let reconnectTimer = null;
let manuallyClosed = false;

function sendStatus(status, detail = "") {
  chrome.runtime.sendMessage({ type: "F2W_EXTENSION_STATUS", status, detail }).catch(() => {});
}

function makeParticipantId() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

async function joinRoom(roomCode, name) {
  const code = String(roomCode || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const displayName = String(name || "Guest").replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 28) || "Guest";
  if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(code)) {
    throw new Error("Enter a valid six-character room code.");
  }
  const response = await fetch(API_BASE + "/api/rooms/code/" + encodeURIComponent(code) + "/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: displayName }),
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Could not join that room. Check the code.");
  if (!data.roomId || !data.token) throw new Error("The Watch Party API returned incomplete room credentials.");
  activeRoom = {
    roomId: String(data.roomId),
    token: String(data.token),
    roomCode: code,
    name: displayName,
    participantId: makeParticipantId()
  };
  await chrome.storage.local.set({ f2wExtensionRoom: activeRoom });
  connectSocket();
  return { roomCode: code, name: displayName };
}

// Opens the room's authoritative media on the isolated Render preview.
let lastOpenedMediaKey = '';
async function openRoomMedia(media, episode) {
  const id = String((media && media.id) || '').replace(/[^0-9]/g, '');
  if (!id) return;
  const type = media.type === 'tv' ? 'tv' : 'movie';
  const season = Math.max(1, Number((episode && episode.season) || 1));
  const ep = Math.max(1, Number((episode && episode.episode) || 1));
  const key = type + ':' + id + (type === 'tv' ? ':' + season + ':' + ep : '');
  if (key === lastOpenedMediaKey) return;
  lastOpenedMediaKey = key;
  const target = new URL('/watch/', 'https://flix2watch-watch-party-preview.onrender.com');
  target.searchParams.set('id', id);
  target.searchParams.set('type', type);
  target.searchParams.set('partytest', '1');
  if (type === 'tv') { target.searchParams.set('season', String(season)); target.searchParams.set('episode', String(ep)); }
  try {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find(function (item) {
      return item.id != null && String(item.url || '').startsWith('https://flix2watch-watch-party-preview.onrender.com/watch/');
    });
    if (tab && tab.id != null) await chrome.tabs.update(tab.id, {url: target.toString(), active: true});
    else await chrome.tabs.create({url: target.toString(), active: true});
    sendStatus('opening-movie', String(media.title || 'the room movie'));
  } catch (error) { lastOpenedMediaKey = ''; sendStatus('error', 'Could not open room movie: ' + (error.message || 'tab navigation failed')); }
}
function disconnectSocket() {
  manuallyClosed = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  if (socket) {
    try { socket.close(1000, "extension disconnected"); } catch (_) {}
  }
  socket = null;
  sendStatus("disconnected");
}

function connectSocket() {
  if (!activeRoom) return;
  manuallyClosed = false;
  if (socket) {
    try { socket.close(); } catch (_) {}
  }
  const url = new URL("/ws", API_BASE);
  url.protocol = "wss:";
  url.searchParams.set("room", activeRoom.roomId);
  url.searchParams.set("token", activeRoom.token);
  url.searchParams.set("participantId", activeRoom.participantId);
  url.searchParams.set("name", activeRoom.name);
  socket = new WebSocket(url.toString());

  socket.addEventListener("open", () => sendStatus("connected", activeRoom.roomCode));
  socket.addEventListener("message", async event => {
    let message;
    try { message = JSON.parse(String(event.data)); } catch (_) { return; }
    if (!message || typeof message !== "object") return;
    if (message.type === "room-state") {
      if (activeRoom) activeRoom.media = message.media || null;
      await openRoomMedia(message.media, message.episode);
      if (message.playbackState) relayPlaybackState(message.playbackState);
    } else if (message.type === "media-change") {
      if (activeRoom) activeRoom.media = message.media || null;
      await openRoomMedia(message.media, null);
    } else if (message.type === "episode-change") {
      if (activeRoom && activeRoom.media) await openRoomMedia(activeRoom.media, message.episode);
    } else if (message.type === "playback-command") {
      relayCommand(message.action, message.seconds);
    } else if (message.type === "playback-state" && message.state) {
      relayPlaybackState(message.state);
    }
  });
  socket.addEventListener("error", () => sendStatus("error", "Could not connect to the room. Reopen the extension to retry."));
  socket.addEventListener("close", () => {
    socket = null;
    if (!manuallyClosed && activeRoom) {
      sendStatus("reconnecting", activeRoom.roomCode);
      reconnectTimer = setTimeout(connectSocket, 1800);
    }
  });
}

function relayCommand(action, seconds) {
  if (!["play", "pause", "seek"].includes(String(action))) return;
  const payload = {
    type: "F2W_EXTENSION_APPLY",
    action: String(action),
    seconds: Number.isFinite(Number(seconds)) ? Math.max(0, Number(seconds)) : null
  };
  // The watch page is the top-level tab, while the video controller is commonly
  // inside a cross-origin player iframe. Enumerate frames and target only the
  // Flix2Watch player origin; tabs.sendMessage without frameId reaches only the top frame.
  chrome.tabs.query({}, tabs => {
    for (const tab of tabs) {
      if (tab.id == null) continue;
      chrome.webNavigation.getAllFrames({ tabId: tab.id }, frames => {
        if (chrome.runtime.lastError || !Array.isArray(frames)) return;
        for (const frame of frames) {
          if (frame.frameId === 0 || !String(frame.url || "").startsWith("https://player.flix2watch.com/")) continue;
          chrome.tabs.sendMessage(tab.id, payload, { frameId: frame.frameId }).catch(() => {});
        }
      });
    }
  });
}

function relayPlaybackState(state) {
  if (!state || typeof state !== "object") return;
  const status = String(state.status || "").toLowerCase();
  const action = /play|resume|start/.test(status) ? "play" : /pause|stop/.test(status) ? "pause" : "";
  if (action) relayCommand(action, state.seconds);
  if (Number.isFinite(Number(state.seconds)) && Number(state.seconds) >= 0) {
    relayCommand("seek", Number(state.seconds));
  }
}

async function restoreRoom() {
  const stored = await chrome.storage.local.get("f2wExtensionRoom");
  if (stored.f2wExtensionRoom && stored.f2wExtensionRoom.roomId && stored.f2wExtensionRoom.token) {
    activeRoom = stored.f2wExtensionRoom;
    connectSocket();
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === "F2W_EXTENSION_JOIN") {
      const result = await joinRoom(message.roomCode, message.name);
      sendResponse({ ok: true, ...result });
    } else if (message?.type === "F2W_EXTENSION_LEAVE") {
      disconnectSocket();
      activeRoom = null;
      await chrome.storage.local.remove("f2wExtensionRoom");
      sendResponse({ ok: true });
    } else if (message?.type === "F2W_EXTENSION_GET_STATUS") {
      sendResponse({
        ok: true,
        connected: Boolean(socket && socket.readyState === WebSocket.OPEN),
        roomCode: activeRoom?.roomCode || "",
        name: activeRoom?.name || ""
      });
    } else if (message?.type === "F2W_EXTENSION_LOCAL_COMMAND") {
      if (!activeRoom || !socket || socket.readyState !== WebSocket.OPEN) {
        sendResponse({ ok: false, error: "Join your Watch Party room in the extension first." });
        return;
      }
      const action = String(message.action || "");
      if (!["play", "pause", "seek"].includes(action)) {
        sendResponse({ ok: false, error: "Unsupported playback action." });
        return;
      }
      socket.send(JSON.stringify({
        type: "playback-command",
        action,
        seconds: Number.isFinite(Number(message.seconds)) ? Math.max(0, Number(message.seconds)) : null,
        participantId: activeRoom.participantId
      }));
      sendResponse({ ok: true });
    }
  })().catch(error => sendResponse({ ok: false, error: error.message || "Extension error." }));
  return true;
});

chrome.runtime.onInstalled.addListener(() => { restoreRoom(); });
chrome.runtime.onStartup.addListener(() => { restoreRoom(); });
restoreRoom();
