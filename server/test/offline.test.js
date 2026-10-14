// Offline lesbar (public/sw.js) — und was dabei NICHT passieren darf:
//  - Der Browser darf API-Antworten nicht selbst zwischenspeichern
//    (Cache-Control: no-store). Sonst läge der Stand eines Kontos nach dem
//    Abmelden noch im HTTP-Cache eines geteilten Apotheken-Rechners.
//  - Der Service Worker speichert nur ausgewählte Lese-Ansichten, je Konto
//    getrennt (Hash des Tokens, nie das Token selbst) — keine Nachrichten,
//    Rechnungen oder Schnittstellen-Schlüssel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = join(ROOT, 'src', 'http', 'server.js');

test('Service Worker: nur Lese-Ansichten, Schlüssel je Konto gehasht, Speicher bei Abmelden gelöscht', () => {
  const sw = readFileSync(join(ROOT, 'public', 'sw.js'), 'utf8');
  const liste = sw.match(/const OFFLINE_LESBAR = \[([^\n]+)\];/);
  assert.ok(liste, 'OFFLINE_LESBAR nicht gefunden');
  // Die Liste wird nachgebaut und gegen Pfade geprüft, die nie gespeichert werden dürfen.
  const muster = [...liste[1].matchAll(/\/(\^[^,]+?\$)\//g)].map((m) => new RegExp(m[1].replace(/\\\//g, '/')));
  assert.ok(muster.length >= 5, 'Liste leer gelesen');
  for (const p of ['/api/shortages', '/api/news', '/api/watchlist'])
    assert.ok(muster.some((rx) => rx.test(p)), `${p} nicht offline lesbar`);
  for (const p of ['/api/dm', '/api/dm/abc', '/api/rechnungen', '/api/daten-api/schluessel', '/api/me/export', '/api/notifications', '/api/v1/engpaesse'])
    assert.ok(!muster.some((rx) => rx.test(p)), `${p} würde offline gespeichert`);
  assert.match(sw, /crypto\.subtle\.digest\('SHA-256'/, 'Schlüssel nicht gehasht');
  assert.match(sw, /searchParams\.set\('__konto', h\)/);
  const app = readFileSync(join(ROOT, 'public', 'app.js'), 'utf8');
  assert.match(app, /btnLogout'\)\.onclick = async \(\) => \{[^}]*await offlineSpeicherLeeren\(\)/, 'Abmelden löscht den Speicher nicht');
  assert.match(app, /caches\.delete\('apopulse-api-v1'\)/);
});

test('API-Antworten: Cache-Control no-store', { timeout: 60000 }, async () => {
  const env = { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'offline-test', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus' };
  const kind = spawn(process.execPath, [SERVER], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  try {
    const port = await new Promise((ok, fail) => {
      const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
      const lies = (x) => { log += x; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
      kind.stdout.on('data', lies); kind.stderr.on('data', lies);
      kind.on('exit', (c) => { clearTimeout(zeit); fail(new Error(`Server beendet (${c}):\n${log}`)); });
    });
    const B = `http://localhost:${port}`;
    const reg = await (await fetch(B + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Lusaka', email: 'zm@off.test', password: 'Passwort123!', country: 'ZM', accountType: 'pharmacy' }) })).json();
    for (const pfad of ['/api/me', '/api/shortages', '/api/news']) {
      const r = await fetch(B + pfad, { headers: { authorization: 'Bearer ' + reg.token } });
      assert.equal(r.status, 200, pfad);
      assert.equal(r.headers.get('cache-control'), 'no-store', pfad);
    }
    // Auch Fehlerantworten (gehen über dieselbe Ausgabe).
    assert.equal((await fetch(B + '/api/me')).headers.get('cache-control'), 'no-store');
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});
