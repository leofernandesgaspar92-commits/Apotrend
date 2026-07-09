// Dünne HTTP-API + statisches Frontend für den Social-Feed (Priorität 1).
// Node-Built-ins only. Baut auf der getesteten Domänen-/Service-Schicht auf.
// In-Memory-Persistenz (Neustart = leer) — Postgres kommt hinter denselben
// Repository-Seam (Phase 6).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createMemoryRepo } from '../repo/memoryRepo.js';
import { createSocialRepo } from '../repo/socialRepo.js';
import { createShortagesRepo } from '../repo/shortagesRepo.js';
import { createPricesRepo } from '../repo/pricesRepo.js';
import { createRabatteRepo } from '../repo/rabatteRepo.js';
import { createExchangeRepo } from '../repo/exchangeRepo.js';
import { createPersistence } from '../repo/persistence.js';
import { createOrgAuthService, ForbiddenError } from '../services/orgAuth.js';
import { createSocialService } from '../services/social.js';
import { createShortagesService } from '../services/shortages.js';
import { createPricesService } from '../services/prices.js';
import { createRabatteService } from '../services/rabatte.js';
import { createExchangeService } from '../services/exchange.js';
import { createSearchService } from '../services/search.js';
import { createOverviewService } from '../services/overview.js';
import { issueToken, verifyToken } from './token.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
const PORT = process.env.PORT || 4000;

// ── Persistenz (optional, über APOTREND_DATA_FILE). Ohne die Variable: In-Memory. ──
const persistence = createPersistence(process.env.APOTREND_DATA_FILE || null);
const snapshot = persistence ? persistence.load() : null;
const restoring = !!snapshot;

// ── Dienste (einmalig) ──
const repo = createMemoryRepo();
const orgAuth = createOrgAuthService(repo);
const socialRepo = createSocialRepo();
// Moderatoren = Redaktions-/Admin-Konten (Profil-Flag is_editorial).
const social = createSocialService(socialRepo, repo, {
  isModerator: (userId) => { const p = socialRepo.getProfileByUserId(userId); return !!(p && p.is_editorial); },
});
// Marktdaten nur beim Frischstart seeden; beim Wiederherstellen kommen sie aus dem Snapshot.
const shortagesRepo = createShortagesRepo({ seed: !restoring });
const shortages = createShortagesService(shortagesRepo, social);
const pricesRepo = createPricesRepo({ seed: !restoring });
const prices = createPricesService(pricesRepo, social);
const rabatteRepo = createRabatteRepo({ seed: !restoring });
const rabatte = createRabatteService(rabatteRepo, social);
const exchangeRepo = createExchangeRepo();
const exchange = createExchangeService(exchangeRepo, social, repo, shortagesRepo);
const search = createSearchService({ social, shortagesRepo, pricesRepo, rabatteRepo, exchange });
const overview = createOverviewService({ shortages, exchange, social, rabatte, prices });

if (restoring) {
  repo.__load(snapshot.foundation);
  socialRepo.__load(snapshot.social);
  shortagesRepo.__load(snapshot.shortages);
  pricesRepo.__load(snapshot.prices);
  rabatteRepo.__load(snapshot.rabatte);
  exchangeRepo.__load(snapshot.exchange);
  console.log(`ApoTrend: Daten aus ${persistence.filePath} wiederhergestellt.`);
} else {
  // Redaktions-/Admin-Account (zugleich Moderation) + kuratierte News — nur beim
  // Frischstart. Zugangsdaten über ENV steuerbar; sonst zufälliges Passwort, das
  // beim Start einmalig geloggt wird, damit sich die Redaktion anmelden kann.
  const adminEmail = process.env.APOTREND_ADMIN_EMAIL || 'redaktion@apotrend.at';
  const adminPassword = process.env.APOTREND_ADMIN_PASSWORD || crypto.randomUUID();
  const red = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'ApoTrend' }, owner: { name: 'ApoTrend-Redaktion', email: adminEmail, password: adminPassword } });
  social.createProfile(red.user.id, { handle: 'apotrend', displayName: 'ApoTrend-Redaktion', isEditorial: true });
  if (!process.env.APOTREND_ADMIN_PASSWORD) console.log(`ℹ️  Redaktions-/Moderations-Login: ${adminEmail} / ${adminPassword}`);
  [
    { body: 'Kammer-Mitteilung: Neue Regelung zur E-Medikation tritt am 01.08.2026 in Kraft.', sourceUrl: 'https://www.apothekerkammer.at/' },
    { body: 'BASG: Aktualisierte Engpassliste veröffentlicht — mehrere Antibiotika betroffen.', sourceUrl: 'https://www.basg.gv.at/' },
    { body: 'Gehaltskasse: Anpassung der Großhandelskonditionen zum Quartalswechsel.', sourceUrl: 'https://www.gehaltskasse.at/' },
  ].forEach(({ body, sourceUrl }) => social.createPost(red.user.id, { body, kind: 'news', sourceUrl }));
}

