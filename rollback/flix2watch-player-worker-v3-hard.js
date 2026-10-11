/**
 * Flix2Watch Player Guard v3 HARD
 * Route: player.flix2watch.com/*
 *
 * Maximum practical popup suppression for an UNSANDBOXED player while
 * preserving the provider's custom-domain/session flow.
 *
 * v3 hardening over v2:
 * - keeps fetch(request) session preservation
 * - injects before provider scripts in <head>
 * - fake successful window.open result (prevents retry loops)
 * - locks window.open on window/globalThis/Window.prototype
 * - catches anchor/form target property setters as well as setAttribute
 * - catches synthetic click(), dispatchEvent(), submit()/requestSubmit()
 * - scrubs nodes before append/prepend/insert/replace/insertAdjacentHTML
 * - rewrites document.write()/writeln() _blank targets
 * - capture-phase blocking for mouse/pointer/touch/keyboard activation
 * - blocks external ping/download-style navigation helpers
 * - reasserts guard for two minutes, then at a low-frequency watchdog
 *
 * It intentionally does NOT sandbox iframes and does NOT block provider media,
 * XHR/fetch, scripts, subtitles, fullscreen, or same-origin navigation.
 */

const GUARD_JS = String.raw`
(() => {
  'use strict';
  if (window.__F2W_POPUP_GUARD_V3_HARD__) return;

  try {
    Object.defineProperty(window, '__F2W_POPUP_GUARD_V3_HARD__', {
      value: true, enumerable: false, configurable: false, writable: false
    });
  } catch (_) { window.__F2W_POPUP_GUARD_V3_HARD__ = true; }

  const noop = () => {};
  const native = {
    setAttribute: Element.prototype.setAttribute,
    getAttribute: Element.prototype.getAttribute,
    appendChild: Node.prototype.appendChild,
    insertBefore: Node.prototype.insertBefore,
    replaceChild: Node.prototype.replaceChild,
    append: Element.prototype.append,
    prepend: Element.prototype.prepend,
    insertAdjacentHTML: Element.prototype.insertAdjacentHTML,
    anchorClick: HTMLAnchorElement.prototype.click,
    formSubmit: HTMLFormElement.prototype.submit,
    formRequestSubmit: HTMLFormElement.prototype.requestSubmit,
    dispatchEvent: EventTarget.prototype.dispatchEvent,
    write: Document.prototype.write,
    writeln: Document.prototype.writeln
  };

  // Return a Window-shaped black hole rather than null. Many ad SDKs retry
  // forever when a browser popup blocker returns null.
  let fakePopup;
  const blackHole = new Proxy(function () {}, {
    apply() { return blackHole; },
    construct() { return blackHole; },
    get(_t, prop) {
      if (prop === 'then') return undefined;
      if (prop === 'closed') return false;
      if (prop === 'length') return 0;
      if (prop === Symbol.toPrimitive) return () => '';
      if (prop === 'toString') return () => '[object Window]';
      if (prop === 'valueOf') return () => blackHole;
      if (prop === 'opener') return window;
      if (['parent','top','self','window','frames'].includes(String(prop))) return fakePopup || blackHole;
      return blackHole;
    },
    set() { return true; }, defineProperty() { return true; },
    deleteProperty() { return true; }, has() { return true; }
  });

  const fakeLocation = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'href' || prop === 'origin') return prop === 'href' ? 'about:blank' : 'null';
      if (['assign','replace','reload'].includes(String(prop))) return noop;
      if (prop === 'toString') return () => 'about:blank';
      return '';
    },
    set() { return true; }, defineProperty() { return true; }
  });

  fakePopup = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'closed') return false;
      if (prop === 'location') return fakeLocation;
      if (prop === 'document') return blackHole;
      if (['focus','blur','close','postMessage','print','moveTo','moveBy','resizeTo','resizeBy','stop'].includes(String(prop))) return noop;
      if (prop === 'opener') return window;
      if (['parent','top','self','window','frames'].includes(String(prop))) return fakePopup;
      if (prop === 'then') return undefined;
      if (prop === Symbol.toPrimitive) return () => '';
      if (prop === 'toString') return () => '[object Window]';
      return blackHole;
    },
    set() { return true; }, defineProperty() { return true; },
    deleteProperty() { return true; }, has() { return true; }
  });

  const blockedOpen = function () { return fakePopup; };

  const hardDefine = (obj, key, value) => {
    try { Object.defineProperty(obj, key, { value, writable: false, configurable: false }); return true; }
    catch (_) { try { obj[key] = value; return true; } catch (_) { return false; } }
  };

  const installOpenGuard = () => {
    hardDefine(window, 'open', blockedOpen);
    try { Window.prototype.open = blockedOpen; } catch (_) {}
    try { globalThis.open = blockedOpen; } catch (_) {}
    try { window.showModalDialog = blockedOpen; } catch (_) {}
  };
  installOpenGuard();

  const parseURL = raw => { try { return new URL(String(raw || ''), location.href); } catch (_) { return null; } };
  const dangerousScheme = raw => /^\s*(?:javascript|data|vbscript):/i.test(String(raw || ''));
  const external = raw => { const u = parseURL(raw); return !!u && !['about:','blob:'].includes(u.protocol) && u.origin !== location.origin; };
  const blankTarget = t => /^(?:_?blank)$/i.test(String(t || '').trim());
  const shouldBlock = (raw, target) => blankTarget(target) || dangerousScheme(raw) || (!!raw && external(raw));

  const safeSetTarget = (el, value) => native.setAttribute.call(el, 'target', blankTarget(value) ? '_self' : value);

  // Attribute path.
  try {
    Element.prototype.setAttribute = function(name, value) {
      const n = String(name || '').toLowerCase();
      if (n === 'target' && blankTarget(value)) value = '_self';
      if ((n === 'href' || n === 'action') && dangerousScheme(value)) value = '#';
      if (n === 'ping') value = '';
      return native.setAttribute.call(this, name, value);
    };
  } catch (_) {}

  // Property setter path (a.target = '_blank', form.target = '_blank').
  const patchTargetSetter = (proto) => {
    try {
      const d = Object.getOwnPropertyDescriptor(proto, 'target');
      if (!d || !d.get || !d.set) return;
      Object.defineProperty(proto, 'target', {
        configurable: d.configurable,
        enumerable: d.enumerable,
        get: d.get,
        set(value) { return d.set.call(this, blankTarget(value) ? '_self' : value); }
      });
    } catch (_) {}
  };
  patchTargetSetter(HTMLAnchorElement.prototype);
  patchTargetSetter(HTMLFormElement.prototype);
  try { patchTargetSetter(HTMLBaseElement.prototype); } catch (_) {}

  // Remove <base target="_blank">, which can silently make ordinary links pop.
  const scrubNode = (root) => {
    if (!root) return root;
    try {
      if (root.nodeType === 1) {
        if ((root.tagName === 'A' || root.tagName === 'FORM' || root.tagName === 'BASE') && blankTarget(root.getAttribute('target'))) safeSetTarget(root, '_self');
        if (root.tagName === 'A') {
          if (dangerousScheme(root.getAttribute('href'))) native.setAttribute.call(root, 'href', '#');
          if (root.hasAttribute('ping')) native.setAttribute.call(root, 'ping', '');
        }
      }
      root.querySelectorAll?.('a[target="_blank"],a[target="blank"],form[target="_blank"],form[target="blank"],base[target="_blank"],base[target="blank"]').forEach(el => safeSetTarget(el, '_self'));
      root.querySelectorAll?.('a[ping]').forEach(a => native.setAttribute.call(a, 'ping', ''));
    } catch (_) {}
    return root;
  };

  // Scrub before insertion so a script cannot insert-and-click in the same task.
  try { Node.prototype.appendChild = function(n) { scrubNode(n); return native.appendChild.call(this, n); }; } catch (_) {}
  try { Node.prototype.insertBefore = function(n, r) { scrubNode(n); return native.insertBefore.call(this, n, r); }; } catch (_) {}
  try { Node.prototype.replaceChild = function(n, r) { scrubNode(n); return native.replaceChild.call(this, n, r); }; } catch (_) {}
  if (native.append) try { Element.prototype.append = function(...nodes) { nodes.forEach(n => n?.nodeType && scrubNode(n)); return native.append.apply(this, nodes); }; } catch (_) {}
  if (native.prepend) try { Element.prototype.prepend = function(...nodes) { nodes.forEach(n => n?.nodeType && scrubNode(n)); return native.prepend.apply(this, nodes); }; } catch (_) {}

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

  // Synthetic anchor click path.
  try {
    HTMLAnchorElement.prototype.click = function() {
      const href = this.getAttribute('href') || this.href || '';
      const target = this.getAttribute('target') || '';
      if (shouldBlock(href, target)) return;
      return native.anchorClick.call(this);
    };
  } catch (_) {}

  const findAnchor = event => {
    try { for (const n of event.composedPath?.() || []) if (n?.tagName === 'A') return n; } catch (_) {}
    try { return event.target?.closest?.('a') || null; } catch (_) { return null; }
  };
  const findForm = event => {
    try { for (const n of event.composedPath?.() || []) if (n?.tagName === 'FORM') return n; } catch (_) {}
    try { return event.target?.closest?.('form') || null; } catch (_) { return null; }
  };

  const kill = event => {
    try { event.preventDefault(); } catch (_) {}
    try { event.stopImmediatePropagation(); } catch (_) {}
    try { event.stopPropagation(); } catch (_) {}
  };

  const interceptActivation = event => {
    const a = findAnchor(event);
    if (a) {
      const href = a.getAttribute('href') || a.href || '';
      const target = a.getAttribute('target') || '';
      if (shouldBlock(href, target)) return kill(event);
    }
    const f = findForm(event);
    if (f) {
      const action = f.getAttribute('action') || f.action || location.href;
      const target = f.getAttribute('target') || '';
      if (shouldBlock(action, target)) return kill(event);
    }
  };

  for (const type of ['pointerdown','pointerup','mousedown','mouseup','touchstart','touchend','click','auxclick','dblclick','contextmenu','keydown','keyup']) {
    try { addEventListener(type, interceptActivation, { capture: true, passive: false }); } catch (_) {}
  }

  const formShouldBlock = form => {
    const action = form.getAttribute('action') || form.action || location.href;
    const target = form.getAttribute('target') || '';
    return shouldBlock(action, target);
  };
  try { addEventListener('submit', e => { if (e.target instanceof HTMLFormElement && formShouldBlock(e.target)) kill(e); }, true); } catch (_) {}
  try { HTMLFormElement.prototype.submit = function() { if (formShouldBlock(this)) return; return native.formSubmit.call(this); }; } catch (_) {}
  if (native.formRequestSubmit) try { HTMLFormElement.prototype.requestSubmit = function(s) { if (formShouldBlock(this)) return; return native.formRequestSubmit.call(this, s); }; } catch (_) {}

  // dispatchEvent(new MouseEvent('click')) can bypass .click() overrides.
  try {
    EventTarget.prototype.dispatchEvent = function(event) {
      if (this instanceof HTMLAnchorElement && event && /^(?:click|auxclick|dblclick)$/i.test(event.type || '')) {
        const href = this.getAttribute('href') || this.href || '';
        const target = this.getAttribute('target') || '';
        if (shouldBlock(href, target)) return true;
      }
      return native.dispatchEvent.call(this, event);
    };
  } catch (_) {}

  const observe = () => {
    scrubNode(document.documentElement || document);
    try {
      const mo = new MutationObserver(records => {
        for (const r of records) {
          scrubNode(r.target);
          for (const n of r.addedNodes || []) scrubNode(n);
        }
      });
      mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['target','href','action','ping'] });
    } catch (_) {}
  };
  if (document.documentElement) observe(); else addEventListener('DOMContentLoaded', observe, { once: true });

  // High-frequency startup lock for 2 minutes, then watchdog for page lifetime.
  let ticks = 0;
  const startup = setInterval(() => {
    ticks++;
    installOpenGuard();
    scrubNode(document.documentElement || document);
    if (ticks >= 480) clearInterval(startup);
  }, 250);
  setInterval(() => { installOpenGuard(); scrubNode(document.documentElement || document); }, 5000);

  try { console.info('[Flix2Watch] player popup guard v3 HARD active'); } catch (_) {}
})();
`;

