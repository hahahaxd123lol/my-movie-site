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
    if (message.type === "room-state" && message.playbackState) {
      relayPlaybackState(message.playbackState);
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
  chrome.tabs.query({ url: "https://player.flix2watch.com/*" }, tabs => {
    for (const tab of tabs) {
      if (tab.id == null) continue;
      chrome.tabs.sendMessage(tab.id, {
        type: "F2W_EXTENSION_APPLY",
        action: String(action),
        seconds: Number.isFinite(Number(seconds)) ? Math.max(0, Number(seconds)) : null
      }).catch(() => {});
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
