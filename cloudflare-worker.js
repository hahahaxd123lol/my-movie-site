
/*
  Flix2Watch optional Cloudflare edge worker.
  Route this Worker to flix2watch.com/* only if the custom domain is proxied
  through Cloudflare. It does not contain Supabase secrets.
*/

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    // Optional Cloudflare deployment: force the canonical secure origin at
    // the edge before any HTML is served.
    if (url.protocol !== 'https:' || url.hostname === 'www.flix2watch.com') {
      url.protocol = 'https:';
      url.hostname = 'flix2watch.com';
      return Response.redirect(url.toString(), 301);
    }

    if (method !== 'GET' && method !== 'HEAD') {
      return fetch(request);
    }

    const path = url.pathname;
    const isHtml =
      request.headers.get('accept')?.includes('text/html') ||
      path.endsWith('/') ||
      !/\.[A-Za-z0-9]+$/.test(path);

    const isImage = /\.(?:png|jpg|jpeg|webp|gif|svg|ico)$/i.test(path);
    const isStaticCode = /\.(?:css|js|mjs|json|webmanifest)$/i.test(path);

    // GitHub Pages remains the origin. Cloudflare caches safe public assets.
    const response = await fetch(request, {
      cf: {
        cacheEverything: !isHtml,
        cacheTtl: isImage ? 2592000 : isStaticCode ? 300 : 0
      }
    });

    const headers = new Headers(response.headers);

    // Never let HTML get stuck behind a stale edge copy.
    if (isHtml) {
      headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
    } else if (isImage) {
      headers.set('Cache-Control', 'public, max-age=2592000, stale-while-revalidate=86400');
    } else if (isStaticCode) {
      headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
    }

    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'SAMEORIGIN');
    headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    headers.set('Strict-Transport-Security', 'max-age=31536000');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
