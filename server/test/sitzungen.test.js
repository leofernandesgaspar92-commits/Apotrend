// Sitzungen beenden (10/2026): Wer sein Passwort ändert oder zurücksetzt, will fremde
// Geräte draußen haben — bis dahin galt ein einmal ausgestelltes Token für immer.
// Dazu „Auf allen anderen Geräten abmelden" in den Kontoeinstellungen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SECRET = 'sitzungen-test-geheim-12345';
process.env.APOPULSE_TOKEN_SECRET = SECRET;
const { issueToken, tokenDetails, verifyToken, sitzungGueltig } = await import('../src/http/token.js');
const { createMemoryRepo } = await import('../src/repo/memoryRepo.js');
const HIER = dirname(fileURLToPath(import.meta.url));
// Token im alten Format (nur userId) — so liegen sie heute in den Browsern.
const altesToken = (uid) => { const p = Buffer.from(uid).toString('base64url'); return `${p}.${crypto.createHmac('sha256', SECRET).update(p).digest('base64url')}`; };

test('Token trägt die Ausstellungszeit; alte Token bleiben lesbar', () => {
  assert.deepEqual(tokenDetails(issueToken('u-1', 1234)), { userId: 'u-1', ausgestellt: 1234 });
  assert.deepEqual(tokenDetails(altesToken('u-1')), { userId: 'u-1', ausgestellt: null });
  assert.equal(verifyToken(issueToken('u-1')), 'u-1');
  assert.equal(tokenDetails(issueToken('u-1').replace(/.$/, 'x')), null);
});

test('Regel: gültig ohne Beenden; danach nur, was nach dem Zeitpunkt ausgestellt wurde', () => {
  const neu = tokenDetails(issueToken('u', 2000)), alt = tokenDetails(altesToken('u')), frueh = tokenDetails(issueToken('u', 999));
  assert.ok(sitzungGueltig(alt, { id: 'u' }), 'alte Token gelten, bis das Konto zum ersten Mal beendet');
  assert.ok(sitzungGueltig(neu, { id: 'u', sitzungen_ab: 2000 }));
  assert.ok(!sitzungGueltig(frueh, { id: 'u', sitzungen_ab: 1000 }));
  assert.ok(!sitzungGueltig(alt, { id: 'u', sitzungen_ab: 1000 }));
  assert.ok(!sitzungGueltig(neu, null), 'Konto gelöscht');
});

test('Repo: neues Passwort beendet Sitzungen; Zeitpunkt übersteht Sicherung und Neustart', () => {
  const repo = createMemoryRepo();
  const u = repo.createUser({ email: 'a@b.cd', name: 'A', passwordHash: 'h1' });
  assert.equal(repo.getUserById(u.id).sitzungen_ab, undefined);
  const vorher = Date.now();
  repo.setUserPassword(u.id, 'h2');
  assert.ok(repo.getUserById(u.id).sitzungen_ab >= vorher);
  repo.beendeSitzungen(u.id, 4242);
  const frisch = createMemoryRepo(); frisch.__load(JSON.parse(JSON.stringify(repo.__dump())));
  assert.equal(frisch.getUserById(u.id).sitzungen_ab, 4242);
});

test('Oberfläche: Knopf in den Kontoeinstellungen, neues Token wird übernommen', () => {
  const app = readFileSync(join(HIER, '..', 'public', 'app.js'), 'utf8');
  assert.match(app, /id="sess_end">\$\{esc\(t\('ac_sess_btn'\)\)\}/);
  const knopf = app.slice(app.indexOf("dcard.querySelector('#sess_end').onclick"), app.indexOf("dcard.querySelector('#dl_export').onclick"));
  assert.match(knopf, /api\('POST','\/api\/me\/sitzungen\/beenden'\)[\s\S]*localStorage\.setItem\('apo_token', r\.token\)/);
  const pw = app.slice(app.indexOf("dcard.querySelector('#pw_go').onclick"));
  assert.match(pw.slice(0, 600), /if \(r && r\.token\) localStorage\.setItem\('apo_token', r\.token\);/, 'sonst meldet der Passwortwechsel dieses Gerät mit ab');
});

test('HTTP: „überall abmelden" und Passwortwechsel beenden andere Sitzungen, dieses Gerät bleibt drin', { timeout: 60000 }, async () => {
  const env = { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: SECRET, APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus' };
  const kind = spawn(process.execPath, [join(HIER, '..', 'src', 'http', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const port = await new Promise((ok, fehler) => {
      let l = ''; const z = setTimeout(() => fehler(new Error('Server startet nicht')), 30000);
      kind.stdout.on('data', (d) => { l += d; const m = l.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(z); ok(m[1]); } });
    });
    const req = (method, pfad, body, token) => new Promise((ok, fehler) => {
      const r = http.request({ host: 'localhost', port, path: pfad, method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) } }, (res) => {
        let b = ''; res.on('data', (d) => { b += d; }); res.on('end', () => ok({ status: res.statusCode, json: JSON.parse(b || '{}') }));
      });
      r.on('error', fehler); if (body) r.write(JSON.stringify(body)); r.end();
    });
    const pause = () => new Promise((r) => setTimeout(r, 5));
    const me = async (t) => (await req('GET', '/api/me', null, t)).status;
    const reg = await req('POST', '/api/register', { name: 'Sitzung Test', email: 'sitzung@test.ke', password: 'altes-passwort', country: 'KE' });
    const handy = reg.json.token;
    const alt = altesToken(reg.json.user.id);
    const laptop = (await req('POST', '/api/login', { email: 'sitzung@test.ke', password: 'altes-passwort' })).json.token;
    assert.equal(await me(handy), 200); assert.equal(await me(laptop), 200); assert.equal(await me(alt), 200, 'altes Format gilt weiter');
    await pause();
    const r = await req('POST', '/api/me/sitzungen/beenden', null, laptop);
    assert.equal(r.status, 200);
    const unauth = await req('GET', '/api/me', null, handy);
    assert.equal(unauth.status, 401); assert.equal(unauth.json.code, 'not_authenticated', 'Frontend führt sauber zur Anmeldung');
    assert.equal(await me(laptop), 401, 'auch das alte Token dieses Geräts');
    assert.equal(await me(alt), 401);
    assert.equal(await me(r.json.token), 200, 'dieses Gerät bleibt mit neuem Token drin');
    await pause();
    const pw = await req('POST', '/api/me/password', { oldPassword: 'altes-passwort', newPassword: 'neues-passwort-1' }, r.json.token);
    assert.equal(pw.status, 200); assert.ok(pw.json.ok);
    assert.equal(await me(r.json.token), 401);
    assert.equal(await me(pw.json.token), 200);
  } finally { kind.kill(); }
});
