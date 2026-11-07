// Nur die Redaktion sieht Prüflisten und Betriebsdaten — und nur sie löst Redaktions-Aktionen aus.
// Abklopfen 11/2026 (alle 84 abrufenden Funktionen als normales Konto und als Redaktion): kein Durchgriff;
// Unterschiede nur bei persönlichen Daten (eigener Feed, eigene Benachrichtigungen). Dieser Test hält das
// fest — die Krypto-Prüfliste etwa nennt Kundinnen, Beträge und Transaktions-IDs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'http', 'server.js');
const ANSICHTEN = ['/api/sourcing/anfragen/alle', '/api/extern/status', '/api/payments/pending', '/api/mod/meldungen', '/api/mod/aufgaben',
  '/api/reports', '/api/verify/requests', '/api/betrieb', '/api/startklar', '/api/werbung/pruefung'];
const AKTIONEN = [['/api/live/run/shortages'], ['/api/b2b/lauf'], ['/api/quellen/probe', { url: 'https://example.com/x.json', format: 'json', land: 'KE' }],
  ['/api/quellen', { url: 'https://example.com/x.json', format: 'json', land: 'KE', label: 'X' }], ['/api/mod/zugang-link', { email: 'n@rz.test' }]];

test('Redaktions-Ansichten und -Aktionen: normal 403, ohne Anmeldung 401, Redaktion 200', { timeout: 90000 }, async () => {
  const kind = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'redaktion-zugriff-1', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus', APOPULSE_EXTERN_AUS: '1',
      APOPULSE_ADMIN_EMAIL: 'red@rz.test', APOPULSE_ADMIN_PASSWORD: 'redaktion-zugriff-PW-1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  try {
    const port = await new Promise((ok, fail) => {
      const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
      const lies = (d) => { log += d; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
      kind.stdout.on('data', lies); kind.stderr.on('data', lies);
      kind.on('exit', (c) => { clearTimeout(zeit); fail(new Error(`Server beendet (${c}):\n${log}`)); });
    });
    const B = `http://localhost:${port}`;
    const req = async (m, p, tok, body) => (await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: m === 'GET' ? undefined : JSON.stringify(body || {}) })).status;
    const post = async (p, b) => (await (await fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })).json());
    const normal = (await post('/api/register', { name: 'Normal', email: 'n@rz.test', password: 'Passwort123!', country: 'KE', accountType: 'wholesale' })).token;
    const red = (await post('/api/login', { email: 'red@rz.test', password: 'redaktion-zugriff-PW-1' })).token;
    assert.ok(normal && red);
    const falsch = [];
    for (const p of ANSICHTEN) {
      const [n, a, r] = [await req('GET', p, normal), await req('GET', p, ''), await req('GET', p, red)];
      if (n !== 403 || a !== 401 || r !== 200) falsch.push(`GET ${p}: normal ${n}, ohne ${a}, Redaktion ${r}`);
    }
    for (const [p, body] of AKTIONEN) {
      const [n, a] = [await req('POST', p, normal, body), await req('POST', p, '', body)];
      if (n !== 403 || a !== 401) falsch.push(`POST ${p}: normal ${n}, ohne ${a}`);
    }
    assert.deepEqual(falsch, []);
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});
