/* Flix2Watch Watch Party UI integration.
 * Party links carry a high-entropy room ID in ?party=. This first pass
 * synchronizes TV episode selection and displays playback reports; it does
 * not claim to control a third-party iframe's play/pause/seek API.
 */
(function () {
  'use strict';

  const PARAM = 'party';
  const ROOM_PATTERN = /^[a-zA-Z0-9_-]{12,96}$/;
  let connection = null;
  let applyingRemoteEpisode = false;
  let lastSentEpisode = '';

  function makeRoomId() {
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, function (byte) {
      return byte.toString(16).padStart(2, '0');
    }).join('');
  }

  function currentEpisode() {
    // The watch page keeps mediaId/mediaType in its inline-script lexical scope,
    // so read the same public route parameters instead of relying on window globals.
    const params = new URLSearchParams(window.location.search);
    const type = String(params.get('type') || params.get('mediaType') || params.get('media_type') || document.body.dataset.mediaType || '').toLowerCase();
    const id = String(params.get('id') || params.get('mediaId') || params.get('tmdb') || '');
    const season = document.getElementById('season-select');
    const episode = document.getElementById('episode-select');
    if (type !== 'tv' || !id || !season || !episode || !season.value || !episode.value) return null;
    return { mediaType: 'tv', mediaId: id, season: Number(season.value), episode: Number(episode.value) };
  }

  function episodeKey(value) {
    return value ? [value.mediaType, value.mediaId, value.season, value.episode].join(':') : '';
  }

  function buildPanel() {
    const wrapper = document.createElement('section');
    wrapper.id = 'f2w-watch-party';
    wrapper.setAttribute('aria-label', 'Watch Party');
    wrapper.style.cssText = 'margin:14px 0;padding:16px;border:1px solid var(--border-color,#293241);border-radius:12px;background:var(--card-bg,#101720);color:var(--text-color,#eef2f7)';
    wrapper.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><strong style="display:block;font-size:1rem">Watch Party</strong><span id="f2w-party-status" role="status" style="font-size:.85rem;opacity:.8">Create a private invite link to watch together.</span></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" id="f2w-party-create" class="fallback-trigger-btn">Create party</button><button type="button" id="f2w-party-copy" class="fallback-trigger-btn" hidden>Copy invite link</button><button type="button" id="f2w-party-leave" class="fallback-trigger-btn" hidden>Leave</button></div></div><p id="f2w-party-note" style="font-size:.8rem;opacity:.72;margin:10px 0 0">Episode selection sync is available for TV. Play/pause/seek sync depends on verified support from the external player.</p>';
    const player = document.querySelector('.player-wrapper');
    if (player && player.parentNode) player.parentNode.insertBefore(wrapper, player.nextSibling);
    return wrapper;
  }

  function init() {
    if (!document.querySelector('.player-wrapper') || document.getElementById('f2w-watch-party')) return;
    const panel = buildPanel();
    if (!panel) return;
    const status = panel.querySelector('#f2w-party-status');
    const createButton = panel.querySelector('#f2w-party-create');
    const copyButton = panel.querySelector('#f2w-party-copy');
    const leaveButton = panel.querySelector('#f2w-party-leave');

    function setStatus(message) { status.textContent = message; }

    async function join(roomId) {
      if (!window.F2WWatchPartyRealtime || !window.f2wSupabase) {
        setStatus('Party service is not ready. Refresh and try again.');
        return;
      }
      if (!ROOM_PATTERN.test(roomId)) {
        setStatus('That invite link is invalid.');
        return;
      }
      if (connection) await connection.close();
      setStatus('Connecting to party…');
      try {
        connection = window.F2WWatchPartyRealtime.connect({
          supabase: window.f2wSupabase,
          roomId: roomId,
          onMessage: function (message) {
            if (message.type === 'hello' && message.episode) {
              applyEpisode(message.episode);
            } else if (message.type === 'episode-change') {
              applyEpisode(message.episode);
            } else if (message.type === 'playback-state' && message.state) {
              const label = message.state.status ? String(message.state.status) : 'updated';
              setStatus('Connected · playback report: ' + label);
            }
          }
        });
        await connection.ready;
        const url = new URL(window.location.href);
        url.searchParams.set(PARAM, roomId);
        history.replaceState(null, '', url);
        createButton.hidden = true;
        copyButton.hidden = false;
        leaveButton.hidden = false;
        setStatus('Connected to Watch Party. Share the invite link with friends.');
        const episode = currentEpisode();
        if (episode) await connection.send({ type: 'hello', episode: episode });
      } catch (error) {
        console.error('[Watch Party] connection failed', error);
        setStatus('Could not connect. Check the network and try again.');
      }
    }

    function applyEpisode(episode) {
      if (!episode || episode.mediaType !== 'tv') return;
      const current = currentEpisode();
      if (!current || current.mediaId !== String(episode.mediaId) ||
          !Number.isFinite(Number(episode.season)) || !Number.isFinite(Number(episode.episode))) return;
      if (current.season === Number(episode.season) && current.episode === Number(episode.episode)) return;
      applyingRemoteEpisode = true;
      const season = document.getElementById('season-select');
      const targetSeason = String(Number(episode.season));
      const targetEpisode = String(Number(episode.episode));
      if ([...season.options].some(function (option) { return option.value === targetSeason; })) {
        season.value = targetSeason;
        if (typeof window.onSeasonChange === 'function') {
          window.onSeasonChange();
          const waitForEpisode = function (attempt) {
            const select = document.getElementById('episode-select');
            if ([...select.options].some(function (option) { return option.value === targetEpisode; })) {
              select.value = targetEpisode;
              if (typeof window.onEpisodeChange === 'function') window.onEpisodeChange();
              applyingRemoteEpisode = false;
            } else if (attempt < 30) {
              setTimeout(function () { waitForEpisode(attempt + 1); }, 150);
            } else {
              applyingRemoteEpisode = false;
            }
          };
          waitForEpisode(0);
        } else {
          applyingRemoteEpisode = false;
        }
      } else {
        applyingRemoteEpisode = false;
      }
    }

    createButton.addEventListener('click', function () {
      const roomId = makeRoomId();
      join(roomId);
    });
    copyButton.addEventListener('click', async function () {
      try {
        await navigator.clipboard.writeText(window.location.href);
        setStatus('Invite link copied.');
      } catch (_) {
        setStatus('Copy failed. Copy the URL from your browser address bar.');
      }
    });
    leaveButton.addEventListener('click', async function () {
      if (connection) await connection.close();
      connection = null;
      const url = new URL(window.location.href);
      url.searchParams.delete(PARAM);
      history.replaceState(null, '', url);
      createButton.hidden = false;
      copyButton.hidden = true;
      leaveButton.hidden = true;
      setStatus('You left the Watch Party.');
    });

    document.addEventListener('change', async function (event) {
      if (applyingRemoteEpisode || !connection) return;
      if (!event.target || !['season-select', 'episode-select'].includes(event.target.id)) return;
      const episode = currentEpisode();
      const key = episodeKey(episode);
      if (!episode || !key || key === lastSentEpisode) return;
      lastSentEpisode = key;
      try {
        await connection.send({ type: 'episode-change', episode: episode });
      } catch (error) {
        console.warn('[Watch Party] episode sync failed', error);
      }
    });

    window.addEventListener('message', function (event) {
      if (!connection || event.origin !== 'https://player.flix2watch.com') return;
      const payload = event.data;
      if (!payload || payload.type !== 'PLAYER_EVENT' || !payload.data) return;
      const playerInfo = payload.data.player_info || {};
      const progress = Number(payload.data.player_progress || 0);
      const state = {
        status: String(payload.data.player_status || ''),
        seconds: Number.isFinite(progress) && progress >= 0 ? progress : 0,
        duration: Number(payload.data.player_duration || payload.data.duration || 0)
      };
      connection.send({ type: 'playback-state', state: state }).catch(function () {});
    });

    const initialRoom = new URLSearchParams(window.location.search).get(PARAM);
    if (initialRoom) join(initialRoom);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
