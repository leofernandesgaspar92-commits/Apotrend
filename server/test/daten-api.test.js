// Daten-Schnittstelle (services/datenApi.js): Schlüssel, Grenzen, CSV —
// und von Ende zu Ende: Business kaufen (Krypto), Schlüssel anlegen,
// Engpässe und Listenprüfung abfragen, widerrufen, Konto löschen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatenApi, zugangPruefen, alsCsv, MAX_SCHLUESSEL, ANFRAGEN_JE_MINUTE } from '../src/services/datenApi.js';
import { getProduct } from '../src/data/products.js';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'http', 'server.js');

test('Schlüssel: nur einmal im Klartext, gespeichert als Hash, widerrufbar', () => {
  const api = createDatenApi();
  const k = api.anlegen('u1', 'Warenwirtschaft');
  assert.match(k.schluessel, /^apk_[A-Za-z0-9_-]{32}$/);
  assert.deepEqual(api.pruefen(k.schluessel), { userId: 'u1', id: k.id });
  // Liste und Sicherung: kein Klartext.
  assert.ok(!JSON.stringify(api.liste('u1')).includes(k.schluessel));
  const dump = JSON.stringify(api.__dump());
  assert.ok(!dump.includes(k.schluessel), 'Klartext-Schlüssel in der Sicherung');
  // Nach dem Neuladen gilt der Schlüssel weiter.
  const neu = createDatenApi(); neu.__load(JSON.parse(dump));
  assert.equal(neu.pruefen(k.schluessel).userId, 'u1');
  // Fremde dürfen nicht widerrufen; die Besitzerin schon.
  assert.throws(() => neu.widerrufen('u2', k.id), /nicht gefunden/);
  neu.widerrufen('u1', k.id);
  assert.throws(() => neu.pruefen(k.schluessel), (e) => e.status === 401);
  assert.throws(() => neu.pruefen('apk_erfunden'), (e) => e.status === 401);
  assert.throws(() => neu.pruefen(''), (e) => e.status === 401);
});

test('Grenzen: höchstens 5 Schlüssel, 120 Anfragen je Minute, Konto weg = Schlüssel weg', () => {
  let t = Date.parse('2026-10-14T08:00:00Z');
  const api = createDatenApi({ uhr: () => t });
  const ks = Array.from({ length: MAX_SCHLUESSEL }, (_, i) => api.anlegen('u1', 'k' + i));
  assert.throws(() => api.anlegen('u1', 'zu viel'), /Höchstens 5/);
  api.anlegen('u2', 'andere Person'); // eigene Grenze je Konto
  for (let i = 0; i < ANFRAGEN_JE_MINUTE; i++) api.pruefen(ks[0].schluessel);
  assert.throws(() => api.pruefen(ks[0].schluessel), (e) => e.status === 429 && e.retryAfterS > 0);
  api.pruefen(ks[1].schluessel); // Grenze je Schlüssel
  t += 61000;
  api.pruefen(ks[0].schluessel);
  assert.equal(api.liste('u1')[0].anfragen, ANFRAGEN_JE_MINUTE + 1);
  api.nutzerEntfernen('u1');
  assert.throws(() => api.pruefen(ks[1].schluessel), (e) => e.status === 401);
  assert.equal(api.liste('u1').length, 0);
});

test('Tarif abgelaufen: 402 mit Datum statt leerer Liste', () => {
  const api = createDatenApi();
  const k = api.anlegen('u1', 'SAP');
  let aktiv = true;
  const opt = { api, hatTarif: () => aktiv, tarifBis: () => '2026-11-01T00:00:00.000Z' };
  assert.equal(zugangPruefen(k.schluessel, opt), 'u1');
  aktiv = false;
  assert.throws(() => zugangPruefen(k.schluessel, opt), (e) => e.status === 402 && /2026-11-01 abgelaufen/.test(e.message));
  assert.throws(() => zugangPruefen('', opt), (e) => e.status === 401);
});

test('CSV für Excel: BOM, Semikolon, Anführungszeichen, keine Formeln', () => {
  const csv = alsCsv([{ a: 'Amoxicillin; 1000 mg', b: '=HYPERLINK("http://x")', c: ['AT', 'DE'], d: null }], ['a', 'b', 'c', 'd']);
  assert.ok(csv.startsWith('\uFEFFa;b;c;d\r\n'));
  const zeile = csv.split('\r\n')[1];
  assert.equal(zeile, '"Amoxicillin; 1000 mg";"\'=HYPERLINK(""http://x"")";AT, DE;');
});

test('Business schaltet Schnittstelle UND Premium frei', () => {
  const p = getProduct('business_yearly');
  assert.equal(p.feature, 'api');
  assert.deepEqual(p.zusatz, ['premium']);
  assert.equal(p.monate, 12);
});

