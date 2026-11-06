// Push-Abos enden mit der Sitzung.
// Fund 11/2026: Abmelden löschte nur den Anmelde-Schlüssel im Browser — das Push-Abo blieb beim Server.
// Ein geteilter Rechner am Tresen oder ein weitergegebenes Handy bekam weiter „Zahlung bestätigt",
// Präparate aus Angebotsanfragen usw. Ebenso nach Passwort-Reset und „auf allen anderen Geräten
// abmelden": Die Anmeldung des fremden Geräts war ungültig, seine Benachrichtigungen liefen weiter.
// Regel jetzt (wie bei Anmelde-Schlüsseln): Ein Abo, das älter ist als „Sitzungen beendet", gilt nicht.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWebPush } from '../src/services/webPush.js';

const HIER = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HIER, '..', 'src', 'http', 'server.js');
const APP = readFileSync(join(HIER, '..', 'public', 'app.js'), 'utf8');

const abo = (endpoint) => {
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  return { endpoint, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } };
};

test('Baustein: Abo älter als „Sitzungen beendet" bekommt nichts mehr und wird entfernt', async () => {
  let ab = null;
  const an = [];
  const wp = createWebPush({ fetchImpl: async (url) => { an.push(url); return { status: 201 }; }, sitzungenAb: () => ab });
  wp.abonnieren('u1', abo('https://fcm.googleapis.com/fcm/send/alt'));
  assert.equal(wp.geraete('u1'), 1);
  ab = Date.now() + 5;
  await new Promise((ok) => setTimeout(ok, 10));
  assert.equal(wp.geraete('u1'), 0, 'altes Gerät zählt noch');
  assert.deepEqual(await wp.senden('u1', { titel: 'x' }), { ok: 0, entfernt: 1, fehler: 0 });
  assert.equal(an.length, 0, 'an altes Gerät gesendet');
  wp.abonnieren('u1', abo('https://fcm.googleapis.com/fcm/send/neu'));
  assert.deepEqual(await wp.senden('u1', { titel: 'y' }), { ok: 1, entfernt: 0, fehler: 0 });
  assert.equal(wp.__dump().abos.length, 1, 'altes Abo nicht entfernt');
});

test('Über HTTP: „alle anderen Geräte abmelden" und Passwort-Reset beenden fremde Push-Abos', { timeout: 60000 }, async () => {
  const eingang = [];
  const dienst = http.createServer((req, res) => { req.resume(); req.on('end', () => { eingang.push(req.url); res.writeHead(201); res.end(); }); });
  await new Promise((ok) => dienst.listen(0, ok));
  const P = `http://localhost:${dienst.address().port}`;
  const kind = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'push-sitzung-1', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus', APOPULSE_PUSH_LOKAL_ERLAUBT: '1' },
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
    const post = async (pfad, tok, body) => { const r = await fetch(B + pfad, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: JSON.stringify(body || {}) }); return { status: r.status, d: await r.json() }; };
    const reg = (await post('/api/register', '', { name: 'Tresen', email: 'tresen@apo.ke', password: 'Passwort-Alt-1', country: 'KE', accountType: 'pharmacy' })).d;
    const tresen = reg.token; // geteilter Rechner am Tresen
    const handy = (await post('/api/login', '', { email: 'tresen@apo.ke', password: 'Passwort-Alt-1' })).d.token;
    assert.equal((await post('/api/push/abo', tresen, { abo: abo(P + '/tresen') })).status, 200);
    await new Promise((ok) => setTimeout(ok, 5));

    // Am Handy: „Auf allen anderen Geräten abmelden" — das Handy meldet sein eigenes Abo neu an.
    const neu = (await post('/api/me/sitzungen/beenden', handy)).d.token;
    await new Promise((ok) => setTimeout(ok, 5));
    assert.equal((await post('/api/push/abo', neu, { abo: abo(P + '/handy') })).status, 200);
    eingang.length = 0;
    assert.equal((await post('/api/push/test', neu)).d.ok, 1);
    for (let i = 0; i < 30 && eingang.length < 1; i++) await new Promise((ok) => setTimeout(ok, 50));
    await new Promise((ok) => setTimeout(ok, 200));
    assert.deepEqual(eingang, ['/handy'], 'Tresen-Rechner bekommt nach „alle anderen abmelden" weiter Push');
    assert.equal((await post('/api/push/abo', tresen, { abo: abo(P + '/tresen') })).status, 401, 'abgemeldetes Gerät meldet sich neu an');

    // Passwort per Wiederherstellungscode zurückgesetzt (z. B. nach Diebstahl): auch das Handy-Abo endet.
    const r = await post('/api/password/reset', '', { email: 'tresen@apo.ke', code: reg.recovery_codes[0], newPassword: 'Passwort-Neu-2' });
    assert.equal(r.status, 200, JSON.stringify(r.d));
    await new Promise((ok) => setTimeout(ok, 5));
    const nachReset = (await post('/api/login', '', { email: 'tresen@apo.ke', password: 'Passwort-Neu-2' })).d.token;
    assert.equal((await post('/api/push/test', nachReset)).status, 409, 'nach Passwort-Reset noch Geräte mit Push');
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
    dienst.close();
  }
});

test('App: Abmelden beendet Push auf diesem Gerät; eigenes Gerät meldet sich nach Sitzungsende/Start neu an', () => {
  assert.match(APP, /document\.getElementById\('btnLogout'\)\.onclick = async \(\) => \{ await pushBeimAbmelden\(\); localStorage\.removeItem\('apo_token'\);/);
  assert.match(APP, /async function pushBeimAbmelden\(\) \{[^}]*pushAusschalten\(\)/);
  assert.match(APP, /api\('POST','\/api\/me\/sitzungen\/beenden'\);[^\n]*pushNeuMelden\(\)/, 'nach „alle anderen abmelden" verliert das eigene Gerät Push');
  assert.match(APP, /api\('POST','\/api\/me\/password',[^\n]*\n(?:[^\n]*\n)?[^\n]*pushNeuMelden\(\)/, 'nach Passwortwechsel verliert das eigene Gerät Push');
  assert.match(APP, /pushNeuMelden\(\); \/\/ Start:/, 'Start meldet ein vorhandenes Abo nicht neu an');
});
