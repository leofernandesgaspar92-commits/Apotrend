// Integrationstest: bootet den echten HTTP-Server und prüft die am HTTP-Layer
// komponierten Endpunkte (die sonst nur im Browser verifiziert wurden).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const PORT = 4200 + Math.floor(Math.random() * 300);
process.env.PORT = String(PORT);
process.env.APOTREND_ADMIN_EMAIL = 'red@apotrend.test';
process.env.APOTREND_ADMIN_PASSWORD = 'redredred123';
delete process.env.APOTREND_DATA_FILE; // In-Memory
const BASE = `http://localhost:${PORT}`;
const H = (t) => ({ 'content-type': 'application/json', ...(t ? { authorization: 'Bearer ' + t } : {}) });

let httpServer;
before(async () => {
  ({ httpServer } = await import('../src/http/server.js'));
  for (let i = 0; i < 30; i++) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) return; } catch { /* noch nicht bereit */ }
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error('Server nicht rechtzeitig gestartet');
});
after(() => new Promise(res => httpServer.close(res)));

async function reg(handle) {
  const r = await fetch(BASE + '/api/register', { method: 'POST', headers: H(), body: JSON.stringify({ name: handle, handle, email: handle + '@a.at', password: 'geheim123' }) });
  return (await r.json()).token;
}
const j = async (path, tok) => (await fetch(BASE + path, { headers: H(tok) })).json();
const post = (path, tok, body) => fetch(BASE + path, { method: 'POST', headers: H(tok), body: JSON.stringify(body || {}) });

test('GET /api/wirkstoff/:name bündelt Engpass/Preise/Rabatte/Austausch', async () => {
  const a = await reg('wi_a' + PORT);
  const b = await reg('wi_b' + PORT);
  await post('/api/exchange', b, { kind: 'biete', bezeichnung: 'Amoxicillin 1000 mg Filmtabletten' });
  const d = await j('/api/wirkstoff/' + encodeURIComponent('Amoxicillin'), a);
  assert.equal(d.wirkstoff, 'Amoxicillin');
  assert.ok(d.shortages.length >= 1, 'Engpass-Seed vorhanden');
  assert.ok(d.prices.length >= 1, 'Preis-Seed vorhanden');
  assert.ok(d.exchange.biete.length >= 1, 'Biete-Eintrag gefunden');
  assert.equal(typeof d.watched, 'boolean');
  // Diskussion: ein öffentlicher Beitrag, der den Wirkstoff erwähnt, taucht auf.
  await post('/api/posts', a, { body: 'Bei uns Engpass bei Amoxicillin — wer hat Bestand?', visibility: 'public' });
  const d2 = await j('/api/wirkstoff/' + encodeURIComponent('Amoxicillin'), a);
  assert.ok(Array.isArray(d2.posts), 'posts-Feld vorhanden');
  assert.ok(d2.posts.some(p => /Amoxicillin/i.test(p.body)), 'erwähnender Beitrag in Diskussion');
});

test('GET /api/me/activity liefert eigene Fragen, Meldungen, Austausch', async () => {
  const a = await reg('ac_a' + PORT);
  const q = await (await post('/api/posts', a, { body: 'Testfrage?', kind: 'frage', visibility: 'public' })).json();
  await post('/api/shortages/report', a, { wirkstoff: 'Ramipril' + PORT, bezeichnung: 'Ramipril 5mg' });
  await post('/api/exchange', a, { kind: 'suche', bezeichnung: 'Ibuprofen 400mg' });
  const d = await j('/api/me/activity', a);
  assert.ok(d.questions.some(x => x.id === q.id), 'eigene Frage enthalten');
  assert.ok(d.reports.some(r => r.wirkstoff === 'Ramipril' + PORT), 'eigene Meldung enthalten');
  assert.ok(d.exchange.length >= 1, 'eigener Austausch-Eintrag enthalten');
  // Beitrag-Statistik spiegelt die eigenen Aktivitäten wider.
  assert.ok(d.stats, 'stats-Feld vorhanden');
  assert.ok(d.stats.questions >= 1, 'mindestens eine Frage in der Statistik');
  assert.ok(d.stats.questions_open >= 1, 'offene Frage gezählt');
  assert.ok(d.stats.reports >= 1, 'Meldung in der Statistik');
  assert.ok(d.stats.exchange >= 1, 'Austausch-Eintrag in der Statistik');
  assert.equal(typeof d.stats.best_answers, 'number', 'best_answers ist eine Zahl');
});

