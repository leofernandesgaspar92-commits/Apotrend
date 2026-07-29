// Service Worker für ApoTrend: installierbar UND offline-tauglich für schwache/
// unterbrochene Verbindungen (Ziel-Märkte mit knappem Netz), OHNE Update-Staus.
// Strategie: NETWORK-FIRST für die App-Hülle (immer frisch, wenn online; aus dem
// Cache, wenn offline). API-Aufrufe werden NIE gecacht (keine veralteten Sicherheits-/
// Engpassdaten) — sie laufen unverändert übers Netz. Nur GET, nur eigene Herkunft.
const CACHE = 'apotrend-shell-v2';
const SHELL = ['/', '/index.html', '/app.js', '/app.css', '/manifest.webmanifest',
  '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Best-effort: einzelne fehlende Datei darf die Installation nicht scheitern lassen.
    await Promise.all(SHELL.map((u) => cache.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // nur GET; alles andere unverändert übers Netz
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // fremde Hosts nicht anfassen
  if (url.pathname.startsWith('/api/')) return;     // API nie cachen (immer frische Daten)
  // Network-first: online frisch + Cache aktualisieren; offline aus dem Cache (Fallback Hülle).
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    } catch {
      const cached = await caches.match(req);
      if (cached) return cached;
      if (req.mode === 'navigate') { const shell = await caches.match('/index.html'); if (shell) return shell; }
      throw new Error('offline und nicht im Cache');
    }
  })());
});
