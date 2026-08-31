/**
 * Flix2Watch Player Guard v4 MAX FINAL
 * Cloudflare Worker route: player.flix2watch.com/*
 *
 * Design goal: strongest practical popup/new-tab suppression possible for an
 * UNSANDBOXED third-party player while preserving the provider's custom-domain
 * request, cookies, redirects, and session flow.
 *
 * IMPORTANT BROWSER LIMIT:
 * A cross-origin nested iframe that the provider loads can still own its own
 * browsing context. Without sandboxing that nested iframe, controlling that
 * nested origin, or using a browser extension/native shell, no website can
 * mathematically guarantee zero popups from that separate origin.
 *
 * v4 MAX layers:
 * - fetch(request) to preserve the existing Cloudflare Route/DNS origin flow
 * - earliest possible HTML injection before provider scripts
 * - non-configurable window.open black-hole returning a fake successful Window
 * - hardening of Window.prototype.open and legacy dialog openers
 * - anchor/area/form/base target locking (attributes + JS property setters)
 * - click/auxclick/contextmenu/keyboard activation interception
 * - submit()/requestSubmit()/dispatchEvent() interception
 * - dynamic DOM insertion/document.write/insertAdjacentHTML scrubbing
 * - known ad/pop network host filtering for dynamic fetch/XHR/beacon/resources
 * - static HTML removal of known ad/pop script/iframe/link resources
 * - same-origin child-frame guard propagation where browser security permits
 * - two-phase watchdog that keeps critical hooks reasserted
 * - no iframe sandbox attribute and no CSP sandbox directive
 */

const VERSION = 'v4-max-final';

const AD_HOST_FRAGMENTS = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'adservice.google.',
  'popads.net',
  'popcash.net',
  'popunder',
  'propellerads.com',
  'adsterra.com',
  'monetag.com',
  'onclicka.com',
  'clickadu.com',
  'clickaine.com',
  'admaven.com',
  'ad-maven.com',
  'exoclick.com',
  'exosrv.com',
  'juicyads.com',
  'trafficstars.com',
  'hilltopads.net',
  'richads.com',
  'rollerads.com',
  'evadav.com',
  'pushground.com',
  'adnxs.com',
  'taboola.com',
  'outbrain.com',
  'mgid.com'
];

const AD_PATH_PATTERNS = [
  /(?:^|[\/_\-.])pop(?:up|under)(?:[\/_\-.]|$)/i,
  /(?:^|[\/_\-.])direct[-_]?link(?:[\/_\-.]|$)/i,
  /(?:^|[\/_\-.])onclick(?:[\/_\-.]|$)/i,
  /(?:^|[\/_\-.])interstitial(?:[\/_\-.]|$)/i,
  /(?:^|[\/_\-.])ad[-_]?redirect(?:[\/_\-.]|$)/i,
  /(?:^|[\/_\-.])click[-_]?redirect(?:[\/_\-.]|$)/i
];

function parseURL(raw, base) {
  try { return new URL(String(raw || ''), base); } catch (_) { return null; }
}

function isKnownAdURL(raw, base) {
  const u = parseURL(raw, base);
  if (!u) return false;
  const host = u.hostname.toLowerCase();
  if (AD_HOST_FRAGMENTS.some(f => host === f || host.endsWith('.' + f) || host.includes(f))) return true;
  const pathish = `${u.pathname}${u.search}`;
  return AD_PATH_PATTERNS.some(re => re.test(pathish));
}

