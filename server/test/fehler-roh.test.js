// Keine rohen Programmfehler an Nutzer:innen — und keiner geht dem Betreiber verloren.
// Fund 11/2026 (Abklopfen aller POST-Routen mit ungewöhnlichen Eingaben): 22 Routen antworteten auf den
// Anfragetext `null` mit „Cannot read properties of null (reading 'email')" — Anmeldung, Krypto-Start,
// Engpass-Meldung … Ursache 1: readBody nahm jedes gültige JSON (auch null/Zahl/Text). Ursache 2: Die
// Routen gaben JEDEN Fehler roh mit 400 zurück — auch echte Programmfehler, die so weder im Log noch im
// Betriebs-Cockpit auftauchten. Jetzt: Anfragetext ist immer ein Objekt; unerwartete Fehler (ohne Code und
// ohne Status) → 500, übersetzbarer Code „unbekannt", ins Log und in den Cockpit-Zähler.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fehlerAntwort } from '../src/http/fehlerAntwort.js';
import { AppError } from '../src/domain/errors.js';

const HIER = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HIER, '..', 'src', 'http', 'server.js');
const SRC = readFileSync(SERVER, 'utf8');
const JS = /Cannot read|is not a function|is not iterable|reading '/;

test('fehlerAntwort: erwartete Fehler bleiben, Programmfehler werden zu 500 „unbekannt" ohne Interna', () => {
  const a = fehlerAntwort(new AppError('tx_format', 'Falsches Format', 400));
  assert.deepEqual([a.status, a.body.code, a.unerwartet], [400, 'tx_format', false]);
  const zu = Object.assign(new Error('Zu viele Versuche.'), { status: 429, code: 'too_many_attempts', retryAfterS: 30 });
  assert.deepEqual([fehlerAntwort(zu).status, fehlerAntwort(zu).body.retry_after_s], [429, 30]);
  const mitStatus = Object.assign(new Error('Nur Moderation.'), { status: 403 });
  assert.equal(fehlerAntwort(mitStatus).unerwartet, false, 'absichtlicher Fehler mit Status ist erwartet');
  let roh; try { null.x; } catch (e) { roh = e; }
  const p = fehlerAntwort(roh);
  assert.deepEqual([p.status, p.body.code, p.unerwartet], [500, 'unbekannt', true]);
  assert.doesNotMatch(JSON.stringify(p.body), JS, 'Interna in der Antwort');
  assert.equal(fehlerAntwort(new Error('irgendwas')).status, 500, 'Fehler ohne Code/Status = unerwartet');
  assert.equal(fehlerAntwort(Object.assign(new Error('x'), { code: 'e', params: { kette: 'BTC' } })).body.params.kette, 'BTC');
});

test('Server: Routen-Fehler und /api/v1 laufen über fehlerAntwort, unerwartete werden protokolliert und gezählt', () => {
  const routen = SRC.slice(SRC.lastIndexOf('return json(req, res, 200, result'), SRC.lastIndexOf('return json(req, res, 200, result') + 900);
  assert.match(routen, /const f = fehlerAntwort\(e\);/);
  assert.match(routen, /if \(f\.unerwartet\) \{ betriebsFehler\.anfragen\+\+; betriebsFehler\.zuletzt = new Date\(\)\.toISOString\(\); console\.error\(/);
  const v1 = SRC.slice(SRC.indexOf("return antwort(404, { error: 'Unbekannter Endpunkt."), SRC.indexOf("return antwort(404, { error: 'Unbekannter Endpunkt.") + 700);
  assert.match(v1, /fehlerAntwort\(e\)/);
  assert.match(SRC, /resolve\(p && typeof p === 'object' && !Array\.isArray\(p\) \? p : \{\}\)/, 'readBody nimmt null/Zahl/Liste');
});

test('Über HTTP: Anfragetext null/Zahl/Liste liefert nie einen rohen Programmfehler', { timeout: 120000 }, async () => {
  const kind = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'fehler-roh-1', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus',
      APOPULSE_ADMIN_EMAIL: 'red@roh.test', APOPULSE_ADMIN_PASSWORD: 'fehler-roh-PW-1' },
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
    const post = async (p, tok, roh) => { const r = await fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: roh }); let d = {}; try { d = await r.json(); } catch { /* leer */ } return { s: r.status, d }; };
    const apo = (await post('/api/register', '', JSON.stringify({ name: 'Roh', email: 'roh@ex.com', password: 'Passwort123!', country: 'KE', accountType: 'pharmacy' }))).d.token;
    const red = (await post('/api/login', '', JSON.stringify({ email: 'red@roh.test', password: 'fehler-roh-PW-1' }))).d.token;
    assert.ok(apo && red);
    const pfade = ['/api/medint/abo', '/api/ausbruch/alarm', '/api/mod/zugang-link', '/api/telefon/code', '/api/telefon/pruefen', '/api/telefon/konto',
      '/api/payments/checkout', '/api/payments/crypto/start', '/api/login', '/api/push/abo', '/api/push/abbestellen', '/api/rechnungen/ueberweisung',
      '/api/verify/request', '/api/logistik', '/api/translate', '/api/posts', '/api/notification-prefs', '/api/shortages/report', '/api/sortiment/pruefen',
      '/api/watchlist', '/api/watchlist/bulk', '/api/watchlist/alert-all'];
    const roh = [];
    for (const p of pfade) for (const tok of [apo, red]) for (const k of ['null', '5', '"x"', '[]']) {
      const a = await post(p, tok, k);
      if (typeof a.d.error === 'string' && JS.test(a.d.error)) roh.push(`${p} (${k}): ${a.d.error.slice(0, 80)}`);
    }
    assert.deepEqual(roh, [], 'rohe Programmfehler an Nutzer:innen');
    const login = await post('/api/login', '', 'null');
    assert.ok(login.s >= 400 && login.s < 500 && login.d.code, `Anmeldung ohne Angaben: ${login.s} ${JSON.stringify(login.d)}`);
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});
