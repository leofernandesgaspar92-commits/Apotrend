// Datenbank & Live-Stabilität (Sprint 1, 11/2026). Zwei Teile:
//  A) ohne Datenbank (läuft immer): Pflicht auf Render/Produktion, /api/health, Schreibsperre bei
//     unerreichbarer Datenbank, Supabase-Adressen.
//  B) gegen ECHTES PostgreSQL (nur mit APOPULSE_TEST_DATABASE_URL; mit APOPULSE_TEST_PG_STEUERN=1
//     wird die Datenbank auch gestoppt/gestartet): Neustart ohne Abschied (SIGKILL), Datenbank-
//     Ausfall im Betrieb, Start bei ausgefallener Datenbank — kein Konto, keine Meldung darf fehlen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { laufzeitUrl, migrationsUrl, dbZiel } from '../src/repo/dbUrl.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = join(ROOT, 'src', 'http', 'server.js');
const PG = process.env.APOPULSE_TEST_DATABASE_URL || '';
const PG_STEUERN = process.env.APOPULSE_TEST_PG_STEUERN === '1';
const H = { 'content-type': 'application/json' };
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

function starte(env, { erwarteStart = true } = {}) {
  const kind = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus', APOPULSE_TOKEN_SECRET: 'db-stabil-geheim', RENDER: '', NODE_ENV: '', DATABASE_URL: '', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  kind.stdout.on('data', (d) => { log += d; }); kind.stderr.on('data', (d) => { log += d; });
  const bereit = new Promise((ok, fail) => {
    const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 25000);
    const pruef = () => { const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(`http://localhost:${m[1]}`); } };
    kind.stdout.on('data', pruef); kind.stderr.on('data', pruef);
    kind.on('exit', (c) => { clearTimeout(zeit); if (erwarteStart) fail(new Error(`Server beendet (${c}):\n${log}`)); else ok(null); });
  });
  return { kind, bereit, log: () => log, ende: () => new Promise((ok) => { if (kind.exitCode !== null || kind.signalCode) return ok(); kind.once('exit', ok); kind.kill('SIGKILL'); }) };
}
const health = async (B) => (await fetch(B + '/api/health')).json();
async function bis(fn, ms = 30000, schritt = 300) {
  const ende = Date.now() + ms;
  for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > ende) throw new Error('Zeit abgelaufen'); await warte(schritt); }
}

// ── A) ohne Datenbank ──────────────────────────────────────────────────────

test('Render/Produktion ohne DATABASE_URL: startet nicht (klare Meldung); Notausgang APOPULSE_OHNE_DATENBANK=ja', { timeout: 60000 }, async () => {
  for (const env of [{ RENDER: 'true' }, { NODE_ENV: 'production' }]) {
    const s = starte(env, { erwarteStart: false });
    try {
      assert.equal(await s.bereit, null, 'Server startete trotz fehlender Datenbank');
      assert.equal(s.kind.exitCode, 1);
      assert.match(s.log(), /startet NICHT: DATABASE_URL fehlt/);
    } finally { await s.ende(); } // auch wenn er doch startet: nie einen Server hängen lassen
  }
  const s = starte({ RENDER: 'true', APOPULSE_OHNE_DATENBANK: 'ja' });
  try {
    const B = await s.bereit;
    assert.deepEqual((await health(B)).database, { configured: false, connected: false, restored: true });
  } finally { await s.ende(); }
});

test('/api/health: Commit und Datenbank-Status; Datenbank unerreichbar → connected:false, Schreiben gesperrt (503), Lesen geht', { timeout: 60000 }, async () => {
  const s = starte({ DATABASE_URL: 'postgresql://apo:falsch@127.0.0.1:1/nirgends', RENDER_GIT_COMMIT: 'abc1234def', RENDER_GIT_BRANCH: 'feed-first' });
  try {
    const B = await s.bereit;
    const h = await health(B);
    assert.equal(h.version.commit, 'abc1234');
    assert.equal(h.database.configured, true);
    assert.equal(h.database.connected, false);
    assert.equal(h.database.restored, false, 'ohne erreichbare Datenbank gilt nichts als wiederhergestellt');
    assert.ok(!JSON.stringify(h).includes('falsch'), 'Zugangsdaten in /api/health');
    const r = await fetch(B + '/api/register', { method: 'POST', headers: H, body: JSON.stringify({ name: 'Ama', email: 'a@db.test', password: 'Passwort-1234', country: 'GH', accountType: 'pharmacy' }) });
    assert.equal(r.status, 503);
    assert.equal(r.headers.get('retry-after'), '5');
    assert.equal((await r.json()).code, 'db_startet');
    assert.equal((await fetch(B + '/api/countries')).status, 200, 'Lesen bleibt möglich');
    assert.equal((await fetch(B + '/api/fehlerbericht', { method: 'POST', headers: H, body: JSON.stringify({ meldung: 'x' }) })).status, 200);
  } finally { await s.ende(); }
});