function buildGuardJS() {
  const adHosts = JSON.stringify(AD_HOST_FRAGMENTS);
  const version = JSON.stringify(VERSION);

  return String.raw`(() => {
  'use strict';

  const VERSION = ${version};
  if (window.__F2W_POPUP_GUARD_MAX__) return;

  try {
    Object.defineProperty(window, '__F2W_POPUP_GUARD_MAX__', {
      value: VERSION, enumerable: false, configurable: false, writable: false
    });
  } catch (_) { window.__F2W_POPUP_GUARD_MAX__ = VERSION; }

  // Keep a copy of this injected source so same-origin child frames can be
  // armed as well. Cross-origin child frames remain outside browser reach.
  let SELF_SOURCE = '';
  try { SELF_SOURCE = document.currentScript && document.currentScript.textContent || ''; } catch (_) {}

  const AD_HOST_FRAGMENTS = ${adHosts};
  const noop = () => {};
  const resolved = Promise.resolve();

  const native = {
    open: (() => { try { return Window.prototype.open; } catch (_) { return null; } })(),
    setAttribute: Element.prototype.setAttribute,
    removeAttribute: Element.prototype.removeAttribute,
    appendChild: Node.prototype.appendChild,
    insertBefore: Node.prototype.insertBefore,
    replaceChild: Node.prototype.replaceChild,
    append: Element.prototype.append,
    prepend: Element.prototype.prepend,
    before: Element.prototype.before,
    after: Element.prototype.after,
    replaceWith: Element.prototype.replaceWith,
    insertAdjacentHTML: Element.prototype.insertAdjacentHTML,
    anchorClick: HTMLAnchorElement.prototype.click,
    areaClick: typeof HTMLAreaElement !== 'undefined' ? HTMLAreaElement.prototype.click : null,
    formSubmit: HTMLFormElement.prototype.submit,
    formRequestSubmit: HTMLFormElement.prototype.requestSubmit,
    dispatchEvent: EventTarget.prototype.dispatchEvent,
    write: Document.prototype.write,
    writeln: Document.prototype.writeln,
    fetch: window.fetch ? window.fetch.bind(window) : null,
    xhrOpen: XMLHttpRequest.prototype.open,
    xhrSend: XMLHttpRequest.prototype.send,
    beacon: navigator.sendBeacon ? navigator.sendBeacon.bind(navigator) : null,
    createElement: Document.prototype.createElement,
    createElementNS: Document.prototype.createElementNS
  };

  const parseURL = raw => { try { return new URL(String(raw || ''), location.href); } catch (_) { return null; } };
  const dangerousScheme = raw => /^\s*(?:javascript|vbscript):/i.test(String(raw || ''));
  const blankTarget = t => /^(?:_?blank)$/i.test(String(t || '').trim());
  const external = raw => {
    const u = parseURL(raw);
    return !!u && !['about:', 'blob:', 'data:'].includes(u.protocol) && u.origin !== location.origin;
  };
  const knownAdURL = raw => {
    const u = parseURL(raw);
    if (!u) return false;
    const host = u.hostname.toLowerCase();
    if (AD_HOST_FRAGMENTS.some(f => host === f || host.endsWith('.' + f) || host.includes(f))) return true;
    const p = (u.pathname + u.search).toLowerCase();
    return /(?:^|[\/_\-.])(?:popup|popunder|direct[-_]?link|interstitial|ad[-_]?redirect|click[-_]?redirect)(?:[\/_\-.]|$)/i.test(p);
  };
  const shouldBlockNavigation = (raw, target) => blankTarget(target) || dangerousScheme(raw) || (!!raw && external(raw));

  // Window-shaped black hole. Returning an object instead of null is deliberate:
  // many ad SDKs retry when a browser popup blocker returns null.
  const blackHoleFn = new Proxy(function () {}, {
    apply() { return blackHoleFn; },
    construct() { return blackHoleFn; },
    get(_t, prop) {
      if (prop === 'then') return undefined;
      if (prop === 'closed') return false;
      if (prop === 'length') return 0;
      if (prop === Symbol.toPrimitive) return () => '';
      if (prop === 'toString') return () => '[object Window]';
      if (prop === 'valueOf') return () => blackHoleFn;
      return blackHoleFn;
    },
    set() { return true; }, defineProperty() { return true; },
    deleteProperty() { return true; }, has() { return true; }
  });

  const fakeLocation = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'href') return 'about:blank';
      if (prop === 'origin') return 'null';
      if (['assign', 'replace', 'reload'].includes(String(prop))) return noop;
      if (prop === 'toString') return () => 'about:blank';
      return '';
    },
    set() { return true; }, defineProperty() { return true; }
  });

  let fakePopup;
  fakePopup = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'closed') return false;
      if (prop === 'location') return fakeLocation;
      if (prop === 'document') return blackHoleFn;
      if (['focus','blur','close','postMessage','print','moveTo','moveBy','resizeTo','resizeBy','stop'].includes(String(prop))) return noop;
      if (prop === 'opener') return window;
      if (['parent','top','self','window','frames'].includes(String(prop))) return fakePopup;
      if (prop === 'then') return undefined;
      if (prop === Symbol.toPrimitive) return () => '';
      if (prop === 'toString') return () => '[object Window]';
      return blackHoleFn;
    },
    set() { return true; }, defineProperty() { return true; },
    deleteProperty() { return true; }, has() { return true; }
  });

  const reportBlocked = (kind, value) => {
    try {
      if (parent && parent !== window) parent.postMessage({ type: 'F2W_POPUP_BLOCKED', kind, value: String(value || ''), version: VERSION }, '*');
    } catch (_) {}
  };

  const blockedOpen = function(url) {
    reportBlocked('window.open', url);
    return fakePopup;
  };

  const lockFunction = (obj, key, fn) => {
    try {
      Object.defineProperty(obj, key, {
        configurable: false,
        enumerable: true,
        get() { return fn; },
        set() {}
      });
      return true;
    } catch (_) {
      try { obj[key] = fn; return true; } catch (_) { return false; }
    }
  };

  const installOpenGuard = () => {
    lockFunction(window, 'open', blockedOpen);
    try { lockFunction(globalThis, 'open', blockedOpen); } catch (_) {}
    try { lockFunction(Window.prototype, 'open', blockedOpen); } catch (_) {}
    try { lockFunction(window, 'showModalDialog', blockedOpen); } catch (_) {}
    try { lockFunction(window, 'showModelessDialog', blockedOpen); } catch (_) {}
  };
  installOpenGuard();

  const safeTarget = value => blankTarget(value) ? '_self' : value;

  // Attribute-level lock. This covers ordinary HTML plus many synthetic paths.
  try {
    Element.prototype.setAttribute = function(name, value) {
      const n = String(name || '').toLowerCase();
      if (n === 'target') value = safeTarget(value);
      if ((n === 'href' || n === 'action') && dangerousScheme(value)) value = '#';
      if (n === 'ping') value = '';
      if ((n === 'src' || n === 'href') && knownAdURL(value)) {
        reportBlocked('resource', value);
        value = n === 'src' ? 'about:blank' : '#';
      }
      return native.setAttribute.call(this, name, value);
    };
  } catch (_) {}

  const patchTargetSetter = proto => {
    try {
      const d = Object.getOwnPropertyDescriptor(proto, 'target');
      if (!d || !d.get || !d.set) return;
      Object.defineProperty(proto, 'target', {
        configurable: d.configurable,
        enumerable: d.enumerable,
        get: d.get,
        set(value) { return d.set.call(this, safeTarget(value)); }
      });
    } catch (_) {}
  };
  patchTargetSetter(HTMLAnchorElement.prototype);
  if (typeof HTMLAreaElement !== 'undefined') patchTargetSetter(HTMLAreaElement.prototype);
  patchTargetSetter(HTMLFormElement.prototype);
  if (typeof HTMLBaseElement !== 'undefined') patchTargetSetter(HTMLBaseElement.prototype);

  const scrubElement = el => {
    if (!el || el.nodeType !== 1) return;
    try {
      const tag = el.tagName;
      if (['A','AREA','FORM','BASE'].includes(tag) && blankTarget(el.getAttribute('target'))) {
        native.setAttribute.call(el, 'target', '_self');
      }
      if ((tag === 'A' || tag === 'AREA') && el.hasAttribute('ping')) native.setAttribute.call(el, 'ping', '');

      if (['SCRIPT','IFRAME','IMG','LINK','SOURCE'].includes(tag)) {
        const raw = el.getAttribute('src') || el.getAttribute('href') || '';
        if (raw && knownAdURL(raw)) {
          reportBlocked('resource-node', raw);
          if (tag === 'SCRIPT' || tag === 'IFRAME') native.setAttribute.call(el, 'src', 'about:blank');
          else if (el.parentNode) el.remove();
        }
      }
    } catch (_) {}
  };

  const scrubNode = root => {
    if (!root) return root;
    try {
      scrubElement(root);
      root.querySelectorAll?.('a[target="_blank"],a[target="blank"],area[target="_blank"],area[target="blank"],form[target="_blank"],form[target="blank"],base[target="_blank"],base[target="blank"]').forEach(el => native.setAttribute.call(el, 'target', '_self'));
      root.querySelectorAll?.('a[ping],area[ping]').forEach(el => native.setAttribute.call(el, 'ping', ''));
      root.querySelectorAll?.('script[src],iframe[src],img[src],link[href],source[src]').forEach(scrubElement);
    } catch (_) {}
    return root;
  };

  // Scrub nodes before they reach the live tree, reducing insert-then-click races.
  try { Node.prototype.appendChild = function(n) { scrubNode(n); return native.appendChild.call(this, n); }; } catch (_) {}
  try { Node.prototype.insertBefore = function(n, r) { scrubNode(n); return native.insertBefore.call(this, n, r); }; } catch (_) {}
  try { Node.prototype.replaceChild = function(n, r) { scrubNode(n); return native.replaceChild.call(this, n, r); }; } catch (_) {}
  if (native.append) try { Element.prototype.append = function(...nodes) { nodes.forEach(n => n?.nodeType && scrubNode(n)); return native.append.apply(this, nodes); }; } catch (_) {}
  if (native.prepend) try { Element.prototype.prepend = function(...nodes) { nodes.forEach(n => n?.nodeType && scrubNode(n)); return native.prepend.apply(this, nodes); }; } catch (_) {}
  if (native.before) try { Element.prototype.before = function(...nodes) { nodes.forEach(n => n?.nodeType && scrubNode(n)); return native.before.apply(this, nodes); }; } catch (_) {}
  if (native.after) try { Element.prototype.after = function(...nodes) { nodes.forEach(n => n?.nodeType && scrubNode(n)); return native.after.apply(this, nodes); }; } catch (_) {}
  if (native.replaceWith) try { Element.prototype.replaceWith = function(...nodes) { nodes.forEach(n => n?.nodeType && scrubNode(n)); return native.replaceWith.apply(this, nodes); }; } catch (_) {}

  const rewriteHTML = html => String(html || '')
    .replace(/\btarget\s*=\s*(["'])?_?blank\1/gi, 'target="_self"')
    .replace(/\bping\s*=\s*(["']).*?\1/gi, 'ping=""');

  if (native.insertAdjacentHTML) try {
    Element.prototype.insertAdjacentHTML = function(pos, html) {
      return native.insertAdjacentHTML.call(this, pos, rewriteHTML(html));
    };
  } catch (_) {}
  if (native.write) try { Document.prototype.write = function(...args) { return native.write.apply(this, args.map(rewriteHTML)); }; } catch (_) {}
  if (native.writeln) try { Document.prototype.writeln = function(...args) { return native.writeln.apply(this, args.map(rewriteHTML)); }; } catch (_) {}

  const destinationOf = el => {
    if (!el) return ['', ''];
    const url = el.getAttribute('href') || el.getAttribute('action') || el.href || el.action || '';
    const target = el.getAttribute('target') || el.target || '';
    return [url, target];
  };

  const blockElementActivation = el => {
    const [url, target] = destinationOf(el);
    if (shouldBlockNavigation(url, target)) {
      reportBlocked('element-activation', url);
      return true;
    }
    return false;
  };

  try {
    HTMLAnchorElement.prototype.click = function() {
      if (blockElementActivation(this)) return;
      return native.anchorClick.call(this);
    };
  } catch (_) {}
  if (native.areaClick) try {
    HTMLAreaElement.prototype.click = function() {
      if (blockElementActivation(this)) return;
      return native.areaClick.call(this);
    };
  } catch (_) {}

  const findNavigable = event => {
    try {
      for (const n of event.composedPath?.() || []) {
        if (n?.tagName === 'A' || n?.tagName === 'AREA' || n?.tagName === 'FORM') return n;
      }
    } catch (_) {}
    try { return event.target?.closest?.('a,area,form') || null; } catch (_) { return null; }
  };

  const kill = (event, kind, value) => {
    reportBlocked(kind, value);
    try { event.preventDefault(); } catch (_) {}
    try { event.stopImmediatePropagation(); } catch (_) {}
    try { event.stopPropagation(); } catch (_) {}
    return false;
  };

  const interceptActivation = event => {
    const el = findNavigable(event);
    if (!el) return;
    const [url, target] = destinationOf(el);
    if (shouldBlockNavigation(url, target)) return kill(event, 'trusted-activation', url);
  };

  for (const type of ['pointerdown','pointerup','mousedown','mouseup','touchstart','touchend','click','auxclick','dblclick','contextmenu','keydown','keyup']) {
    try { addEventListener(type, interceptActivation, { capture: true, passive: false }); } catch (_) {}
  }

  const formShouldBlock = form => {
    const action = form.getAttribute('action') || form.action || location.href;
    const target = form.getAttribute('target') || form.target || '';
    return shouldBlockNavigation(action, target);
  };
  try { addEventListener('submit', e => { if (e.target instanceof HTMLFormElement && formShouldBlock(e.target)) kill(e, 'form-submit', e.target.action); }, true); } catch (_) {}
  try { HTMLFormElement.prototype.submit = function() { if (formShouldBlock(this)) { reportBlocked('form-submit()', this.action); return; } return native.formSubmit.call(this); }; } catch (_) {}
  if (native.formRequestSubmit) try { HTMLFormElement.prototype.requestSubmit = function(s) { if (formShouldBlock(this)) { reportBlocked('requestSubmit()', this.action); return; } return native.formRequestSubmit.call(this, s); }; } catch (_) {}

  // Synthetic dispatch path.
  try {
    EventTarget.prototype.dispatchEvent = function(event) {
      if ((this instanceof HTMLAnchorElement || (typeof HTMLAreaElement !== 'undefined' && this instanceof HTMLAreaElement)) && event && /^(?:click|auxclick|dblclick|contextmenu)$/i.test(event.type || '')) {
        if (blockElementActivation(this)) return true;
      }
      if (this instanceof HTMLFormElement && event && /^submit$/i.test(event.type || '') && formShouldBlock(this)) return true;
      return native.dispatchEvent.call(this, event);
    };
  } catch (_) {}

  // Best-effort direct location method lock for same-frame ad redirects. Browser
  // engines often mark Location methods unforgeable, so these are guarded tries.
  try {
    const nativeAssign = Location.prototype.assign;
    Location.prototype.assign = function(raw) {
      if (external(raw) || knownAdURL(raw)) { reportBlocked('location.assign', raw); return; }
      return nativeAssign.call(this, raw);
    };
  } catch (_) {}
  try {
    const nativeReplace = Location.prototype.replace;
    Location.prototype.replace = function(raw) {
      if (external(raw) || knownAdURL(raw)) { reportBlocked('location.replace', raw); return; }
      return nativeReplace.call(this, raw);
    };
  } catch (_) {}

  // Known ad/pop network calls. This deliberately uses a host/path denylist only;
  // normal provider API/media/subtitle traffic is left alone.
  if (native.fetch) try {
    window.fetch = function(input, init) {
      const raw = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
      if (knownAdURL(raw)) {
        reportBlocked('fetch', raw);
        return Promise.reject(new TypeError('Failed to fetch'));
      }
      return native.fetch(input, init);
    };
  } catch (_) {}

  try {
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      this.__f2wBlockedAdRequest = knownAdURL(url);
      this.__f2wBlockedAdURL = String(url || '');
      if (this.__f2wBlockedAdRequest) {
        reportBlocked('xhr', url);
        return native.xhrOpen.call(this, method, 'about:blank', ...rest);
      }
      return native.xhrOpen.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.send = function(...args) {
      if (this.__f2wBlockedAdRequest) {
        try { this.abort(); } catch (_) {}
        return;
      }
      return native.xhrSend.apply(this, args);
    };
  } catch (_) {}

  if (native.beacon) try {
    navigator.sendBeacon = function(url, data) {
      if (knownAdURL(url)) { reportBlocked('beacon', url); return true; }
      return native.beacon(url, data);
    };
  } catch (_) {}

  // Intercept dynamically-created static resources before insertion.
  const armCreatedElement = el => {
    if (!el || el.nodeType !== 1) return el;
    try {
      if (['SCRIPT','IFRAME','IMG','LINK','SOURCE'].includes(el.tagName)) {
        const prop = el.tagName === 'LINK' ? 'href' : 'src';
        const proto = Object.getPrototypeOf(el);
        const d = proto && Object.getOwnPropertyDescriptor(proto, prop);
        if (d && d.get && d.set && !d.set.__f2wWrapped) {
          const wrapped = function(value) {
            if (knownAdURL(value)) {
              reportBlocked('resource-setter', value);
              return d.set.call(this, el.tagName === 'SCRIPT' || el.tagName === 'IFRAME' ? 'about:blank' : '');
            }
            return d.set.call(this, value);
          };
          try { Object.defineProperty(wrapped, '__f2wWrapped', { value: true }); } catch (_) {}
          try { Object.defineProperty(proto, prop, { configurable: d.configurable, enumerable: d.enumerable, get: d.get, set: wrapped }); } catch (_) {}
        }
      }
    } catch (_) {}
    return el;
  };

  if (native.createElement) try {
    Document.prototype.createElement = function(...args) { return armCreatedElement(native.createElement.apply(this, args)); };
  } catch (_) {}
  if (native.createElementNS) try {
    Document.prototype.createElementNS = function(...args) { return armCreatedElement(native.createElementNS.apply(this, args)); };
  } catch (_) {}

  // Same-origin nested-frame propagation. This is not sandboxing. It simply
  // installs the same guard in frames whose DOM the browser already permits us
  // to access. Cross-origin frames are intentionally left untouched.
  const armSameOriginFrame = frame => {
    if (!frame || frame.__f2wFrameHooked) return;
    frame.__f2wFrameHooked = true;
    const tryArm = () => {
      try {
        const cw = frame.contentWindow;
        const cd = frame.contentDocument;
        if (!cw || !cd || !cd.documentElement || cw.__F2W_POPUP_GUARD_MAX__) return;
        if (!SELF_SOURCE) return;
        const s = cd.createElement('script');
        s.setAttribute('data-f2w-popup-guard-child', VERSION);
        s.textContent = SELF_SOURCE;
        (cd.head || cd.documentElement).prepend(s);
      } catch (_) {}
    };
    try { frame.addEventListener('load', tryArm, true); } catch (_) {}
    setTimeout(tryArm, 0);
    setTimeout(tryArm, 50);
    setTimeout(tryArm, 250);
  };

  const observe = () => {
    scrubNode(document.documentElement || document);
    try { document.querySelectorAll('iframe').forEach(armSameOriginFrame); } catch (_) {}
    try {
      const mo = new MutationObserver(records => {
        for (const r of records) {
          scrubNode(r.target);
          for (const n of r.addedNodes || []) {
            scrubNode(n);
            if (n?.tagName === 'IFRAME') armSameOriginFrame(n);
            try { n.querySelectorAll?.('iframe').forEach(armSameOriginFrame); } catch (_) {}
          }
        }
      });
      mo.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['target','href','src','action','ping']
      });
    } catch (_) {}
  };
  if (document.documentElement) observe();
  else addEventListener('DOMContentLoaded', observe, { once: true });

  // Reassert critical hooks aggressively during player startup, then maintain a
  // low-frequency watchdog. Non-configurable own-property window.open is already
  // the primary lock; the watchdog mainly catches prototype/DOM drift.
  let ticks = 0;
  const startup = setInterval(() => {
    ticks++;
    installOpenGuard();
    scrubNode(document.documentElement || document);
    if (ticks >= 720) clearInterval(startup); // 3 minutes @ 250ms
  }, 250);
  setInterval(() => {
    installOpenGuard();
    scrubNode(document.documentElement || document);
  }, 3000);

  try { console.info('[Flix2Watch] player popup guard ' + VERSION + ' active'); } catch (_) {}
})();`;
}

