/**
 * Flix2Watch Parent Popup Shield v4 MAX
 * Drop this in the site root. The packaged copy named popup-protection-v34.js
 * can directly replace the existing file without changing watch/index.html.
 */
(() => {
  'use strict';
  if (window.__F2W_PARENT_POPUP_SHIELD_MAX__) return;

  const VERSION = 'v4-max-final';
  try {
    Object.defineProperty(window, '__F2W_PARENT_POPUP_SHIELD_MAX__', {
      value: VERSION, configurable: false, writable: false
    });
  } catch (_) { window.__F2W_PARENT_POPUP_SHIELD_MAX__ = VERSION; }

  const nativeOpen = (() => {
    try { return Window.prototype.open.call.bind(Window.prototype.open); }
    catch (_) { try { return window.open.bind(window); } catch (_) { return null; } }
  })();
  const nativeAnchorClick = HTMLAnchorElement.prototype.click;
  const nativeFormSubmit = HTMLFormElement.prototype.submit;
  const nativeFormRequestSubmit = HTMLFormElement.prototype.requestSubmit;
  const nativeSetAttribute = Element.prototype.setAttribute;

  const AUTH_HOSTS = new Set([
    'viqufxlcxwgboyxbdhjb.supabase.co',
    'accounts.google.com',
    'discord.com',
    'www.discord.com'
  ]);

  const AD_HOST_FRAGMENTS = [
    'doubleclick.net','googlesyndication.com','googleadservices.com','adservice.google.',
    'popads.net','popcash.net','propellerads.com','adsterra.com','monetag.com',
    'onclicka.com','clickadu.com','clickaine.com','admaven.com','ad-maven.com',
    'exoclick.com','exosrv.com','juicyads.com','trafficstars.com','hilltopads.net',
    'richads.com','rollerads.com','evadav.com','pushground.com','adnxs.com',
    'taboola.com','outbrain.com','mgid.com'
  ];

  const parseURL = value => { try { return new URL(String(value || ''), location.href); } catch (_) { return null; } };
  const allowedPopupURL = value => {
    const u = parseURL(value);
    if (!u) return false;
    if (u.origin === location.origin) return true;
    return AUTH_HOSTS.has(u.hostname.toLowerCase());
  };
  const knownAdURL = value => {
    const u = parseURL(value);
    if (!u) return false;
    const host = u.hostname.toLowerCase();
    if (AD_HOST_FRAGMENTS.some(f => host === f || host.endsWith('.' + f) || host.includes(f))) return true;
    return /(?:^|[\/_\-.])(?:popup|popunder|direct[-_]?link|interstitial|ad[-_]?redirect|click[-_]?redirect)(?:[\/_\-.]|$)/i.test(u.pathname + u.search);
  };
  const explicitlyAllowed = el => !!(el?.dataset?.f2wAllowPopup === 'true');

  const noop = () => {};
  const blackHole = new Proxy(function(){}, {
    apply(){ return blackHole; }, construct(){ return blackHole; },
    get(_t, prop){
      if (prop === 'closed') return false;
      if (prop === 'then') return undefined;
      if (prop === Symbol.toPrimitive) return () => '';
      if (prop === 'toString') return () => '[object Window]';
      if (['focus','blur','close','postMessage','print','moveTo','moveBy','resizeTo','resizeBy'].includes(String(prop))) return noop;
      return blackHole;
    },
    set(){ return true; }, defineProperty(){ return true; }, deleteProperty(){ return true; }, has(){ return true; }
  });

  function blockedPopup(url) {
    try { console.info('[Flix2Watch] blocked parent popup/new tab:', url || 'about:blank'); } catch (_) {}
    return blackHole;
  }

  function guardedOpen(url, target, features) {
    if (allowedPopupURL(url)) {
      try {
        const w = nativeOpen ? nativeOpen(window, url, target || '_blank', features) : null;
        try { if (w) w.opener = null; } catch (_) {}
        return w;
      } catch (_) { return null; }
    }
    return blockedPopup(url);
  }

  // Lock the parent opener so later page scripts/ad callbacks cannot replace it.
  try {
    Object.defineProperty(window, 'open', {
      configurable: false,
      enumerable: true,
      get(){ return guardedOpen; },
      set(){}
    });
  } catch (_) { try { window.open = guardedOpen; } catch (_) {} }

  try {
    Object.defineProperty(Window.prototype, 'open', {
      configurable: false,
      enumerable: true,
      get(){ return guardedOpen; },
      set(){}
    });
  } catch (_) {}

  function protectAnchor(a) {
    if (!a) return;
    if (String(a.target || '').toLowerCase() === '_blank') {
      const rel = new Set(String(a.rel || '').split(/\s+/).filter(Boolean));
      rel.add('noopener'); rel.add('noreferrer');
      a.rel = [...rel].join(' ');
      a.referrerPolicy = 'no-referrer';
    }
    if (a.hasAttribute('ping')) a.removeAttribute('ping');
  }

  function shouldBlockAnchor(a) {
    if (!a || explicitlyAllowed(a)) return false;
    const target = String(a.target || '').toLowerCase();
    if (target !== '_blank' && target !== 'blank') return false;
    return !allowedPopupURL(a.href);
  }

  try {
    HTMLAnchorElement.prototype.click = function() {
      protectAnchor(this);
      if (shouldBlockAnchor(this)) return blockedPopup(this.href);
      return nativeAnchorClick.call(this);
    };
  } catch (_) {}

  function shouldBlockForm(form) {
    if (!form || explicitlyAllowed(form)) return false;
    const target = String(form.target || '').toLowerCase();
    if (target !== '_blank' && target !== 'blank') return false;
    return !allowedPopupURL(form.action || location.href);
  }

  try {
    HTMLFormElement.prototype.submit = function() {
      if (shouldBlockForm(this)) { blockedPopup(this.action); return; }
      return nativeFormSubmit.call(this);
    };
  } catch (_) {}
  if (nativeFormRequestSubmit) try {
    HTMLFormElement.prototype.requestSubmit = function(submitter) {
      if (shouldBlockForm(this)) { blockedPopup(this.action); return; }
      return nativeFormRequestSubmit.call(this, submitter);
    };
  } catch (_) {}

  try {
    Element.prototype.setAttribute = function(name, value) {
      const n = String(name || '').toLowerCase();
      if (n === 'ping') value = '';
      if (n === 'target' && /^(?:_?blank)$/i.test(String(value || ''))) {
        const href = this.getAttribute?.('href') || this.getAttribute?.('action') || '';
        if (!explicitlyAllowed(this) && !allowedPopupURL(href)) value = '_self';
      }
      return nativeSetAttribute.call(this, name, value);
    };
  } catch (_) {}

  function kill(e, url) {
    blockedPopup(url);
    try { e.preventDefault(); } catch (_) {}
    try { e.stopImmediatePropagation(); } catch (_) {}
    try { e.stopPropagation(); } catch (_) {}
  }

  for (const type of ['click','auxclick','dblclick','contextmenu']) {
    document.addEventListener(type, e => {
      const a = e.target?.closest?.('a');
      if (!a) return;
      protectAnchor(a);
      if (shouldBlockAnchor(a)) kill(e, a.href);
    }, true);
  }

  document.addEventListener('submit', e => {
    const form = e.target;
    if (form instanceof HTMLFormElement && shouldBlockForm(form)) kill(e, form.action);
  }, true);

  function removeKnownAdNode(node) {
    if (!node || node.nodeType !== 1) return;
    const list = [];
    if (node.matches?.('script[src],iframe[src],img[src],link[href]')) list.push(node);
    node.querySelectorAll?.('script[src],iframe[src],img[src],link[href]').forEach(el => list.push(el));
    for (const el of list) {
      const raw = el.src || el.href || '';
      if (knownAdURL(raw)) {
        try { el.remove(); } catch (_) {}
      }
    }
  }

  function protectTree(root = document) {
    root.querySelectorAll?.('a[target="_blank"],a[target="blank"]').forEach(a => {
      protectAnchor(a);
      if (shouldBlockAnchor(a)) a.target = '_self';
    });
    root.querySelectorAll?.('form[target="_blank"],form[target="blank"]').forEach(f => {
      if (shouldBlockForm(f)) f.target = '_self';
    });
    root.querySelectorAll?.('a[ping]').forEach(a => a.removeAttribute('ping'));
    removeKnownAdNode(root.documentElement || root);
  }

  protectTree();
  try {
    const mo = new MutationObserver(records => {
      for (const r of records) {
        for (const n of r.addedNodes || []) {
          if (n?.nodeType !== 1) continue;
          protectTree(n);
        }
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch (_) {}

  // Player-origin messages: keep the documented progress event, acknowledge our
  // guard event, and suppress obvious requests to open/navigate a new window so
  // later parent listeners cannot turn them into a popup.
  const PLAYER_ORIGIN = 'https://player.flix2watch.com';
  const suspiciousTypes = new Set(['OPEN','OPEN_URL','OPEN_WINDOW','POPUP','POPUNDER','REDIRECT','NAVIGATE','NEW_TAB']);
  window.addEventListener('message', e => {
    if (e.origin !== PLAYER_ORIGIN) return;
    const data = e.data;
    const type = String(data?.type || data?.action || '').toUpperCase();
    if (type === 'F2W_POPUP_BLOCKED') {
      recoverFocus();
      return;
    }
    if (type === 'PLAYER_EVENT') return;
    if (suspiciousTypes.has(type)) {
      try { e.stopImmediatePropagation(); } catch (_) {}
      recoverFocus();
    }
  }, true);

  // Focus recovery after provider interaction. This cannot close a popup that a
  // separate cross-origin nested frame already created, but it minimizes tab/focus
  // theft and complements the worker-side guard.
  let lastPlayerInteraction = 0;
  let recovering = false;
  const markPlayer = e => {
    if (e.target?.closest?.('.player-wrapper,.video-container,#video-frame,iframe')) lastPlayerInteraction = Date.now();
  };
  document.addEventListener('pointerdown', markPlayer, true);
  document.addEventListener('mousedown', markPlayer, true);
  document.addEventListener('touchstart', markPlayer, { capture: true, passive: true });

  function recoverFocus() {
    if (recovering) return;
    recovering = true;
    [0, 30, 80, 160, 320, 640, 1100].forEach((delay, i) => {
      setTimeout(() => {
        try { window.focus(); } catch (_) {}
        if (i === 6) recovering = false;
      }, delay);
    });
  }

  window.addEventListener('blur', () => {
    if (Date.now() - lastPlayerInteraction < 2500) recoverFocus();
  }, true);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && Date.now() - lastPlayerInteraction < 2500) recoverFocus();
  }, true);

  try { console.info('[Flix2Watch] parent popup shield ' + VERSION + ' active'); } catch (_) {}
})();
