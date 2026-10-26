// Redaktion am Handy (26.10.2026): Was wartet, steht auf der Startseite; die Moderationsseite
// beginnt mit den Aufgaben, nicht mit Startklar und Betrieb.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'http', 'server.js');
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

test('Moderationsseite: Aufgaben vor Startklar und Betrieb', () => {
  const m = app.slice(app.indexOf('async function showModeration('), app.indexOf('async function refreshDmCount('));
  assert.match(m, /app\.append\(head, aufgaben, ueberblick\)/);
  assert.match(m, /ueberblick\.prepend\(startklarKarte\(s\)\)/);
  assert.match(m, /ueberblick\.appendChild\(betriebsKarte\(b\)\)/);
  assert.match(m, /anzeigenPruefung\(aufgaben\)/);
  const nachKopf = m.slice(m.indexOf('app.append(head, aufgaben, ueberblick)'));
  assert.doesNotMatch(nachKopf, /\bapp\.appendChild\(/, 'Abschnitte landen hinter dem Überblick');
});

test('Startseite: Hinweis nur für die Redaktion, nur wenn etwas wartet, vor dem Überblick', () => {
  const k = app.slice(app.indexOf('async function modAufgabenKarte('), app.indexOf('async function loadOverview('));
  assert.match(k, /if \(!iAmModerator\) return;/);
  assert.match(k, /if \(!n \|\| !n\.gesamt \|\| !kopf \|\| !kopf\.isConnected\) return;/);
  assert.match(k, /kopf\.before\(k\)/);
  assert.match(k, /showModeration\(\)/);
});

test('GET /api/mod/aufgaben: Zahlen für die Redaktion, 403 für alle anderen', { timeout: 30000 }, async () => {
  const kind = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'modaufg-geheim-12345', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus',
    APOPULSE_ADMIN_EMAIL: 'red@mod.test', APOPULSE_ADMIN_PASSWORD: 'Mod-Passwort-2026' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  try {
    const port = await new Promise((ok, fail) => {
      const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
      const lies = (d) => { log += d; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
      kind.stdout.on('data', lies); kind.stderr.on('data', lies);
      kind.on('exit', (c) => { clearTimeout(zeit); fail(new Error(`Server beendet (${c}):\n${log}`)); });
    });
    const B = `http://localhost:${port}`;
    const req = async (m, pfad, tok, body) => { const r = await fetch(B + pfad, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, d: await r.json().catch(() => ({})) }; };
    const reg = async (name, typ) => (await req('POST', '/api/register', null, { name, email: name.replace(/\s/g, '') + '@mod.test', password: 'Passwort123!', country: 'NG', accountType: typ })).d.token;
    const firma = await reg('Med Supply', 'wholesale'); const apo = await reg('Ama Owusu', 'pharmacy');
    const red = (await req('POST', '/api/login', null, { email: 'red@mod.test', password: 'Mod-Passwort-2026' })).d.token;
    assert.deepEqual((await req('GET', '/api/mod/aufgaben', red)).d, { krypto: 0, anzeigen: 0, meldungen: 0, berichte: 0, verifizierungen: 0, gesamt: 0 });
    await req('POST', '/api/werbung/firma', firma, { firma: 'Med Supply Ltd', strasse: '1 Road', ort: 'Lagos', land: 'NG', email: 'b@mod.test' });
    const k = (await req('POST', '/api/werbung/kampagnen', firma, { titel: 'Cold chain', text: 'Delivery for pharmacies.', link: 'https://example.com', platz: 'start', laender: ['NG'], zielgruppen: ['pharmacy'], wochen: 1, start: new Date().toISOString().slice(0, 10) })).d.kampagne;
    await req('POST', `/api/werbung/kampagnen/${k.id}/einreichen`, firma);
    const st = (await req('POST', '/api/payments/crypto/start', apo, { productId: 'premium_monthly', coin: 'btc' })).d;
    await req('POST', `/api/payments/crypto/${st.payment_id}/claim`, apo, { txRef: 'ab'.repeat(32) });
    const n = (await req('GET', '/api/mod/aufgaben', red)).d;
    assert.equal(n.krypto, 1); assert.equal(n.anzeigen, 1); assert.equal(n.gesamt, 2);
    assert.equal((await req('GET', '/api/mod/aufgaben', apo)).status, 403);
    assert.equal((await req('GET', '/api/mod/aufgaben')).status, 401);
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});
