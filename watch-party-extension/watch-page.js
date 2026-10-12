(() => {
  "use strict";
  // This bridge is deliberately limited to the isolated Render preview page.
  const PREVIEW_ORIGIN = "https://flix2watch-watch-party-preview.onrender.com";
  const PLAYER_ORIGIN = "https://player.flix2watch.com";
  if (location.origin !== PREVIEW_ORIGIN || !location.pathname.startsWith("/watch/")) return;

  let suppressUntil = 0;
  let previousStatus = "";
  let previousPosition = null;
  let previousAt = 0;
  let lastCommandAt = 0;

  function playerFrame() {
    const frame = document.getElementById("video-frame");
    if (!frame || !frame.contentWindow) return null;
    try {
      const url = new URL(frame.src, location.href);
      if (url.origin !== PLAYER_ORIGIN || !/^\/embed\/(tv|movie)(\/|$)/.test(url.pathname)) return null;
      return frame;
    } catch (_) { return null; }
  }

  function sendLocal(action, seconds) {
    if (Date.now() < suppressUntil) return;
    chrome.runtime.sendMessage({
      type: "F2W_EXTENSION_LOCAL_COMMAND",
      action,
      seconds: Number.isFinite(Number(seconds)) ? Math.max(0, Number(seconds)) : null
    }).catch(() => {});
  }

  function applyCommand(message) {
    const frame = playerFrame();
    if (!frame) return;
    const action = String(message.action || "");
    if (!["play", "pause", "seek"].includes(action)) return;
    const seconds = Math.max(0, Number(message.seconds) || 0);
    const commandData = {
      action,
      command: action,
      method: action === "seek" ? "seekTo" : action,
      value: action === "seek" ? seconds : undefined,
      seconds: action === "seek" ? seconds : undefined,
      position: action === "seek" ? seconds : undefined,
      time: action === "seek" ? seconds : undefined
    };
    const payload = { type: "PLAYER_COMMAND", event: "PLAYER_COMMAND", data: commandData, payload: commandData, ...commandData };
    suppressUntil = Date.now() + 1800;
    try {
      frame.contentWindow.postMessage(payload, PLAYER_ORIGIN);
      // Keep the background informed that a command reached the preview player bridge.
      chrome.runtime.sendMessage({ type: "F2W_EXTENSION_STATUS", status: "player-command-sent", detail: action }).catch(() => {});
    } catch (_) {}
  }

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type === "F2W_EXTENSION_APPLY") applyCommand(message);
  });

  // Read the same player-to-watch-page telemetry envelope used by the site's
  // Watch Party panel. This works even when the actual <video> lives inside
  // a nested provider frame and is not directly accessible to the extension.
  window.addEventListener("message", event => {
    const frame = playerFrame();
    if (!frame || event.source !== frame.contentWindow || event.origin !== PLAYER_ORIGIN) return;
    let payload = event.data;
    if (typeof payload === "string") {
      try { payload = JSON.parse(payload); } catch (_) { return; }
    }
    if (!payload || typeof payload !== "object") return;
    const nested = payload.data || payload.payload || payload.detail || payload.state || payload;
    if (!nested || typeof nested !== "object") return;
    const type = String(payload.type || payload.event || payload.action || payload.command || nested.type || nested.event || nested.action || nested.command || "").toLowerCase();
    const rawStatus = nested.player_status ?? nested.status ?? nested.playbackState ?? nested.state ?? nested.event ?? nested.action ?? type;
    const status = typeof rawStatus === "string" ? rawStatus.toLowerCase() : type;
    const progressRaw = nested.player_progress ?? nested.currentTime ?? nested.current_time ?? nested.seconds ?? nested.position ?? nested.time ?? payload.player_progress ?? payload.currentTime;
    const position = Number(progressRaw);
    const hasPosition = progressRaw !== undefined && progressRaw !== null && Number.isFinite(position) && position >= 0;
    const isPlaying = /(^|[^a-z])(play|playing|resume|resumed|start|started)([^a-z]|$)/.test(status) || /player.?play/.test(type);
    const isPaused = /(^|[^a-z])(pause|paused|stop|stopped)([^a-z]|$)/.test(status) || /player.?pause/.test(type);
    const isSeek = /seek/.test(status + " " + type);
    const now = Date.now();

    if (now >= suppressUntil && now - lastCommandAt > 800) {
      if (isPlaying && previousStatus !== "playing") {
        sendLocal("play", hasPosition ? position : null);
        lastCommandAt = now;
      } else if (isPaused && previousStatus !== "paused") {
        sendLocal("pause", hasPosition ? position : null);
        lastCommandAt = now;
      } else if (hasPosition && (isSeek || (previousPosition != null && previousAt > 0 &&
        Math.abs((position - previousPosition) - (previousStatus === "playing" ? (now - previousAt) / 1000 : 0)) > 3.5))) {
        if (previousPosition == null || Math.abs(position - previousPosition) > 2.5) {
          sendLocal("seek", position);
          lastCommandAt = now;
        }
      }
    }
    if (isPlaying) previousStatus = "playing";
    else if (isPaused) previousStatus = "paused";
    if (hasPosition) previousPosition = position;
    previousAt = now;
  });

  // Surface basic diagnostics in the extension popup while testing.
  const frameStatus = () => {
    const frame = playerFrame();
    chrome.runtime.sendMessage({
      type: "F2W_EXTENSION_STATUS",
      status: "player-bridge",
      detail: frame ? "Flix2Watch player iframe detected on preview." : "Waiting for the Flix2Watch API player iframe on preview."
    }).catch(() => {});
  };
  setTimeout(frameStatus, 1500);
  const observer = new MutationObserver(frameStatus);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
})();