test('Supabase: Pooler-Adressen für Laufzeit (pgbouncer=true) und Migrationen (Sitzungsmodus); nie Zugangsdaten in Meldungen', () => {
  const tx = 'postgresql://postgres.abcd:geheim@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';
  assert.match(laufzeitUrl(tx), /:6543\/postgres\?pgbouncer=true$/);
  assert.equal(migrationsUrl(tx), 'postgresql://postgres.abcd:geheim@aws-0-eu-central-1.pooler.supabase.com:5432/postgres');
  assert.equal(migrationsUrl(tx, 'postgresql://x:y@direkt:5432/db'), 'postgresql://x:y@direkt:5432/db', 'DIRECT_URL geht vor');
  assert.equal(laufzeitUrl(tx + '?pgbouncer=true'), tx + '?pgbouncer=true', 'nicht doppelt');
  const render = 'postgresql://u:p@dpg-xyz-a/apopulse';
  assert.equal(laufzeitUrl(render), render); assert.equal(migrationsUrl(render), render);
  assert.equal(dbZiel(tx), 'aws-0-eu-central-1.pooler.supabase.com:6543');
  assert.ok(!dbZiel(tx).includes('geheim'));
  const schema = readFileSync(join(ROOT, 'prisma', 'schema.prisma'), 'utf8');
  assert.match(schema, /directUrl = env\("DIRECT_URL"\)/);
  const setup = readFileSync(join(ROOT, 'tools', 'db-setup.mjs'), 'utf8');
  assert.match(setup, /process\.env\.DIRECT_URL = migrationsUrl\(echteUrl, process\.env\.DIRECT_URL\)/);
  assert.match(setup, /process\.env\.DIRECT_URL = process\.env\.DATABASE_URL;/, 'ohne Datenbank: Platzhalter auch für DIRECT_URL (sonst scheitert generate)');
});

// ── B) gegen echtes PostgreSQL ─────────────────────────────────────────────

const pg = (aktion) => execFileSync('pg_ctlcluster', ['16', 'main', aktion], { stdio: 'ignore' });
async function leereDb() {
  execFileSync('psql', [PG, '-q', '-c', 'DELETE FROM "AppSnapshot"'], { stdio: 'ignore' });
}

test('Echtes PostgreSQL: Konto und Meldung überleben einen harten Neustart (SIGKILL, kein Abschied)', { skip: !PG && 'APOPULSE_TEST_DATABASE_URL nicht gesetzt', timeout: 120000 }, async () => {
  await leereDb();
  const a = starte({ DATABASE_URL: PG, APOPULSE_ADMIN_EMAIL: 'red@db.test', APOPULSE_ADMIN_PASSWORD: 'red-db-PW-123' });
  let token;
  try {
    const B = await a.bereit;
    await bis(async () => (await health(B)).database.restored);
    // Erst die Anfangssicherung (0,5 s nach leerer Datenbank) abwarten — sonst nähme sie Konto und
    // Meldung mit und der Test unterschiede den 5-s-Takt nicht vom alten 20-s-Takt.
    await bis(async () => (await health(B)).database.last_backup);
    await warte(1000);
    const reg = await (await fetch(B + '/api/register', { method: 'POST', headers: H, body: JSON.stringify({ name: 'Ama Mensah', email: 'ama@db.test', password: 'Passwort-1234', country: 'GH', accountType: 'pharmacy' }) })).json();
    token = reg.token; assert.ok(token, JSON.stringify(reg));
    const m = await fetch(B + '/api/shortages/report', { method: 'POST', headers: { ...H, authorization: 'Bearer ' + token }, body: JSON.stringify({ wirkstoff: 'Amoxicillin', status: 'kritisch' }) });
    assert.equal(m.status, 200, await m.text());
    const vorher = (await health(B)).database.last_backup;
    // Sicherung binnen weniger Sekunden (5-s-Takt), nicht erst nach 20 s.
    await bis(async () => { const h = await health(B); return h.database.last_backup && h.database.last_backup !== vorher; }, 12000);
  } finally { await a.ende(); } // SIGKILL: kein SIGTERM-Abschied, nur was gesichert ist, zählt
  const b = starte({ DATABASE_URL: PG });
  try {
    const B = await b.bereit;
    await bis(async () => (await health(B)).database.restored);
    const login = await (await fetch(B + '/api/login', { method: 'POST', headers: H, body: JSON.stringify({ email: 'ama@db.test', password: 'Passwort-1234' }) })).json();
    assert.ok(login.token, 'Konto nach Neustart weg: ' + JSON.stringify(login));
    const liste = await (await fetch(B + '/api/shortages?country=GH', { headers: { authorization: 'Bearer ' + login.token } })).json();
    assert.ok(JSON.stringify(liste).includes('Amoxicillin'), 'Meldung nach Neustart weg');
    assert.equal((await health(B)).database.connected, true);
  } finally { await b.ende(); }
});

