// Fehler auf den Geräten (services/geraeteFehler.js): Bis 10/2026 erfuhr niemand, wenn die App
// auf einem Handy mit einem Skript-Fehler abbrach. Jetzt anonym gemeldet und im Betriebs-Cockpit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGeraeteFehler, bereinige, geraeteKlasse, MAX_ARTEN, AUFBEWAHREN_TAGE } from '../src/services/geraeteFehler.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = readFileSync(join(ROOT, 'public', 'app.js'), 'utf8');
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 10; TECNO KE5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Mobile Safari/537.36';

test('Bereinigen: keine E-Mail, Telefonnummer, Schlüssel, Adress-Zusätze; Geräteklasse grob', () => {
  const s = bereinige('TypeError: x für ama.mensah@gmail.com +233 24 123 4567 bei https://www.apopulse.com/app.js?token=eyJhbGciOiJIUzI1NiJ9abcdefghijklmnop:12:5 Schlüssel ' + 'Zx9Qw3'.repeat(7));
  assert.ok(!/ama\.mensah|gmail/.test(s), s);
  assert.ok(!/233|4567/.test(s), s);
  assert.ok(!/token|eyJ/.test(s), s);
  assert.ok(!/Zx9Qw3/.test(s), s);
  assert.ok(!/apopulse\.com/.test(s), s);
  assert.match(s, /\[E-Mail\]/); assert.match(s, /\/app\.js/);
  assert.match(bereinige('Fehler in Zeile 12'), /Zeile 12/, 'kurze Zahlen bleiben');
  assert.equal(bereinige('Fehler bei /suche?q=Kofi%20Mensah&x=1 in /app.js:3:4'), 'Fehler bei /suche in /app.js:3:4', 'Suchbegriff aus der Adresse übernommen');
  assert.equal(bereinige('Fehler im Ablauf '.repeat(60)).length, 300);
  assert.equal(geraeteKlasse(UA_ANDROID), 'Android 10 · Chrome');
  assert.equal(geraeteKlasse('Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 Version/16.6 Mobile/15E148 Safari/604.1'), 'iOS 16 · Safari');
  assert.equal(geraeteKlasse('Mozilla/5.0 (Linux; Android 12; SM-A125F) AppleWebKit/537.36 SamsungBrowser/23.0 Chrome/115 Mobile Safari/537.36'), 'Android 12 · Samsung Internet');
  assert.equal(geraeteKlasse(''), 'Rechner · anderer Browser');
});

test('Zählen: gleiche Fehler zusammen, Grenzen, Aufbewahrung, Speichern/Laden', () => {
  let jetzt = Date.parse('2026-11-01T08:00:00Z');
  const gf = createGeraeteFehler({ jetzt: () => jetzt });
  assert.equal(gf.melde({}, UA_ANDROID), false, 'leere Meldung gezählt');
  assert.equal(gf.melde(null, UA_ANDROID), false);
  for (let i = 0; i < 3; i++) assert.ok(gf.melde({ meldung: 'TypeError: a is undefined', datei: 'https://www.apopulse.com/app.js?v=1', zeile: 120, spalte: 7, stapel: 'at x (https://www.apopulse.com/app.js:120:7)' }, UA_ANDROID));
  gf.melde({ meldung: 'TypeError: a is undefined', datei: '/app.js', zeile: 120, spalte: 7 }, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) Safari/604.1');
  gf.melde({ meldung: 'Anderer Fehler', datei: '../../etc/passwd', zeile: 1 }, UA_ANDROID);
  const b = gf.bericht();
  assert.equal(b.arten, 2); assert.equal(b.meldungen, 5);
  assert.equal(b.liste[0].anzahl, 4); assert.equal(b.liste[0].ort, '/app.js:120:7');
  assert.deepEqual(b.liste[0].geraete, [{ klasse: 'Android 10 · Chrome', n: 3 }, { klasse: 'iOS 17 · Safari', n: 1 }]);
  assert.equal(b.liste[1].ort, '', 'unpassender Dateiname übernommen');
  assert.ok(!JSON.stringify(gf.__dump()).includes('Mozilla'), 'User-Agent gespeichert');
  // Höchstens MAX_ARTEN; die am längsten ruhige fällt weg.
  for (let i = 0; i < MAX_ARTEN + 5; i++) { jetzt += 1000; gf.melde({ meldung: 'Fehler Nr. ' + i }, ''); }
  assert.equal(gf.__dump().length, MAX_ARTEN);
  assert.ok(!gf.__dump().some((a) => a.meldung === 'TypeError: a is undefined'), 'ältester nicht verdrängt');
  // Laden: gleiche Liste, Unsinn verworfen.
  const neu = createGeraeteFehler({ jetzt: () => jetzt });
  neu.__load([...gf.__dump(), { meldung: '' }, 'x', null]);
  assert.equal(neu.__dump().length, MAX_ARTEN);
  // Nach AUFBEWAHREN_TAGE ohne Auftreten weg.
  jetzt += (AUFBEWAHREN_TAGE + 1) * 86400000;
  assert.equal(neu.bericht({ tage: 365 }).arten, 0);
});

