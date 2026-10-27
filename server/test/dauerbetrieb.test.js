// Dauerbetrieb (Start-Tag): ständig kommt etwas Neues.
// - Die Datei wird trotzdem geschrieben (vorher schob jede Änderung das Speichern hinaus →
//   bei Betrieb ohne Pause NIE gespeichert; ein Absturz hätte alles gelöscht).
// - Der Feed kommt seitenweise (vorher alle Beiträge eines Landes auf einmal).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'http', 'server.js');

function starte(env) {
  const kind = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'dauerbetrieb-test-1', APOPULSE_PRESSE: 'aus', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  const port = new Promise((ok, fail) => {
    const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
    const lies = (d) => { log += d; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
    kind.stdout.on('data', lies); kind.stderr.on('data', lies);
    kind.on('exit', (c) => { clearTimeout(zeit); fail(new Error(`Server beendet (${c}):\n${log}`)); });
  });
  const ende = (sig = 'SIGTERM') => new Promise((ok) => { if (kind.exitCode !== null || kind.signalCode) return ok(); kind.once('exit', ok); kind.kill(sig); });
  return { port, ende };
}
const H = (t) => ({ 'content-type': 'application/json', ...(t ? { authorization: 'Bearer ' + t } : {}) });

test('Speichern im Dauerbetrieb: Datei folgt den Änderungen, Absturz kostet höchstens den letzten Augenblick', { timeout: 60000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'apo-dauer-'));
  const DATEI = join(dir, 'daten.json');
  let srv;
  try {
    srv = starte({ APOPULSE_DATA_FILE: DATEI });
    let B = `http://localhost:${await srv.port}`;
    const tok = (await (await fetch(B + '/api/register', { method: 'POST', headers: H(), body: JSON.stringify({ name: 'Ada Obi', email: 'ada@dauer.test', password: 'Passwort123!', country: 'NG' }) })).json()).token;
    // Alle 150 ms ein Beitrag, nie eine Pause von 400 ms.
    let n = 0;
    const start = Date.now();
    while (Date.now() - start < 2500) {
      assert.equal((await fetch(B + '/api/posts', { method: 'POST', headers: H(tok), body: JSON.stringify({ body: 'Lage ' + n++ }) })).status, 200);
      await new Promise((r) => setTimeout(r, 150));
    }
    const inDatei = (readFileSync(DATEI, 'utf8').match(/Lage \d+/g) || []).length;
    assert.ok(inDatei >= n - 4, `Datei hinkt hinterher: ${inDatei} von ${n} Beiträgen gespeichert`);
    // Absturz (kein sauberes Herunterfahren) und Neustart mit derselben Datei.
    await srv.ende('SIGKILL');
    srv = starte({ APOPULSE_DATA_FILE: DATEI });
    B = `http://localhost:${await srv.port}`;
    const login = await (await fetch(B + '/api/login', { method: 'POST', headers: H(), body: JSON.stringify({ email: 'ada@dauer.test', password: 'Passwort123!' }) })).json();
    assert.ok(login.token, 'Konto nach dem Absturz weg');
    const home = await (await fetch(B + '/api/feed/home?limit=100', { headers: H(login.token) })).json();
    assert.ok(home.posts.length >= n - 4, `nach dem Absturz nur ${home.posts.length} von ${n} Beiträgen`);
  } finally {
    if (srv) await srv.ende('SIGKILL');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Feed seitenweise: 30 je Abruf, ohne Doppelte, neueste zuerst; Obergrenze 100', { timeout: 60000 }, async () => {
  const srv = starte({ APOPULSE_DATA_FILE: '' });
  const B = `http://localhost:${await srv.port}`;
  try {
    const tok = (await (await fetch(B + '/api/register', { method: 'POST', headers: H(), body: JSON.stringify({ name: 'Kofi', email: 'kofi@seite.test', password: 'Passwort123!', country: 'GH' }) })).json()).token;
    // 2 ms Abstand: gleicher Zeitstempel hieße „neueste zuerst" ist nicht eindeutig.
    for (let i = 0; i < 75; i++) { await fetch(B + '/api/posts', { method: 'POST', headers: H(tok), body: JSON.stringify({ body: 'Beitrag ' + i }) }); await new Promise((r) => setTimeout(r, 2)); }
    const holen = async (pfad) => (await fetch(B + pfad, { headers: H(tok) })).json();
    for (const basis of ['/api/feed/public?sort=neu&filter=all&country=GH', '/api/feed/home']) {
      const trenner = basis.includes('?') ? '&' : '?';
      const s1 = await holen(basis);
      assert.equal(s1.posts.length, 30, basis);
      assert.equal(s1.mehr, true); assert.equal(s1.weiter, 30);
      assert.equal(s1.posts[0].body, 'Beitrag 74', 'neueste zuerst');
      const s2 = await holen(basis + trenner + 'ab=' + s1.weiter);
      const s3 = await holen(basis + trenner + 'ab=' + s2.weiter);
      assert.equal(s3.posts.length, 15); assert.equal(s3.mehr, false);
      const alle = [...s1.posts, ...s2.posts, ...s3.posts].map((p) => p.body);
      assert.equal(new Set(alle).size, 75, basis + ': Beiträge doppelt oder fehlend');
      assert.equal((await holen(basis + trenner + 'limit=500')).posts.length, 75);
      assert.equal((await holen(basis + trenner + 'limit=10&ab=-5')).posts[0].body, 'Beitrag 74', 'unsinniges ab');
    }
    for (let i = 75; i < 130; i++) await fetch(B + '/api/posts', { method: 'POST', headers: H(tok), body: JSON.stringify({ body: 'Beitrag ' + i }) });
    assert.equal((await holen('/api/feed/home?limit=500')).posts.length, 100, 'Obergrenze je Abruf');
  } finally { await srv.ende(); }
});

test('Oberfläche: Knopf „Ältere Beiträge laden" in allen Sprachen, lädt die nächste Seite nach', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const f = app.slice(app.indexOf('async function loadFeed('), app.indexOf('async function renderSuggestions('));
  assert.match(f, /if \(d\.mehr\) feed\.appendChild\(mehrKnopf\(d\.weiter\)\)/);
  assert.match(f, /url \+ \(url\.includes\('\?'\) \? '&' : '\?'\) \+ 'ab=' \+ weiter/);
  assert.match(f, /if \(!gezeigt\.has\(p\.id\)\)/, 'Doppelte beim Nachladen');
  const i18n = readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8');
  assert.equal((i18n.match(/fe_mehr:/g) || []).length, 5);
});
