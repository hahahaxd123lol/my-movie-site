(() => {
  "use strict";
  let suppressionUntil = 0;
  let lastLocalSeekAt = 0;
  let lastLocalSeekSeconds = null;
  let boundVideos = new WeakSet();

  function sendLocalCommand(action, seconds) {
    if (Date.now() < suppressionUntil) return;
    chrome.runtime.sendMessage({
      type: "F2W_EXTENSION_LOCAL_COMMAND",
      action,
      seconds: Number.isFinite(Number(seconds)) ? Math.max(0, Number(seconds)) : null
    }).catch(() => {});
  }

  function bindVideo(video) {
    if (!(video instanceof HTMLVideoElement) || boundVideos.has(video)) return;
    boundVideos.add(video);
    video.addEventListener("play", event => {
      if (event.isTrusted) sendLocalCommand("play", video.currentTime);
    });
    video.addEventListener("pause", event => {
      if (event.isTrusted) sendLocalCommand("pause", video.currentTime);
    });
    video.addEventListener("seeked", event => {
      if (!event.isTrusted || Date.now() < suppressionUntil) return;
      const seconds = Number(video.currentTime) || 0;
      const now = Date.now();
      if (lastLocalSeekSeconds != null && Math.abs(lastLocalSeekSeconds - seconds) < 1 && now - lastLocalSeekAt < 900) return;
      lastLocalSeekSeconds = seconds;
      lastLocalSeekAt = now;
      sendLocalCommand("seek", seconds);
    });
  }

  function scanVideos() {
    document.querySelectorAll("video").forEach(bindVideo);
  }

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type !== "F2W_EXTENSION_APPLY") return;
    const videos = [...document.querySelectorAll("video")];
    if (!videos.length) return;
    const video = videos.find(item => item.readyState >= 1) || videos[0];
    const action = String(message.action || "");
    const seconds = Number(message.seconds);
    suppressionUntil = Date.now() + 1800;
    if (action === "seek" && Number.isFinite(seconds) && seconds >= 0) {
      try { video.currentTime = seconds; } catch (_) {}
    } else if (action === "play") {
      const result = video.play();
      if (result && typeof result.catch === "function") result.catch(() => {});
    } else if (action === "pause") {
      video.pause();
    }
  });

  scanVideos();
  new MutationObserver(scanVideos).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(scanVideos, 2000);
})();
