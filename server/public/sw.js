// Minimaler Service Worker — macht ApoTrend "installierbar" (Icon auf
// Startbildschirm/Desktop, Vollbild wie eine App), OHNE aggressives Caching.
// Bewusst netzwerk-durchreichend: so sind Updates sofort da, kein veralteter
// Stand. (Offline-Betrieb kommt ggf. später mit einer Cache-Strategie.)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
// Fetch-Handler ist nötig, damit der Browser die App als installierbar erkennt.
// Wir rufen respondWith NICHT auf -> Standard-Netzwerkverhalten bleibt.
self.addEventListener('fetch', () => {});