test('GET /api/feed/public?filter=questions liefert nur Fragen', async () => {
  const a = await reg('fq_a' + PORT);
  await post('/api/posts', a, { body: 'Normaler Beitrag ' + PORT, visibility: 'public' });
  await post('/api/posts', a, { body: 'Fachfrage ' + PORT + '?', kind: 'frage', visibility: 'public' });
  const d = await j('/api/feed/public?filter=questions', a);
  assert.ok(d.posts.length >= 1);
  assert.ok(d.posts.every(p => p.is_question), 'ausschließlich Fragen');
});

test('GET /api/overview enthält watch_offers für beobachteten Wirkstoff mit Angebot', async () => {
  const a = await reg('ov_a' + PORT);
  const b = await reg('ov_b' + PORT);
  await post('/api/watchlist', a, { wirkstoff: 'Pantoprazol' });
  await post('/api/exchange', b, { kind: 'biete', bezeichnung: 'Pantoprazol 40 mg' });
  const o = await j('/api/overview', a);
  assert.ok(o.watch_offers.some(w => w.wirkstoff === 'Pantoprazol' && w.offers_count >= 1), 'Bezugsquelle im Overview');
});

test('GET /api/profiles/:handle/followers|following listet Profile', async () => {
  const a = await reg('fl_a' + PORT);
  const b = await reg('fl_b' + PORT);
  const bProfile = await j('/api/me', b);
  const bHandle = bProfile.profile.handle;
  const aHandle = (await j('/api/me', a)).profile.handle;
  await post('/api/follow', a, { handle: bHandle }); // a folgt b
  const followers = await j('/api/profiles/' + encodeURIComponent(bHandle) + '/followers', b);
  assert.ok(followers.people.some(p => p.handle === aHandle), 'a ist Follower von b');
  const following = await j('/api/profiles/' + encodeURIComponent(aHandle) + '/following', a);
  assert.ok(following.people.some(p => p.handle === bHandle), 'a folgt b');
});

test('GET /api/colleagues/nearby findet Apotheken im selben Bundesland', async () => {
  const a = await reg('nb_a' + PORT);
  const b = await reg('nb_b' + PORT);
  const c = await reg('nb_c' + PORT);
  await post('/api/profile', a, { bundesland: 'Tirol' });
  await post('/api/profile', b, { bundesland: 'Tirol' });
  await post('/api/profile', c, { bundesland: 'Wien' });
  const aHandleB = (await j('/api/me', b)).profile.handle;
  const aHandleC = (await j('/api/me', c)).profile.handle;
  const nearby = await j('/api/colleagues/nearby', a);
  assert.equal(nearby.bundesland, 'Tirol');
  assert.ok(nearby.people.some(p => p.handle === aHandleB), 'b (Tirol) gefunden');
  assert.ok(!nearby.people.some(p => p.handle === aHandleC), 'c (Wien) NICHT gefunden');
});

test('GET /api/colleagues/nearby leer ohne eigenes Bundesland', async () => {
  const a = await reg('nx_a' + PORT);
  const nearby = await j('/api/colleagues/nearby', a);
  assert.equal(nearby.bundesland, null);
  assert.deepEqual(nearby.people, []);
});

test('GET /api/trending/hashtags zählt Hashtags aus sichtbaren Beiträgen', async () => {
  const a = await reg('th_a' + PORT);
  await post('/api/posts', a, { body: 'Engpass bei #Amoxicillin und #Antibiotika ' + PORT, visibility: 'public' });
  await post('/api/posts', a, { body: 'Noch was zu #Amoxicillin ' + PORT, visibility: 'public' });
  const d = await j('/api/trending/hashtags', a);
  const amox = d.hashtags.find(h => h.tag.toLowerCase() === 'amoxicillin');
  assert.ok(amox && amox.count >= 2, 'Amoxicillin mindestens 2x');
});

test('Unbekannte Route -> 404', async () => {
  const r = await fetch(BASE + '/api/gibtsnicht');
  assert.equal(r.status, 404);
});
