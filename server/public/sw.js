// Service Worker für ApoPulse: installierbar UND offline-tauglich für schwache/
// unterbrochene Verbindungen (Ziel-Märkte mit knappem Netz), OHNE Update-Staus.
// Strategie: NETWORK-FIRST für die App-Hülle (immer frisch, wenn online; aus dem
// Cache, wenn offline). API-Aufrufe gehen IMMER zuerst übers Netz (keine veralteten
// Sicherheits-/Engpassdaten, solange Netz da ist). Nur wenn das Netz fehlt, liefern
// ausgewählte Lese-Ansichten den zuletzt geladenen Stand — sichtbar gekennzeichnet
// (siehe API_CACHE unten). Nur GET, nur eigene Herkunft. „Netz fehlt" heißt auch: Netz
// antwortet nicht innerhalb der Frist (FRIST_HUELLE / FRIST_API unten).
// v3: Die Sprachtexte liegen seit dem 06.09.2026 in einer eigenen Datei
// (/i18n.js). Ohne neuen Cache-Namen behielten bestehende Installationen
// ihre alte Shell — index.html ohne den neuen <script>-Eintrag — und die
// Anwendung startete mit undefiniertem I18N: leere Beschriftungen ueberall,
// und zwar nur bei Bestandsnutzer:innen. Die Version MUSS mitziehen, wenn
// sich die Liste unten aendert.
// v4: Statt /i18n.js (alle Sprachen) lädt die Seite nur noch /i18n/<sprache>.js —
// die landet beim Abruf im Speicher (Netz zuerst, unten), nicht vorab alle fünf.
const CACHE = 'apopulse-shell-v5';
// Gespeicherte Lese-Antworten für offline. Schlüssel enthält einen Hash des
// Anmelde-Tokens: Auf einem geteilten Gerät sieht kein Konto die Daten eines
// anderen. Abmelden löscht den ganzen Speicher (Seite: caches.delete).
const API_CACHE = 'apopulse-api-v1';
const OFFLINE_LESBAR = [/^\/api\/shortages$/, /^\/api\/news$/, /^\/api\/watchlist$/, /^\/api\/overview$/, /^\/api\/lage\/ebene$/, /^\/api\/wirkstoff\/[^/]+$/, /^\/api\/me$/, /^\/api\/countries$/, /^\/api\/country-config$/, /^\/api\/bookmarks\/ids$/];
// Ohne Anmeldung lesbar und für alle gleich (welche Bereiche laufen): ebenfalls offline vorhalten.
const OFFLINE_OEFFENTLICH = [/^\/api\/features$/];
async function apiSchluessel(req) {
  const roh = new TextEncoder().encode(req.headers.get('Authorization') || '');
  const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', roh))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const u = new URL(req.url);
  u.searchParams.set('__konto', h);
  return u.href;
}
// Netz HÄNGT (Verbindung da, aber keine Antwort — in den Zielmärkten häufig): Bis 10/2026
// wartete die App dann endlos, obwohl alles im Speicher lag. Jetzt: nach einer Frist der
// gespeicherte Stand; der Abruf läuft weiter und aktualisiert den Speicher. Ist das Netz
// gerade als hängend erkannt, gleich aus dem Speicher (sonst wartete jede Datei einzeln).
// Hülle und API getrennt: eine langsame app.js auf 2G macht API-Daten nicht zu „offline".
const FRIST_HUELLE = 4000, FRIST_API = 6000, HAENGT_MS = 15000;
const haengt = { huelle: 0, api: 0 };
const FRIST = Symbol('frist');
const rennen = (netz, ms) => Promise.race([netz, new Promise((_, f) => setTimeout(() => f(FRIST), ms))]);
async function netzZuerst(req) {
  const schluessel = await apiSchluessel(req);
  const netz = fetch(req).then((res) => {
    haengt.api = 0;
    if (res.ok) {
      const kopf = new Headers(res.headers);
      // Der Körper wird entpackt gespeichert — Kompressions-Angaben passen dann nicht mehr.
      kopf.delete('content-encoding'); kopf.delete('content-length');
      kopf.set('x-apo-gespeichert', new Date().toISOString());
      res.clone().arrayBuffer().then((koerper) => caches.open(API_CACHE).then((c) => c.put(schluessel, new Response(koerper, { status: 200, headers: kopf })))).catch(() => {});
    }
    return res;
  });
  netz.catch(() => {}); // läuft ggf. im Hintergrund zu Ende
  const ausSpeicher = async () => {
    const alt = await caches.match(schluessel, { cacheName: API_CACHE });
    if (!alt) return null;
    const kopf = new Headers(alt.headers);
    kopf.set('x-apo-offline', '1');
    return new Response(await alt.arrayBuffer(), { status: 200, headers: kopf });
  };
  try {
    if (Date.now() < haengt.api) { const a = await ausSpeicher(); if (a) return a; }
    return await rennen(netz, FRIST_API);
  } catch (err) {
    if (err === FRIST) haengt.api = Date.now() + HAENGT_MS;
    const a = await ausSpeicher();
    if (a) return a;
    if (err === FRIST) return netz; // nichts gespeichert: weiter aufs Netz warten
    throw err;
  }
}
const SHELL = ['/', '/index.html', '/app.js', '/app.css', '/manifest.webmanifest',
  '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/icon.svg', '/apple-touch-icon.png'];

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
    await Promise.all(keys.filter((k) => k !== CACHE && k !== API_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // nur GET; alles andere unverändert übers Netz
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // fremde Hosts nicht anfassen
  // API: grundsätzlich NICHT aus dem Speicher — Engpassdaten müssen frisch sein.
  // Einzige Ausnahme: OFFLINE. Dann liefern ausgewählte Lese-Ansichten den
  // zuletzt geladenen Stand — gekennzeichnet (x-apo-offline + Zeitpunkt), die
  // App zeigt „Offline — gespeicherter Stand von …". Schwache Netze sind in den
  // Zielmärkten (Afrika) der Normalfall, eine leere App hilft dort niemandem.
  if (url.pathname.startsWith('/api/')) {
    if ((OFFLINE_LESBAR.some((rx) => rx.test(url.pathname)) && req.headers.get('Authorization')) || OFFLINE_OEFFENTLICH.some((rx) => rx.test(url.pathname))) e.respondWith(netzZuerst(req));
    return;
  }
  // Netz zuerst: online frisch + Speicher aktualisieren; offline oder nach der Frist aus dem
  // Speicher (Rückfall Hülle). Der Abruf startet sofort und läuft im Hintergrund weiter.
  const netz = fetch(req).then((res) => {
    haengt.huelle = 0;
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); }
    return res;
  });
  e.waitUntil(netz.then(() => {}, () => {}));
  const ausSpeicher = async () => (await caches.match(req)) || (req.mode === 'navigate' ? await caches.match('/index.html') : null) || null;
  e.respondWith((async () => {
    try {
      if (Date.now() < haengt.huelle) { const c = await ausSpeicher(); if (c) return c; }
      return await rennen(netz, FRIST_HUELLE);
    } catch (err) {
      if (err === FRIST) {
        haengt.huelle = Date.now() + HAENGT_MS;
        // Bleibt sogar die kleine Startseite ohne Antwort, ist das Netz unbrauchbar: dann auch
        // die Daten gleich aus dem Speicher (eine langsame große app.js zählt hier nicht).
        if (req.mode === 'navigate') haengt.api = haengt.huelle;
      }
      const c = await ausSpeicher();
      if (c) return c;
      if (err === FRIST) return netz;
      throw new Error('offline und nicht im Cache');
    }
  })());
});

// ── Web-Push: Engpass-Alarm, auch wenn ApoPulse geschlossen ist ──────────────
//  Der Server (services/webPush.js) schickt verschlüsselt; der Browser
//  entschlüsselt, hier wird nur angezeigt. Nur Meldungen mit Quelle
//  (Engpass, wieder lieferbar, Frühwarnung, Meldung aus Apotheken).
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { titel: 'ApoPulse', text: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titel || 'ApoPulse', {
    body: d.text || '', tag: d.tag || undefined, renotify: !!d.tag,
    icon: '/icon-192.png', badge: '/icon-192.png', data: { url: d.url || '/' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  // Nur Ziele der eigenen Seite öffnen.
  const ziel = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin);
  const url = ziel.origin === self.location.origin ? ziel.href : self.location.origin + '/';
  e.waitUntil((async () => {
    const fenster = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const f of fenster) { if ('focus' in f) { await f.focus(); if ('navigate' in f) return f.navigate(url); return; } }
    return self.clients.openWindow(url);
  })());
});