test('Echtes PostgreSQL: Ausfall im Betrieb → connected:false, Sicherung wird nachgeholt; Start bei ausgefallener DB überschreibt NICHTS',
  { skip: !(PG && PG_STEUERN) && 'APOPULSE_TEST_DATABASE_URL/APOPULSE_TEST_PG_STEUERN nicht gesetzt', timeout: 240000 }, async (t) => {
  await leereDb();
  t.after(() => { try { pg('start'); } catch { /* läuft schon */ } }); // nie eine gestoppte Datenbank zurücklassen
  const a = starte({ DATABASE_URL: PG });
  try {
    const B = await a.bereit;
    await bis(async () => (await health(B)).database.restored);
    pg('stop');
    await bis(async () => (await health(B)).database.connected === false, 20000);
    // Konto während des Ausfalls: wird angenommen (Wiederherstellung war fertig) und nachgesichert.
    const reg = await (await fetch(B + '/api/register', { method: 'POST', headers: H, body: JSON.stringify({ name: 'Kofi', email: 'kofi@db.test', password: 'Passwort-1234', country: 'GH', accountType: 'pharmacy' }) })).json();
    assert.ok(reg.token);
    await warte(6000); // erster Sicherungsversuch scheitert (Datenbank weg)
    pg('start');
    await bis(async () => { const h = await health(B); return h.database.connected && h.database.last_backup; }, 60000, 1000);
    // Nachgeholt: nach dem Wiederverbinden landet der Stand mit Kofi in der Datenbank.
    await bis(async () => { const out = execFileSync('psql', [PG, '-tAc', 'SELECT "rawSize" FROM "AppSnapshot" WHERE id=\'main\'']).toString().trim(); return Number(out) > 0; }, 30000, 1000);
    await warte(1000);
  } finally { await a.ende(); }

  // Start bei ausgefallener Datenbank: Schreiben gesperrt, beim Beenden KEIN leerer Stand in die DB.
  pg('stop');
  const c = starte({ DATABASE_URL: PG });
  try {
    const B = await c.bereit;
    const r = await fetch(B + '/api/register', { method: 'POST', headers: H, body: JSON.stringify({ name: 'Leer', email: 'leer@db.test', password: 'Passwort-1234', country: 'GH', accountType: 'pharmacy' }) });
    assert.equal(r.status, 503);
    c.kind.kill('SIGTERM'); // geordnetes Beenden — darf trotzdem nichts schreiben
    await new Promise((ok) => c.kind.once('exit', ok));
  } finally { await c.ende(); }
  pg('start');
  await warte(1500);
  const d = starte({ DATABASE_URL: PG });
  try {
    const B = await d.bereit;
    await bis(async () => (await health(B)).database.restored, 60000, 1000);
    const login = await (await fetch(B + '/api/login', { method: 'POST', headers: H, body: JSON.stringify({ email: 'kofi@db.test', password: 'Passwort-1234' }) })).json();
    assert.ok(login.token, 'Konto aus dem Ausfall ist weg — Sicherung nicht nachgeholt oder überschrieben: ' + JSON.stringify(login));
  } finally { await d.ende(); }
});
