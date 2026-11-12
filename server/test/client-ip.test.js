// Client-IP hinter dem Render-Proxy: Quelle einstellbar, Fälschbarkeit im Startklar-Check selbst prüfbar.
// Fund 11/2026: Der Server nahm fest den ERSTEN Eintrag von X-Forwarded-For. Hängt der Proxy nur hinten an (so
// berichten Render-Nutzer), setzt diesen Eintrag der Absender selbst — mit wechselnden erfundenen Adressen ließen
// sich die IP-Sperren (Anmeldeversuche, SMS-Codes, Passwort-Links) umgehen. Render dokumentiert das Verhalten nicht
// offiziell; darum misst die Live-App es selbst, statt dass hier geraten wird.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clientIp, ipPruefung, PRUEF_IP } from '../src/http/clientIp.js';
import { startklar } from '../src/services/startklar.js';

const HIER = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HIER, '..', 'src', 'http', 'server.js');
const APP = readFileSync(join(HIER, '..', 'public', 'app.js'), 'utf8');
const P = { 'x-apo-ip-pruefung': '1' };

test('Quelle wählbar; ohne Variable wie bisher (erster Eintrag)', () => {
  const h = { 'x-forwarded-for': '1.1.1.1, 41.90.1.2', 'cf-connecting-ip': '41.90.1.3' };
  assert.equal(clientIp(h, '10.0.0.1', {}), '1.1.1.1');
  assert.equal(clientIp(h, '10.0.0.1', { APOPULSE_CLIENT_IP: 'xff-letzter' }), '41.90.1.2');
  assert.equal(clientIp(h, '10.0.0.1', { APOPULSE_CLIENT_IP: 'cf-connecting-ip' }), '41.90.1.3');
  assert.equal(clientIp({}, '10.0.0.1', { APOPULSE_CLIENT_IP: 'cf-connecting-ip' }), '10.0.0.1', 'fehlt die Kopfzeile: Rückfall');
  assert.equal(clientIp(h, null, { APOPULSE_CLIENT_IP: 'unsinn' }), '1.1.1.1');
});

test('Prüfung: erkennt fälschbare Erkennung und empfiehlt die Quelle, die die Infrastruktur überschreibt', () => {
  // Proxy hängt nur an (Absender-Angaben bleiben vorn), kein Cloudflare:
  const anhaengen = { ...P, 'x-forwarded-for': `${PRUEF_IP}, 41.90.1.2`, 'cf-connecting-ip': PRUEF_IP, 'true-client-ip': PRUEF_IP, 'x-real-ip': PRUEF_IP };
  assert.deepEqual(ipPruefung(anhaengen, null, {}), { quelle: 'xff-erster', faelschbar: true, empfehlung: 'xff-letzter' });
  // Hinter Cloudflare (überschreibt CF-Connecting-IP/True-Client-IP):
  const cloudflare = { ...P, 'x-forwarded-for': `${PRUEF_IP}, 41.90.1.2, 172.68.1.1`, 'cf-connecting-ip': '41.90.1.2', 'true-client-ip': '41.90.1.2', 'x-real-ip': PRUEF_IP };
  assert.equal(ipPruefung(cloudflare, null, {}).empfehlung, 'cf-connecting-ip');
  assert.deepEqual(ipPruefung(cloudflare, null, { APOPULSE_CLIENT_IP: 'cf-connecting-ip' }), { quelle: 'cf-connecting-ip', faelschbar: false, empfehlung: 'cf-connecting-ip' });
  // Proxy ersetzt X-Forwarded-For (erster Eintrag ist echt):
  assert.equal(ipPruefung({ ...P, 'x-forwarded-for': '41.90.1.2' }, null, {}).faelschbar, false);
  // Ohne Prüf-Kopfzeile: keine Prüfung.
  assert.equal(ipPruefung({ 'x-forwarded-for': PRUEF_IP }, null, {}), null);
});

test('Startklar: Punkt nur bei Prüf-Anfrage; fälschbar → gelb mit Render-Einstellung, sonst grün', () => {
  const ohne = startklar({ env: {} }).punkte || startklar({ env: {} });
  const punkte = (r) => (Array.isArray(r) ? r : r.punkte);
  assert.ok(!punkte(ohne).some((x) => x.id === 'ip'));
  const gelb = punkte(startklar({ env: {}, ip: { quelle: 'xff-erster', faelschbar: true, empfehlung: 'xff-letzter' } })).find((x) => x.id === 'ip');
  assert.equal(gelb.stufe, 'warnung'); assert.match(gelb.tun, /APOPULSE_CLIENT_IP=xff-letzter/);
  const ohneEmpf = punkte(startklar({ env: {}, ip: { quelle: 'xff-erster', faelschbar: true, empfehlung: null } })).find((x) => x.id === 'ip');
  assert.match(ohneEmpf.tun, /Render-Support/);
  assert.equal(punkte(startklar({ env: {}, ip: { quelle: 'cf-connecting-ip', faelschbar: false, empfehlung: 'cf-connecting-ip' } })).find((x) => x.id === 'ip').stufe, 'ok');
});

test('App: Startklar-Abfrage schickt die erfundene Adresse in allen Kandidaten-Kopfzeilen', () => {
  assert.match(APP, /const ipPruefKopf = \{ 'x-apo-ip-pruefung': '1', 'X-Forwarded-For': '203\.0\.113\.77', 'CF-Connecting-IP': '203\.0\.113\.77', 'True-Client-IP': '203\.0\.113\.77', 'X-Real-IP': '203\.0\.113\.77' \};/);
  assert.match(APP, /api\('GET', '\/api\/startklar', null, ipPruefKopf\)/);
});

test('Über HTTP: Startklar zeigt den Punkt; mit APOPULSE_CLIENT_IP=xff-letzter greift die Anmeldesperre trotz wechselnder erfundener Adressen', { timeout: 60000 }, async () => {
  const kind = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'client-ip-1', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus', APOPULSE_EXTERN_AUS: '1',
      APOPULSE_ADMIN_EMAIL: 'red@ip.test', APOPULSE_ADMIN_PASSWORD: 'client-ip-PW-1', APOPULSE_CLIENT_IP: 'xff-letzter' },
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
    const login = (pw, xff) => fetch(B + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': xff }, body: JSON.stringify({ email: 'red@ip.test', password: pw }) });
    const red = await (await login('client-ip-PW-1', '41.90.1.2')).json();
    assert.ok(red.token);
    const sk = await (await fetch(B + '/api/startklar', { headers: { authorization: 'Bearer ' + red.token, 'x-apo-ip-pruefung': '1', 'x-forwarded-for': `${PRUEF_IP}, 41.90.1.2` } })).json();
    const punkt = (sk.punkte || sk).find((x) => x.id === 'ip');
    assert.ok(punkt, 'Punkt fehlt'); assert.equal(punkt.stufe, 'ok', 'xff-letzter mit angehängter echter Adresse ist nicht fälschbar');
    const stati = [];
    for (let i = 0; i < 7; i++) stati.push((await login('falsch-' + i, `9.9.9.${i}, 41.90.1.9`)).status);
    assert.ok(stati.slice(5).every((st) => st === 429), `Sperre umgangen: ${stati.join(',')}`);
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});
