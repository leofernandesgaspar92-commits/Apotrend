// Dünne HTTP-API + statisches Frontend für den Social-Feed (Priorität 1).
// Node-Built-ins only. Baut auf der getesteten Domänen-/Service-Schicht auf.
// In-Memory-Persistenz (Neustart = leer) — Postgres kommt hinter denselben
// Repository-Seam (Phase 6).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMemoryRepo } from '../repo/memoryRepo.js';
import { createSocialRepo } from '../repo/socialRepo.js';
import { createOrgAuthService, ForbiddenError } from '../services/orgAuth.js';
import { createSocialService } from '../services/social.js';
import { issueToken, verifyToken } from './token.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
const PORT = process.env.PORT || 4000;

// ── Dienste (einmalig, In-Memory) ──
const repo = createMemoryRepo();
const orgAuth = createOrgAuthService(repo);
const socialRepo = createSocialRepo();
const social = createSocialService(socialRepo, repo);

// ── kleine Helfer ──
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
const readBody = (req) => new Promise((resolve) => {
  let d = ''; req.on('data', c => { d += c; if (d.length > 1e6) req.destroy(); });
  req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch { resolve({}); } });
});
const userIdFrom = (req) => verifyToken((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));

// Route-Tabelle: [method, regex, authRequired, handler(ctx)]
const routes = [
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

  ['GET', /^\/api\/feed\/home$/, true, async ({ userId }) => ({ posts: social.homeFeed(userId) })],
  ['GET', /^\/api\/feed\/public$/, true, async ({ userId }) => ({ posts: social.publicFeed(userId) })],

  ['POST', /^\/api\/posts$/, true, async ({ userId, body }) => social.createPost(userId, { body: body.body, visibility: body.visibility })],
  ['GET', /^\/api\/posts\/([^/]+)\/comments$/, true, async ({ userId, params }) => ({ comments: social.listComments(userId, params[0]) })],
  ['POST', /^\/api\/posts\/([^/]+)\/comments$/, true, async ({ userId, params, body }) => social.comment(userId, params[0], { body: body.body, parentCommentId: body.parentCommentId })],
  ['POST', /^\/api\/posts\/([^/]+)\/react$/, true, async ({ userId, params, body }) => social.react(userId, 'post', params[0], body.type)],
  ['POST', /^\/api\/posts\/([^/]+)\/delete$/, true, async ({ userId, params }) => social.deletePost(userId, params[0])],

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
