// Eine kaputte Anfrage darf nie den ganzen Server beenden.
// Bis 10/2026: `new URL(req.url, 'http://' + Host)` stand außerhalb jedes try — EINE Anfrage mit
// Host „a b" beendete den Prozess (auf Render: Neustart, ohne Datenbank alle Konten weg).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'http', 'server.js');

const roh = (port, anfrage) => new Promise((ok) => {
  const s = net.connect(port, '127.0.0.1', () => s.write(anfrage));
  let a = ''; s.on('data', (d) => { a += d; });
  s.on('close', () => ok(a.split('\r\n')[0])); s.on('error', () => ok(''));
  setTimeout(() => { s.destroy(); ok(a.split('\r\n')[0]); }, 3000);
});

test('Kaputte Host-Angaben und Adressen: Server antwortet und läuft weiter', { timeout: 60000 }, async () => {
  const kind = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'absturz-test-1', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus',
      APOPULSE_ADMIN_EMAIL: 'red@absturz.test', APOPULSE_ADMIN_PASSWORD: 'absturz-PW-123' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = ''; let beendet = null;
  try {
    const port = await new Promise((ok, fail) => {
      const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
      const lies = (d) => { log += d; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
      kind.stdout.on('data', lies); kind.stderr.on('data', lies);
      kind.on('exit', (c) => { beendet = c; clearTimeout(zeit); fail(new Error(`Server beendet (${c}):\n${log}`)); });
    });
    for (const host of ['a b', '[', 'x:99999', '']) {
      const z = await roh(port, `GET / HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`);
      assert.match(z, /^HTTP\/1\.1 (200|400)/, `Host ${JSON.stringify(host)}: ${z}`);
    }
    await roh(port, 'GET http://[ HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n');
    await roh(port, 'GET /api/health HTTP/1.1\r\nHost: a b\r\nConnection: close\r\n\r\n');
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(beendet, null, 'Server beendet:\n' + log);
    assert.equal((await fetch(`http://localhost:${port}/api/health`)).status, 200);
    // Betriebs-Cockpit zeigt abgefangene Fehler (Zähler, keine Inhalte).
    const H = { 'content-type': 'application/json' };
    const red = (await (await fetch(`http://localhost:${port}/api/login`, { method: 'POST', headers: H, body: JSON.stringify({ email: 'red@absturz.test', password: 'absturz-PW-123' }) })).json()).token;
    const b = await (await fetch(`http://localhost:${port}/api/betrieb`, { headers: { authorization: 'Bearer ' + red } })).json();
    assert.deepEqual(Object.keys(b.fehler).sort(), ['anfragen', 'hintergrund', 'zuletzt']);
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});

test('Aufbau: jede Anfrage abgefangen (500 statt Absturz), Hintergrund-Fehler beenden nichts, Programmfehler: erst sichern', () => {
  const src = readFileSync(SERVER, 'utf8');
  assert.match(src, /http\.createServer\(\(req, res\) => \{\n {2}anfrage\(req, res\)\.catch\(\(e\) => \{/);
  assert.match(src, /res\.writeHead\(500[^\n]*code: 'unbekannt'/, 'Antwort 500 mit übersetzbarem Code');
  assert.match(src, /try \{ url = new URL\(req\.url, 'http:\/\/localhost'\); \}/);
  assert.ok(!/new URL\(req\.url, `http:\/\/\$\{req\.headers\.host\}`\)/.test(src), 'Host-Angabe wieder in new URL');
  assert.match(src, /process\.on\('unhandledRejection', \(e\) => \{\n {2}betriebsFehler\.hintergrund\+\+/);
  assert.match(src, /process\.on\('uncaughtException', \(e\) => \{[\s\S]{0,120}saveNow\(\);/, 'vor dem Beenden sichern');
});