test('Seite: meldet unerwartete Fehler einmal, höchstens 5; keine Netz-/Server-Fehler, keine fremden Skripte', () => {
  const start = APP.indexOf('// ── Fehler auf dem Gerät melden');
  const code = APP.slice(start, APP.indexOf('})();', start) + 5);
  const hoerer = {}; const gesendet = [];
  const ctx = {
    window: { addEventListener: (t, f) => { hoerer[t] = f; } },
    location: { origin: 'https://www.apopulse.com' },
    navigator: { sendBeacon: (u, blob) => { gesendet.push([u, blob]); return true; } },
    Blob: class { constructor(teile) { this.text = teile.join(''); } },
    JSON, String, Error, TypeError,
  };
  vm.runInNewContext(code, ctx);
  const fehler = (o) => hoerer.error({ message: 'TypeError: x', filename: 'https://www.apopulse.com/app.js', lineno: 10, colno: 2, error: { stack: 's' }, ...o });
  fehler({});
  fehler({}); // gleicher Fehler: nur einmal
  fehler({ filename: 'chrome-extension://abc/inhalt.js', lineno: 3 });
  fehler({ message: 'Script error.', filename: '' });
  fehler({ message: 'TypeError: Failed to fetch', lineno: 11 });
  hoerer.error({ message: '' }); // Lade-Fehler eines Bildes
  const serverFehler = new Error('Nicht gefunden'); serverFehler.code = 'not_found';
  hoerer.unhandledrejection({ reason: serverFehler });
  const netz = new Error('Keine Verbindung'); netz.code = 'network';
  hoerer.unhandledrejection({ reason: netz });
  hoerer.unhandledrejection({ reason: 'nur Text' });
  assert.equal(gesendet.length, 1, 'erwartbare oder fremde Fehler gemeldet');
  const echt = new ctx.TypeError('b is null'); echt.stack = 'TypeError: b is null\n    at f (https://www.apopulse.com/app.js:200:9)';
  hoerer.unhandledrejection({ reason: echt });
  assert.equal(gesendet.length, 2);
  const d = JSON.parse(gesendet[1][1].text);
  assert.equal(gesendet[1][0], '/api/fehlerbericht');
  assert.deepEqual([d.meldung, d.datei, d.zeile, d.spalte], ['TypeError: b is null', 'https://www.apopulse.com/app.js', 200, 9]);
  for (let i = 0; i < 10; i++) fehler({ message: 'Fehler ' + i, lineno: 50 + i });
  assert.equal(gesendet.length, 5, 'mehr als 5 Meldungen je Aufruf');
  assert.ok(start < APP.indexOf('const ICONS'), 'Fehler-Meldung steht nicht am Anfang (frühe Fehler gingen verloren)');
});

test('Ende zu Ende: anonym melden, bereinigt im Cockpit, nur Moderation, Mengengrenze', { timeout: 60000 }, async () => {
  const kind = spawn(process.execPath, [join(ROOT, 'src', 'http', 'server.js')], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'gf-test-1', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus',
      APOPULSE_ADMIN_EMAIL: 'red@gf.test', APOPULSE_ADMIN_PASSWORD: 'gf-test-PW-123' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  try {
    const port = await new Promise((ok, fail) => {
      const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
      const lies = (d) => { log += d; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
      kind.stdout.on('data', lies); kind.stderr.on('data', lies);
    });
    const B = `http://localhost:${port}`;
    const H = { 'content-type': 'application/json' };
    const melde = (meldung, extra = {}) => fetch(B + '/api/fehlerbericht', { method: 'POST', headers: { ...H, 'user-agent': UA_ANDROID, ...extra }, body: JSON.stringify({ meldung, datei: B + '/app.js', zeile: 7, spalte: 1, stapel: 'at x' }) });
    // sendBeacon schickt text/plain oder application/json — beides wird angenommen.
    const r = await melde('TypeError: Liste von kofi@example.org fehlt', { 'content-type': 'text/plain;charset=UTF-8' });
    assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true });
    const red = (await (await fetch(B + '/api/login', { method: 'POST', headers: H, body: JSON.stringify({ email: 'red@gf.test', password: 'gf-test-PW-123' }) })).json()).token;
    const b = await (await fetch(B + '/api/betrieb', { headers: { authorization: 'Bearer ' + red } })).json();
    assert.equal(b.geraete_fehler.meldungen, 1);
    assert.equal(b.geraete_fehler.liste[0].meldung, 'TypeError: Liste von [E-Mail] fehlt');
    assert.equal(b.geraete_fehler.liste[0].ort, '/app.js:7:1');
    assert.ok(!JSON.stringify(b.geraete_fehler).includes('127.0.0.1'), 'IP gespeichert');
    // Normales Konto sieht das Cockpit nicht.
    const nutzer = (await (await fetch(B + '/api/register', { method: 'POST', headers: H, body: JSON.stringify({ name: 'Kofi', email: 'kofi@gf.test', password: 'Passwort-1234', country: 'GH', accountType: 'pharmacy' }) })).json()).token;
    assert.equal((await fetch(B + '/api/betrieb', { headers: { authorization: 'Bearer ' + nutzer } })).status, 403);
    // Mengengrenze je Gerät: 30 je Stunde, danach still verworfen.
    for (let i = 0; i < 29; i++) await melde('Fehler ' + i);
    assert.deepEqual(await (await melde('Fehler zu viel')).json(), { ok: false });
    const b2 = await (await fetch(B + '/api/betrieb', { headers: { authorization: 'Bearer ' + red } })).json();
    assert.equal(b2.geraete_fehler.meldungen, 30);
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});

test('Cockpit-Anzeige und Datenschutzerklärung', () => {
  assert.match(APP, /\$\{fehlerListe\(b\.geraete_fehler, b\.fehler\)\}/);
  const ds = readFileSync(join(ROOT, 'public', 'datenschutz.html'), 'utf8');
  assert.match(ds, /Technische Fehlermeldungen der App/);
  assert.match(ds, /30 Tage nach ihrem letzten Auftreten/);
});
