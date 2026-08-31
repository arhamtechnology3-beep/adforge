/** Default origin when env + request are unavailable */
export function defaultAppOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  );
}

export function resolveAppOrigin(request?: Request): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }
  if (request) {
    try {
      return new URL(request.url).origin;
    } catch {
      /* ignore */
    }
  }
  return defaultAppOrigin();
}

/** Turn relative creative paths into absolute URLs (Meta launch, emails). */
export function toPublicUrl(pathOrUrl: string, origin?: string): string {
  if (!pathOrUrl) return pathOrUrl;
  const base = (origin || defaultAppOrigin()).replace(/\/$/, '');

  if (/^https?:\/\//i.test(pathOrUrl)) {
    // Fix stale dev URLs from older generates
    return pathOrUrl
      .replace('http://localhost:3010', base)
      .replace('https://localhost:3010', base);
  }

  return pathOrUrl.startsWith('/') ? `${base}${pathOrUrl}` : `${base}/${pathOrUrl}`;
}

/** Fix creative URLs saved with wrong localhost port (browser-side). */
export function normalizeCreativeUrl(url: string): string {
  if (!url) return url;
  if (typeof window === 'undefined') return url;

  try {
    if (url.startsWith('/')) return url;
    const parsed = new URL(url, window.location.origin);
    if (parsed.hostname === 'localhost' && parsed.port && parsed.port !== window.location.port) {
      return `${parsed.pathname}${parsed.search}`;
    }
    if (parsed.origin === window.location.origin) {
      return `${parsed.pathname}${parsed.search}`;
    }
    return url;
  } catch {
    return url;
  }
}