class HeadInjector {
  element(el) {
    const safe = GUARD_JS.replace(/<\/script/gi, '<\\/script');
    el.prepend(`<script data-f2w-popup-guard="v3-hard">${safe}</script>`, { html: true });
  }
}
class StripBlankTarget { element(el) { el.setAttribute('target', '_self'); } }
class StripPing { element(el) { el.setAttribute('ping', ''); } }

function htmlHeaders(original) {
  const h = new Headers(original);
  h.delete('content-length');
  h.delete('content-encoding');
  h.delete('etag');
  h.delete('content-security-policy');
  h.delete('content-security-policy-report-only');
  h.delete('x-frame-options');
  h.set('cache-control', 'no-store, no-cache, must-revalidate');
  h.set('pragma', 'no-cache');
  h.set('x-flix2watch-player-guard', 'v3-hard');
  return h;
}

export default {
  async fetch(request) {
    const originRequest = new Request(request, { redirect: 'manual' });
    let response;
    try {
      response = await fetch(originRequest);
    } catch (_) {
      return new Response('Player origin request failed', {
        status: 502,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'x-flix2watch-player-guard': 'v3-hard-fetch-error' }
      });
    }

    if (response.status >= 300 && response.status < 400) return response;
    const type = response.headers.get('content-type') || '';
    if (!type.toLowerCase().includes('text/html')) return response;

    const base = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: htmlHeaders(response.headers)
    });

    return new HTMLRewriter()
      .on('head', new HeadInjector())
      .on('a[target="_blank"]', new StripBlankTarget())
      .on('a[target="blank"]', new StripBlankTarget())
      .on('form[target="_blank"]', new StripBlankTarget())
      .on('form[target="blank"]', new StripBlankTarget())
      .on('base[target="_blank"]', new StripBlankTarget())
      .on('base[target="blank"]', new StripBlankTarget())
      .on('a[ping]', new StripPing())
      .transform(base);
  }
};