test('Schnittstelle über HTTP: kaufen, Schlüssel, abfragen, widerrufen', { timeout: 60000 }, async () => {
  const behoerde = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ items: [{ wirkstoff: 'Amoxicillin', bezeichnung: 'Amoxicillin 1000 mg', status: 'nicht lieferbar', meldedatum: '2026-09-01' }] }));
  });
  await new Promise((ok) => behoerde.listen(0, ok));
  const kind = spawn(process.execPath, [SERVER], {
    env: {
      ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'api-test', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus',
      APOPULSE_ADMIN_EMAIL: 'red@api.test', APOPULSE_ADMIN_PASSWORD: 'api-test-123',
      // Beispieldaten AN: Genau die dürfen NICHT in die Schnittstelle. Ohne
      // sie prüfte der Filter-Test ins Leere (Gegenprobe hat es gezeigt).
      APOPULSE_REFERENCE_DATA: 'an',
      APOPULSE_SOURCE_BASG_SHORTAGES_URL: `http://localhost:${behoerde.address().port}/basg.json`,
    },
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
    const H = (t) => ({ 'content-type': 'application/json', ...(t ? { authorization: 'Bearer ' + t } : {}) });
    const req = async (m, pfad, t, body, extra = {}) => { const r = await fetch(B + pfad, { method: m, headers: { ...H(t), ...extra }, body: body ? JSON.stringify(body) : undefined }); const txt = await r.text(); let d; try { d = JSON.parse(txt); } catch { d = txt; } return { status: r.status, d, headers: r.headers }; };
    const red = (await req('POST', '/api/login', '', { email: 'red@api.test', password: 'api-test-123' })).d.token;
    const gh = (await req('POST', '/api/register', '', { name: 'Grosshandel Nord', email: 'gh@api.test', password: 'Passwort123!', country: 'AT', accountType: 'wholesale' })).d.token;
    assert.ok(red && gh);

    // Ohne Business: kein Schlüssel.
    assert.equal((await req('GET', '/api/daten-api/schluessel', gh)).d.berechtigt, false);
    assert.equal((await req('POST', '/api/daten-api/schluessel', gh, { name: 'x' })).status, 402);
    assert.equal((await req('GET', '/api/v1/engpaesse')).status, 401);
    assert.equal((await req('GET', '/api/v1/engpaesse', '', null, { 'x-api-key': 'apk_erfunden' })).status, 401);
    // Der Sitzungs-Token der App ist KEIN Schnittstellen-Schlüssel.
    assert.equal((await req('GET', '/api/v1/engpaesse', gh)).status, 401);

    // Business per Krypto kaufen, Redaktion bestätigt.
    const opt = (await req('GET', '/api/payments/crypto?product=business_yearly')).d;
    assert.equal(opt.amount_eur, 990);
    const btc = opt.coins.find((c) => c.coin === 'bitcoin');
    const start = (await req('POST', '/api/payments/crypto/start', gh, { productId: 'business_yearly', walletId: btc.id })).d;
    const tx = Array.from({ length: 64 }, (_, i) => '0123456789abcdef'[(i * 7 + 3) % 16]).join('');
    assert.equal((await req('POST', `/api/payments/crypto/${start.payment_id}/claim`, gh, { txRef: tx })).status, 200);
    assert.equal((await req('POST', `/api/payments/${start.payment_id}/confirm`, red)).status, 200);
    const pr = (await req('GET', '/api/me/premium', gh)).d;
    assert.equal(pr.premium, true, 'Business schaltet Premium mit frei');
    assert.ok(pr.bis, 'Premium aus Business läuft mit ab');

    const k = (await req('POST', '/api/daten-api/schluessel', gh, { name: 'SAP' })).d.schluessel;
    assert.match(k.schluessel, /^apk_/);
    const liste = (await req('GET', '/api/daten-api/schluessel', gh)).d;
    assert.equal(liste.berechtigt, true);
    assert.ok(!JSON.stringify(liste).includes(k.schluessel), 'Liste zeigt den Klartext');
    const A = { authorization: 'Bearer ' + k.schluessel };

    // Vor dem ersten Abruf: nur Referenzdaten (Beispielzeilen) — die gehören
    // NICHT in eine Warenwirtschaft.
    // Gegencheck: In der App SIND Beispielzeilen sichtbar (gekennzeichnet).
    const app = (await req('GET', '/api/shortages?country=AT', gh)).d;
    assert.ok((app.items || app.shortages || app).some((z) => z.provenance === 'reference' && (z.status === 'kritisch' || z.status === 'eingeschraenkt')), 'Testaufbau: keine Beispielzeilen vorhanden');
    let r = await req('GET', '/api/v1/engpaesse?land=AT', '', null, A);
    assert.equal(r.status, 200);
    assert.equal(r.d.anzahl, 0, 'Referenzdaten in der Schnittstelle: ' + JSON.stringify(r.d.engpaesse.slice(0, 2)));
    r = await req('POST', '/api/v1/pruefen', '', { land: 'AT', wirkstoffe: ['Levothyroxin 100 µg'] }, A);
    assert.notEqual(r.d.ergebnisse[0].einstufung, 'knapp', 'Referenzzeile als Engpass gemeldet');

    assert.equal((await req('POST', '/api/live/run/shortages', red)).status, 200);

    r = await req('GET', '/api/v1/engpaesse?land=AT', '', null, A);
    assert.equal(r.d.anzahl, 1);
    assert.deepEqual(
      { w: r.d.engpaesse[0].wirkstoff, s: r.d.engpaesse[0].status, h: r.d.engpaesse[0].herkunft, q: /^BASG/.test(r.d.engpaesse[0].quelle) },
      { w: 'Amoxicillin', s: 'kritisch', h: 'behoerde', q: true });
    assert.ok(r.d.stand, 'Stand des letzten Abrufs fehlt');
    assert.match(r.d.hinweis, /nicht amtlich/);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.equal((await req('GET', '/api/v1/engpaesse?land=DE', '', null, { 'x-api-key': k.schluessel })).d.anzahl, 0);
    assert.equal((await req('GET', '/api/v1/engpaesse?land=XX', '', null, A)).status, 400);

    // Excel: Schlüssel in der Adresse, CSV mit BOM.
    const c = await fetch(`${B}/api/v1/engpaesse?land=AT&format=csv&key=${encodeURIComponent(k.schluessel)}`);
    assert.match(c.headers.get('content-type'), /text\/csv/);
    const roh = Buffer.from(await c.arrayBuffer());
    assert.deepEqual([...roh.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'BOM fehlt — Excel zeigt Umlaute sonst kaputt');
    const text = roh.toString('utf8');
    assert.ok(text.startsWith('\uFEFFwirkstoff;wirkstoff_schluessel;bezeichnung;land;status'));
    assert.match(text, /\r\nAmoxicillin;[^;]*;Amoxicillin 1000 mg;AT;kritisch;/);
    // POST nimmt den Schlüssel NICHT aus der Adresse.
    assert.equal((await fetch(`${B}/api/v1/pruefen?key=${k.schluessel}`, { method: 'POST', body: '{}' })).status, 401);

    // Listenprüfung: Schreibweise der Warenwirtschaft, Kombination nicht als Monopräparat.
    r = await req('POST', '/api/v1/pruefen', '', { land: 'AT', wirkstoffe: ['AMOXICILLIN 1000MG FTBL', 'Ibuprofen 400 mg'] }, A);
    assert.equal(r.status, 200);
    const amox = r.d.ergebnisse.find((e) => /AMOXICILLIN/.test(e.eingabe));
    assert.equal(amox.einstufung, 'knapp');
    assert.equal(amox.herkunft, 'behoerde');
    assert.match(amox.quelle, /^BASG/);
    r = await req('GET', '/api/v1/pruefen?land=AT&wirkstoffe=Amoxicillin;Ibuprofen&format=csv', '', null, A);
    assert.match(r.d, /^eingabe;wirkstoff;einstufung/); // fetch().text() entfernt das BOM
    // Gleicher Wirkstoff zweimal: JSON fasst zusammen (`auch`), CSV gibt jede Zeile zurück.
    r = await req('POST', '/api/v1/pruefen', '', { land: 'AT', wirkstoffe: ['Amoxicillin 1000 mg', 'Amoxicillin Saft'] }, A);
    assert.deepEqual(r.d.ergebnisse.find((e) => e.wirkstoff === 'Amoxicillin').auch, ['Amoxicillin Saft']);
    r = await req('GET', '/api/v1/pruefen?land=AT&wirkstoffe=Amoxicillin 1000 mg;Amoxicillin Saft&format=csv', '', null, A);
    assert.equal(r.d.trim().split(/\r?\n/).length, 3, 'Kopf + zwei Zeilen');
    assert.equal((await req('GET', '/api/v1/status', '', null, A)).d.ok, true);
    assert.equal((await req('GET', '/api/v1/gibtsnicht', '', null, A)).status, 404);

    // Anfragen werden gezählt; widerrufen sperrt sofort.
    const nachher = (await req('GET', '/api/daten-api/schluessel', gh)).d.schluessel[0];
    assert.ok(nachher.anfragen >= 8 && nachher.zuletzt);
    assert.equal((await req('DELETE', `/api/daten-api/schluessel/${k.id}`, gh)).status, 200);
    assert.equal((await req('GET', '/api/v1/status', '', null, A)).status, 401);

    // Konto löschen: neue Schlüssel des Kontos gelten nicht weiter.
    const k2 = (await req('POST', '/api/daten-api/schluessel', gh, { name: 'Excel' })).d.schluessel;
    assert.equal((await req('GET', '/api/v1/status', '', null, { 'x-api-key': k2.schluessel })).status, 200);
    assert.equal((await req('POST', '/api/me/delete', gh, { password: 'Passwort123!' })).status, 200);
    assert.equal((await req('GET', '/api/v1/status', '', null, { 'x-api-key': k2.schluessel })).status, 401);
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
    behoerde.close();
  }
});
