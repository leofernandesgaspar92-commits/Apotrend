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
import { createPersistence } from '../repo/persistence.js';
import { createOrgAuthService, ForbiddenError } from '../services/orgAuth.js';
import { createSocialService } from '../services/social.js';
import { createShortagesService } from '../services/shortages.js';
import { createPricesService } from '../services/prices.js';
import { createRabatteService } from '../services/rabatte.js';
import { createSearchService } from '../services/search.js';
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
const social = createSocialService(socialRepo, repo);
// Marktdaten nur beim Frischstart seeden; beim Wiederherstellen kommen sie aus dem Snapshot.
const shortagesRepo = createShortagesRepo({ seed: !restoring });
const shortages = createShortagesService(shortagesRepo, social);
const pricesRepo = createPricesRepo({ seed: !restoring });
const prices = createPricesService(pricesRepo, social);
const rabatteRepo = createRabatteRepo({ seed: !restoring });
const rabatte = createRabatteService(rabatteRepo, social);
const search = createSearchService({ social, shortagesRepo, pricesRepo, rabatteRepo });

if (restoring) {
  repo.__load(snapshot.foundation);
  socialRepo.__load(snapshot.social);
  shortagesRepo.__load(snapshot.shortages);
  pricesRepo.__load(snapshot.prices);
  rabatteRepo.__load(snapshot.rabatte);
  console.log(`ApoTrend: Daten aus ${persistence.filePath} wiederhergestellt.`);
} else {
  // Redaktions-Account + kuratierte News nur beim Frischstart anlegen (sonst Dubletten).
  const red = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'ApoTrend' }, owner: { name: 'ApoTrend-Redaktion', email: 'redaktion@apotrend.at', password: crypto.randomUUID() } });
  social.createProfile(red.user.id, { handle: 'apotrend', displayName: 'ApoTrend-Redaktion', isEditorial: true });
  [
    'Kammer-Mitteilung: Neue Regelung zur E-Medikation tritt am 01.08.2026 in Kraft.',
    'BASG: Aktualisierte Engpassliste veröffentlicht — mehrere Antibiotika betroffen.',
    'Gehaltskasse: Anpassung der Großhandelskonditionen zum Quartalswechsel.',
  ].forEach(body => social.createPost(red.user.id, { body, kind: 'news' }));
}

// ── Snapshot sammeln + gedrosselt/atomar auf Platte schreiben ──
function collectSnapshot() {
  return {
    foundation: repo.__dump(), social: socialRepo.__dump(),
    shortages: shortagesRepo.__dump(), prices: pricesRepo.__dump(), rabatte: rabatteRepo.__dump(),
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
  let d = ''; req.on('data', c => { d += c; if (d.length > 1e6) req.destroy(); });
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

  ['GET', /^\/api\/me$/, true, async ({ userId }) => ({ user: repo.getUserById(userId), profile: social.getProfile(userId) })],

  ['GET', /^\/api\/feed\/home$/, true, async ({ userId }) => ({ posts: enrichPosts(social.homeFeed(userId)) })],
  ['GET', /^\/api\/feed\/public$/, true, async ({ userId }) => ({ posts: enrichPosts(social.publicFeed(userId)) })],

  ['POST', /^\/api\/posts$/, true, async ({ userId, body }) => social.createPost(userId, { body: body.body, visibility: body.visibility, kind: body.kind })],
  ['GET', /^\/api\/news$/, true, async ({ userId }) => ({ posts: enrichPosts(social.newsFeed(userId)) })],
  ['GET', /^\/api\/posts\/([^/]+)\/comments$/, true, async ({ userId, params }) => ({ comments: social.listComments(userId, params[0]) })],
  ['POST', /^\/api\/posts\/([^/]+)\/comments$/, true, async ({ userId, params, body }) => social.comment(userId, params[0], { body: body.body, parentCommentId: body.parentCommentId })],
  ['POST', /^\/api\/posts\/([^/]+)\/react$/, true, async ({ userId, params, body }) => social.react(userId, 'post', params[0], body.type)],
  ['POST', /^\/api\/posts\/([^/]+)\/delete$/, true, async ({ userId, params }) => social.deletePost(userId, params[0])],

  ['GET', /^\/api\/profiles\/([^/]+)\/page$/, true, async ({ userId, params }) => {
    const d = social.profilePage(userId, params[0]);
    if (!d) { const e = new Error('Profil nicht gefunden'); e.status = 404; throw e; }
    return { ...d, posts: enrichPosts(d.posts) };
  }],
  ['GET', /^\/api\/profiles\/([^/]+)$/, true, async ({ params }) => ({ profile: social.getProfile(params[0]) })],
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

  // ── Preise (Priorität 3) ──
  ['GET', /^\/api\/prices$/, true, async ({ userId }) => ({ comparisons: prices.comparisons(userId) })],
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
      if (req.method === 'POST') saveSoon(); // Zustand nach jeder erfolgreichen Schreiboperation sichern
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
  const type = ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : 'text/plain';
  res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
  fs.createReadStream(serve).pipe(res);
});

server.listen(PORT, () => console.log(`ApoTrend Feed-Server läuft auf http://localhost:${PORT}`));