const GUARD_JS = buildGuardJS();

class GuardInjector {
  constructor() { this.injected = false; }
  element(el) {
    if (this.injected) return;
    this.injected = true;
    const safe = GUARD_JS.replace(/<\/script/gi, '<\\/script');
    el.prepend(`<script data-f2w-popup-guard="${VERSION}">${safe}</script>`, { html: true });
  }
}

class TargetSelfHandler {
  element(el) {
    el.setAttribute('target', '_self');
    if (el.tagName === 'a' || el.tagName === 'area') {
      el.setAttribute('rel', 'noopener noreferrer');
    }
  }
}

class PingStripper {
  element(el) { el.removeAttribute('ping'); }
}

class StaticResourceBlocker {
  constructor(baseURL) { this.baseURL = baseURL; }
  element(el) {
    const raw = el.getAttribute('src') || el.getAttribute('href') || '';
    if (raw && isKnownAdURL(raw, this.baseURL)) el.remove();
  }
}

class MetaRefreshBlocker {
  constructor(baseURL) { this.baseURL = baseURL; }
  element(el) {
    const equiv = String(el.getAttribute('http-equiv') || '').toLowerCase();
    if (equiv !== 'refresh') return;
    const content = String(el.getAttribute('content') || '');
    const m = content.match(/url\s*=\s*([^;]+)$/i);
    if (m && isKnownAdURL(m[1].replace(/^['"]|['"]$/g, ''), this.baseURL)) el.remove();
  }
}

function hardenedHeaders(original) {
  const h = new Headers(original);
  h.delete('content-length');
  h.delete('content-encoding');
  h.delete('etag');
  // The injected guard must run before provider scripts. Provider CSP can block
  // that injection, so the origin CSP is removed. We add a deliberately narrow
  // form/base policy below without sandboxing the document.
  h.delete('content-security-policy');
  h.delete('content-security-policy-report-only');
  h.delete('x-frame-options'); // custom player must remain embeddable
  h.set('content-security-policy', "form-action 'self'; base-uri 'self'");
  h.set('cache-control', 'no-store, no-cache, must-revalidate');
  h.set('pragma', 'no-cache');
  h.set('x-flix2watch-player-guard', VERSION);
  return h;
}

function responseWithHeaders(response, headers) {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Simple health check so you can verify the Worker route without loading a movie.
    if (url.pathname === '/__f2w_guard_status') {
      return Response.json({ ok: true, version: VERSION, mode: 'max-final', sandbox: false }, {
        headers: { 'cache-control': 'no-store', 'x-flix2watch-player-guard': VERSION }
      });
    }

    // Session-preserving origin pass-through. On a Cloudflare Worker Route,
    // fetch(request) reaches the application server configured by the proxied DNS
    // hostname while preserving the incoming request/host/cookie flow.
    let response;
    try {
      response = await fetch(new Request(request, { redirect: 'manual' }));
    } catch (_) {
      return new Response('Player origin request failed', {
        status: 502,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'no-store',
          'x-flix2watch-player-guard': VERSION + '-fetch-error'
        }
      });
    }

    // Keep provider redirects intact. If the origin explicitly redirects back to
    // the raw VidSrc origin hostname, preserve the path but keep the custom player
    // hostname so the guard/branding/session route does not get bypassed.
    if (response.status >= 300 && response.status < 400) {
      const headers = new Headers(response.headers);
      const loc = headers.get('location');
      if (loc) {
        const target = parseURL(loc, request.url);
        if (target && target.hostname === 'vidsrc-ip.com') {
          target.protocol = url.protocol;
          target.hostname = url.hostname;
          target.port = url.port;
          headers.set('location', target.toString());
        }
      }
      headers.set('x-flix2watch-player-guard', VERSION);
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }

    const type = String(response.headers.get('content-type') || '').toLowerCase();
    if (!type.includes('text/html')) {
      // Preserve media/API/script responses byte-for-byte. We do not rewrite JS or
      // media bodies because doing so can break SRI, modules, tokens, or streams.
      return response;
    }

    const base = responseWithHeaders(response, hardenedHeaders(response.headers));
    const injector = new GuardInjector();
    const resourceBlocker = new StaticResourceBlocker(request.url);

    return new HTMLRewriter()
      .on('head', injector)
      .on('body', injector) // fallback for malformed/no-head documents
      .on('a[target="_blank"]', new TargetSelfHandler())
      .on('a[target="blank"]', new TargetSelfHandler())
      .on('area[target="_blank"]', new TargetSelfHandler())
      .on('area[target="blank"]', new TargetSelfHandler())
      .on('form[target="_blank"]', new TargetSelfHandler())
      .on('form[target="blank"]', new TargetSelfHandler())
      .on('base[target="_blank"]', new TargetSelfHandler())
      .on('base[target="blank"]', new TargetSelfHandler())
      .on('a[ping]', new PingStripper())
      .on('area[ping]', new PingStripper())
      .on('script[src]', resourceBlocker)
      .on('iframe[src]', resourceBlocker)
      .on('link[href]', resourceBlocker)
      .on('meta[http-equiv]', new MetaRefreshBlocker(request.url))
      .transform(base);
  }
};