// ── Snapshot sammeln + gedrosselt/atomar auf Platte schreiben ──
function collectSnapshot() {
  return {
    foundation: repo.__dump(), social: socialRepo.__dump(),
    shortages: shortagesRepo.__dump(), prices: pricesRepo.__dump(), rabatte: rabatteRepo.__dump(),
    exchange: exchangeRepo.__dump(),
  };
}
let saveTimer = null;
function saveSoon() {
  if (!persistence) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { persistence.save(collectSnapshot()); } catch (e) { console.error('Speichern fehlgeschlagen:', e.message); } }, 400);
}
function saveNow() { if (persistence) { try { persistence.save(collectSnapshot()); } catch { /* egal */ } } }
if (persistence && !restoring) saveNow(); // Ausgangszustand (Seed) sofort sichern
// Sauber speichern beim Herunterfahren (z.B. Deploy/Neustart auf dem Host).
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { saveNow(); process.exit(0); });

// Feed-Beiträge, die ein Marktobjekt (Engpass/Preis) referenzieren, anreichern.
function enrichPosts(posts) {
  return posts.map(p => {
    if (p.ref_type === 'shortage' && p.ref_id) {
      const s = shortagesRepo.get(p.ref_id);
      if (s) return { ...p, ref_summary: { kind: 'shortage', wirkstoff: s.wirkstoff, bezeichnung: s.bezeichnung, status: s.status } };
    }
    if (p.ref_type === 'price' && p.ref_id) {
      const pr = pricesRepo.get(p.ref_id);
      if (pr) return { ...p, ref_summary: { kind: 'price', bezeichnung: pr.bezeichnung, supplier: pr.supplier, aep: pr.aep, currency: pr.currency, trend_pct: pr.trend_pct } };
    }
    if (p.ref_type === 'rabatt' && p.ref_id) {
      const r = rabatteRepo.get(p.ref_id);
      if (r) return { ...p, ref_summary: { kind: 'rabatt', bezeichnung: r.bezeichnung, supplier: r.supplier, aktionspreis: r.aktionspreis, listenpreis: r.listenpreis, currency: r.currency, rabatt_pct: r.rabatt_pct, gueltig_bis: r.gueltig_bis } };
    }
    return p;
  });
}

// ── kleine Helfer ──
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
const readBody = (req) => new Promise((resolve) => {
  let d = ''; req.on('data', c => { d += c; if (d.length > 2e6) req.destroy(); }); // 2 MB (Bilder als data-URL)
  req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch { resolve({}); } });
});
const userIdFrom = (req) => verifyToken((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));

