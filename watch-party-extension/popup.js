const $ = id => document.getElementById(id);
const roomInput = $("room");
const nameInput = $("name");
const statusEl = $("status");
const joinButton = $("join");
const leaveButton = $("leave");

function status(message, kind = "") {
  statusEl.textContent = message;
  statusEl.dataset.kind = kind;
}

function send(message) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(message, response => {
      if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
      else resolve(response || { ok: false, error: "No response from extension." });
    });
  });
}

async function refresh() {
  const result = await send({ type: "F2W_EXTENSION_GET_STATUS" });
  if (result.ok && result.connected) {
    roomInput.value = result.roomCode || roomInput.value;
    nameInput.value = result.name || nameInput.value;
    status("Connected to room " + (result.roomCode || "") + ". Open the movie tab and test play/pause/seek.", "ok");
  } else if (result.ok && result.roomCode) {
    status("Reconnecting to room " + result.roomCode + "…");
  } else {
    status("Not connected. Enter the room code shown on your Flix2Watch page.");
  }
}

joinButton.addEventListener("click", async () => {
  joinButton.disabled = true;
  status("Joining room…");
  const result = await send({
    type: "F2W_EXTENSION_JOIN",
    roomCode: roomInput.value,
    name: nameInput.value
  });
  joinButton.disabled = false;
  if (!result.ok) status(result.error || "Could not join room.", "error");
  else status("Joined room " + result.roomCode + ". Waiting for player connection…", "ok");
});

leaveButton.addEventListener("click", async () => {
  const result = await send({ type: "F2W_EXTENSION_LEAVE" });
  status(result.ok ? "Disconnected from the room." : (result.error || "Could not leave room."), result.ok ? "" : "error");
});

roomInput.addEventListener("input", () => { roomInput.value = roomInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6); });
chrome.runtime.onMessage.addListener(message => {
  if (message?.type !== "F2W_EXTENSION_STATUS") return;
  if (message.status === "connected") status("Connected to room " + message.detail + ". Test play/pause/seek.", "ok");
  else if (message.status === "reconnecting") status("Connection lost; reconnecting to room " + message.detail + "…");
  else if (message.status === "error") status(message.detail || "Connection error.", "error");
  else if (message.status === "disconnected") status("Disconnected from the room.");
  else if (message.status === "player-bridge") status(message.detail || "Checking preview player…", "ok");
  else if (message.status === "player-command") status("Player bridge received " + message.detail + ".", "ok");
  else if (message.status === "command-relay") status(message.detail || "Playback command relayed.", "ok");
  else if (message.status === "opening-movie") status("Opening " + message.detail + " on the Render preview…", "ok");
});
refresh();