// Route-Tabelle: [method, regex, authRequired, handler(ctx)]
const routes = [
  // Health-Check für Hosting-Plattformen (kein Auth, keine Daten).
  ['GET', /^\/api\/health$/, false, async () => ({ ok: true, service: 'apotrend', ts: new Date().toISOString() })],

  ['POST', /^\/api\/register$/, false, async ({ body }) => {
    const { name, email, password, handle, displayName, pharmacyName } = body;
    const reg = orgAuth.registerPharmacyWithOwner({
      pharmacy: { name: pharmacyName || `${name || 'Meine'} Apotheke` },
      owner: { name, email, password },
    });
    const profile = social.createProfile(reg.user.id, { handle, displayName: displayName || name, pharmacyOrgId: reg.organization.id });
    return { token: issueToken(reg.user.id), user: reg.user, profile };
  }],

  ['POST', /^\/api\/login$/, false, async ({ body }) => {
    const r = orgAuth.login({ email: body.email, password: body.password });
    if (!r.ok) { const e = new Error(r.error); e.status = 401; throw e; }
    return { token: issueToken(r.user.id), user: r.user, profile: social.getProfile(r.user.id) };
  }],

  ['GET', /^\/api\/me$/, true, async ({ userId }) => ({ user: repo.getUserById(userId), profile: social.getProfile(userId), is_moderator: social.isModerator(userId) })],
  ['GET', /^\/api\/overview$/, true, async ({ userId }) => overview.forUser(userId)],
  // Meine Aktivität an einem Ort: eigene Fragen, Engpass-Meldungen, Austausch-Einträge.
  ['GET', /^\/api\/me\/activity$/, true, async ({ userId }) => {
    const page = social.profilePage(userId, userId);
    const posts = (page && page.posts) || [];
    return {
      questions: posts.filter(p => p.is_question),
      reports: shortages.listWithCounts(userId).filter(s => s.is_reporter),
      exchange: exchange.mine(userId),
    };
  }],
  // Wirkstoff-Detailseite: alles zu einem Wirkstoff gebündelt (Engpass, Austausch,
  // Preise, Aktionen) — komponiert aus bereits getesteten Diensten.
  ['GET', /^\/api\/wirkstoff\/([^/]+)$/, true, async ({ userId, params }) => {
    const name = decodeURIComponent(params[0]).trim();
    const low = name.toLowerCase();
    const eq = (v) => String(v || '').trim().toLowerCase() === low;
    const ex = exchange.list(userId, { q: name });
    return {
      wirkstoff: name,
      watched: shortagesRepo.isWatched(userId, name),
      shortages: shortages.listWithCounts(userId).filter(s => eq(s.wirkstoff)),
      prices: prices.comparisons(userId).filter(g => eq(g.wirkstoff)),
      rabatte: rabatte.top10(userId).filter(r => eq(r.wirkstoff)),
      exchange: { biete: ex.filter(e => e.kind === 'biete'), suche: ex.filter(e => e.kind === 'suche') },
      posts: enrichPosts(social.searchPosts(userId, name).slice(0, 10)),
    };
  }],
  ['GET', /^\/api\/profiles\/([^/]+)\/(followers|following)$/, true, async ({ userId, params }) => {
    const d = social.followList(userId, decodeURIComponent(params[0]), params[1]);
    if (!d) { const e = new Error('Profil nicht gefunden'); e.status = 404; throw e; }
    return d;
  }],
  ['GET', /^\/api\/suggestions\/follow$/, true, async ({ userId }) => ({ suggestions: social.suggestFollows(userId) })],
  ['GET', /^\/api\/handles$/, true, async ({ query }) => ({ handles: social.searchHandles(query.get('q') || '') })],
  ['GET', /^\/api\/me\/export$/, true, async ({ userId }) => ({ ...social.exportData(userId), exchange_entries: exchange.mine(userId) })],
  ['POST', /^\/api\/me\/password$/, true, async ({ userId, body }) => orgAuth.changePassword(userId, { oldPassword: body.oldPassword, newPassword: body.newPassword })],
  ['POST', /^\/api\/me\/delete$/, true, async ({ userId, body }) => {
    if (!orgAuth.verifyUserPassword(userId, body.password)) { const e = new Error('Passwort ist falsch.'); e.status = 401; throw e; }
    socialRepo.purgeUser(userId);
    exchangeRepo.purgeUser(userId);
    shortagesRepo.purgeUser(userId);
    repo.deleteUser(userId);
    return { ok: true };
  }],

  // ── Moderation (nur Redaktions-/Admin-Konten) ──
  ['GET', /^\/api\/reports$/, true, async ({ userId }) => ({ reports: social.moderationQueue(userId) })],
  ['POST', /^\/api\/reports\/([^/]+)\/resolve$/, true, async ({ userId, params, body }) => social.resolveReport(userId, params[0], { remove: !!body.remove })],

  // ── Verifizierung (Apotheken-Nachweis) ──
  ['GET', /^\/api\/verify\/me$/, true, async ({ userId }) => social.myVerification(userId)],
  ['POST', /^\/api\/verify\/request$/, true, async ({ userId, body }) => social.requestVerification(userId, { note: body.note })],
  ['GET', /^\/api\/verify\/requests$/, true, async ({ userId }) => ({ requests: social.verificationQueue(userId) })],
  ['POST', /^\/api\/verify\/([^/]+)\/resolve$/, true, async ({ userId, params, body }) => social.resolveVerification(userId, params[0], !!body.approve)],

  ['GET', /^\/api\/feed\/home$/, true, async ({ userId }) => ({ posts: enrichPosts(social.homeFeed(userId)) })],
  ['GET', /^\/api\/feed\/public$/, true, async ({ userId, query }) => ({ posts: enrichPosts(social.publicFeed(userId, { sort: query.get('sort') || 'neu', filter: query.get('filter') || 'all' })) })],

  ['POST', /^\/api\/posts$/, true, async ({ userId, body }) => social.createPost(userId, { body: body.body, visibility: body.visibility, kind: body.kind, image: body.image, sourceUrl: body.sourceUrl })],
  ['GET', /^\/api\/news$/, true, async ({ userId }) => ({ posts: enrichPosts(social.newsFeed(userId)) })],
  ['GET', /^\/api\/hashtag\/([^/]+)$/, true, async ({ userId, params }) => ({ tag: decodeURIComponent(params[0]), posts: enrichPosts(social.postsByHashtag(userId, decodeURIComponent(params[0]))) })],
  ['GET', /^\/api\/posts\/([^/]+)$/, true, async ({ userId, params }) => {
    const p = social.getPost(userId, params[0]);
    if (!p) { const e = new Error('Beitrag nicht gefunden'); e.status = 404; throw e; }
    return { post: enrichPosts([p])[0] };
  }],
  ['GET', /^\/api\/posts\/([^/]+)\/comments$/, true, async ({ userId, params }) => ({ comments: social.listComments(userId, params[0]) })],
  ['POST', /^\/api\/posts\/([^/]+)\/comments$/, true, async ({ userId, params, body }) => social.comment(userId, params[0], { body: body.body, parentCommentId: body.parentCommentId, image: body.image })],
  ['POST', /^\/api\/comments\/([^/]+)\/edit$/, true, async ({ userId, params, body }) => social.editComment(userId, params[0], body.body)],
  ['POST', /^\/api\/comments\/([^/]+)\/delete$/, true, async ({ userId, params }) => social.deleteComment(userId, params[0])],
  ['POST', /^\/api\/comments\/([^/]+)\/react$/, true, async ({ userId, params, body }) => social.react(userId, 'comment', params[0], body.type)],
  ['POST', /^\/api\/comments\/([^/]+)\/report$/, true, async ({ userId, params, body }) => social.report(userId, 'comment', params[0], body.reason)],
  ['POST', /^\/api\/posts\/([^/]+)\/react$/, true, async ({ userId, params, body }) => social.react(userId, 'post', params[0], body.type)],
  ['POST', /^\/api\/posts\/([^/]+)\/edit$/, true, async ({ userId, params, body }) => social.editPost(userId, params[0], body.body)],
  ['POST', /^\/api\/posts\/([^/]+)\/delete$/, true, async ({ userId, params }) => social.deletePost(userId, params[0])],
  ['POST', /^\/api\/posts\/([^/]+)\/report$/, true, async ({ userId, params, body }) => social.report(userId, 'post', params[0], body.reason)],
  ['POST', /^\/api\/posts\/([^/]+)\/bookmark$/, true, async ({ userId, params }) => social.toggleBookmark(userId, params[0])],
  ['POST', /^\/api\/posts\/([^/]+)\/accept$/, true, async ({ userId, params, body }) => social.acceptAnswer(userId, params[0], body.commentId)],
  ['GET', /^\/api\/bookmarks$/, true, async ({ userId }) => ({ posts: enrichPosts(social.listBookmarks(userId)) })],
  ['GET', /^\/api\/bookmarks\/ids$/, true, async ({ userId }) => ({ ids: social.bookmarkIds(userId) })],

  ['GET', /^\/api\/profiles\/([^/]+)\/page$/, true, async ({ userId, params }) => {
    const d = social.profilePage(userId, params[0]);
    if (!d) { const e = new Error('Profil nicht gefunden'); e.status = 404; throw e; }
    return { ...d, posts: enrichPosts(d.posts) };
  }],
  ['GET', /^\/api\/profiles\/([^/]+)$/, true, async ({ params }) => ({ profile: social.getProfile(params[0]) })],
  ['POST', /^\/api\/profile$/, true, async ({ userId, body }) => ({ profile: social.updateProfile(userId, body) })],
  ['POST', /^\/api\/follow$/, true, async ({ userId, body }) => {
    const target = social.getProfile(body.handle);
    if (!target) { const e = new Error('Profil nicht gefunden'); e.status = 404; throw e; }
    return social.follow(userId, target.user_id);
  }],
  ['POST', /^\/api\/unfollow$/, true, async ({ userId, body }) => {
    const target = social.getProfile(body.handle);
    if (target) social.unfollow(userId, target.user_id);
    return { ok: true };
  }],

  ['GET', /^\/api\/notifications$/, true, async ({ userId }) => ({ notifications: social.notifications(userId), unread: social.unreadCount(userId) })],
  ['POST', /^\/api\/notifications\/read-all$/, true, async ({ userId }) => { social.markAllNotificationsRead(userId); return { ok: true }; }],
  ['POST', /^\/api\/notifications\/([^/]+)\/read$/, true, async ({ userId, params }) => { social.markNotificationRead(userId, params[0]); return { ok: true }; }],

  // ── Direktnachrichten (1:1, privat) ──
  ['GET', /^\/api\/dm$/, true, async ({ userId }) => ({ threads: social.dmInbox(userId), unread: social.dmUnreadTotal(userId) })],
  ['POST', /^\/api\/dm\/start$/, true, async ({ userId, body }) => {
    const target = social.getProfile(body.handle);
    if (!target) { const e = new Error('Profil nicht gefunden'); e.status = 404; throw e; }
    return { thread: social.startDm(userId, target.user_id) };
  }],
  ['GET', /^\/api\/dm\/([^/]+)$/, true, async ({ userId, params }) => social.dmConversation(userId, params[0])],
  ['POST', /^\/api\/dm\/([^/]+)$/, true, async ({ userId, params, body }) => social.sendDm(userId, params[0], body.body)],

  // ── Lieferengpässe (Priorität 2) ──
  ['GET', /^\/api\/shortages$/, true, async ({ userId }) => ({ shortages: shortages.listWithCounts(userId) })],
  ['GET', /^\/api\/shortages\/([^/]+)$/, true, async ({ userId, params }) => {
    const d = shortages.withActivity(userId, params[0]);
    if (!d) { const e = new Error('Engpass nicht gefunden'); e.status = 404; throw e; }
    return d;
  }],
  ['POST', /^\/api\/shortages\/([^/]+)\/post$/, true, async ({ userId, params, body }) => shortages.postAbout(userId, params[0], { body: body.body, visibility: body.visibility })],
  ['POST', /^\/api\/shortages\/([^/]+)\/status$/, true, async ({ userId, params, body }) => shortages.updateStatus(userId, params[0], { status: body.status, sourceUrl: body.sourceUrl })],
  ['POST', /^\/api\/shortages\/report$/, true, async ({ userId, body }) => shortages.reportShortage(userId, { wirkstoff: body.wirkstoff, bezeichnung: body.bezeichnung, grund: body.grund, status: body.status })],
  ['POST', /^\/api\/shortages\/([^/]+)\/confirm$/, true, async ({ userId, params }) => shortages.confirmShortage(userId, params[0])],
  ['POST', /^\/api\/shortages\/([^/]+)\/resolve$/, true, async ({ userId, params }) => shortages.resolveShortage(userId, params[0])],

  // ── Beobachtungsliste (Wirkstoffe im Blick behalten) ──
  ['GET', /^\/api\/watchlist$/, true, async ({ userId }) => ({ items: shortages.myWatchlist(userId) })],
  ['POST', /^\/api\/watchlist$/, true, async ({ userId, body }) => ({ items: shortages.watch(userId, body.wirkstoff) })],
  ['DELETE', /^\/api\/watchlist\/([^/]+)$/, true, async ({ userId, params }) => ({ items: shortages.unwatch(userId, decodeURIComponent(params[0])) })],

  // ── Preise (Priorität 3) ──
  ['GET', /^\/api\/prices$/, true, async ({ userId }) => ({ comparisons: prices.comparisons(userId), savings: prices.savingsSummary() })],
  ['GET', /^\/api\/prices\/([^/]+)$/, true, async ({ userId, params }) => {
    const d = prices.withActivity(userId, params[0]);
    if (!d) { const e = new Error('Preis nicht gefunden'); e.status = 404; throw e; }
    return d;
  }],
  ['POST', /^\/api\/prices\/([^/]+)\/post$/, true, async ({ userId, params, body }) => prices.postAbout(userId, params[0], { body: body.body, visibility: body.visibility })],

  // ── Top-10-Rabatte (Priorität 5) ──
  ['GET', /^\/api\/rabatte$/, true, async ({ userId }) => ({ rabatte: rabatte.top10(userId) })],
  ['GET', /^\/api\/rabatte\/([^/]+)$/, true, async ({ userId, params }) => {
    const d = rabatte.withActivity(userId, params[0]);
    if (!d) { const e = new Error('Rabatt-Aktion nicht gefunden'); e.status = 404; throw e; }
    return d;
  }],
  ['POST', /^\/api\/rabatte\/([^/]+)\/post$/, true, async ({ userId, params, body }) => rabatte.postAbout(userId, params[0], { body: body.body, visibility: body.visibility })],

  // ── Bestandsaustausch (Biete/Suche) ──
  ['GET', /^\/api\/exchange$/, true, async ({ userId, query }) => ({ entries: exchange.list(userId, { kind: query.get('kind') || null, status: query.get('status') || 'offen', q: query.get('q') || null, bundesland: query.get('bundesland') || null }) })],
  ['POST', /^\/api\/exchange$/, true, async ({ userId, body }) => exchange.create(userId, { kind: body.kind, bezeichnung: body.bezeichnung, menge: body.menge, ort: body.ort, bundesland: body.bundesland, note: body.note, image: body.image })],
  ['GET', /^\/api\/exchange\/mine$/, true, async ({ userId, query }) => ({ entries: exchange.mine(userId, { status: query.get('status') || null }) })],
  ['POST', /^\/api\/exchange\/([^/]+)\/resolve$/, true, async ({ userId, params }) => exchange.markResolved(userId, params[0])],
  ['POST', /^\/api\/exchange\/([^/]+)\/reopen$/, true, async ({ userId, params }) => exchange.reopen(userId, params[0])],
  ['POST', /^\/api\/exchange\/([^/]+)\/delete$/, true, async ({ userId, params }) => exchange.remove(userId, params[0])],

  // ── Übergreifende Suche (Priorität 7) ──
  ['GET', /^\/api\/search$/, true, async ({ userId, query }) => {
    const r = search.search(userId, query.get('q') || '');
    return { ...r, posts: enrichPosts(r.posts) };
  }],
];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // ── API ──
  if (pathname.startsWith('/api/')) {
    const route = routes.find(([m, rx]) => m === req.method && rx.test(pathname));
    if (!route) return json(res, 404, { error: 'Nicht gefunden' });
    const [, rx, authRequired, handler] = route;
    const userId = userIdFrom(req);
    if (authRequired && !userId) return json(res, 401, { error: 'Nicht angemeldet' });
    try {
      const body = (req.method === 'POST') ? await readBody(req) : {};
      const params = (pathname.match(rx) || []).slice(1);
      const result = await handler({ userId, body, params, query: url.searchParams });
      if (req.method !== 'GET') saveSoon(); // Zustand nach jeder erfolgreichen Schreiboperation sichern (POST/DELETE)
      return json(res, 200, result ?? { ok: true });
    } catch (e) {
      const code = e instanceof ForbiddenError ? 403 : (e.status || 400);
      return json(res, code, { error: e.message });
    }
  }

  // ── Statisches Frontend ──
  let file = pathname === '/' ? '/index.html' : pathname;
  const full = path.join(PUBLIC_DIR, path.normalize(file).replace(/^(\.\.[/\\])+/, ''));
  if (!full.startsWith(PUBLIC_DIR) || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
    file = '/index.html'; // SPA-Fallback
  }
  const serve = path.join(PUBLIC_DIR, file);
  const ext = path.extname(serve);
  const MIME = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.webmanifest': 'application/manifest+json',
    '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain',
  };
  const type = MIME[ext] || 'application/octet-stream';
  const isText = /^text\/|application\/(json|manifest\+json|javascript)/.test(type);
  res.writeHead(200, { 'Content-Type': type + (isText ? '; charset=utf-8' : '') });
  fs.createReadStream(serve).pipe(res);
});

server.listen(PORT, () => console.log(`ApoTrend Feed-Server läuft auf http://localhost:${PORT}`));

// Für Integrationstests: erlaubt server.close(), damit der Prozess sauber endet.
export { server as httpServer };
