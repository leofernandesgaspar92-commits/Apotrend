// Sprint 4 — Datenwahrheit: Kurse mit Quelle je Währung und Rückfall aus der Datenbank,
// keine erfundenen Preise/Aktionen im Live-Betrieb, Wirkstoff-Schreibweise nur als Vorschlag.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFxRates, QUELLE_EZB, QUELLE_ER } from '../src/services/fxRates.js';
import { createCryptoRates } from '../src/services/cryptoRates.js';
import { demoAktionenErlaubt } from '../src/services/deals.js';
import { createRxNormService } from '../src/services/rxnorm.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const antwort = (j) => ({ ok: true, status: 200, json: async () => j });
const ER = { result: 'success', rates: { EUR: 1, USD: 1.08, NGN: 1650, GHS: 16.2 }, time_last_update_unix: 1_790_000_000 };
const EZB = { amount: 1, base: 'EUR', date: '2026-10-31', rates: { USD: 1.09, ZAR: 19.8 } };

test('Wechselkurse: EZB hat Vorrang, open.er-api ergänzt; Quelle je Währung', async () => {
  const fx = createFxRates({ fetchImpl: async (u) => antwort(u.includes('er-api') ? ER : EZB) });
  const d = await fx.rates();
  assert.equal(d.rates.USD, 1.09, 'EZB-Kurs hat keinen Vorrang');
  assert.equal(d.rates.NGN, 1650);
  assert.deepEqual([d.quellen.USD, d.quellen.ZAR, d.quellen.NGN], [QUELLE_EZB, QUELLE_EZB, QUELLE_ER]);
  assert.equal(d.veraltet, false);
  assert.equal(d.quelle, `${QUELLE_EZB} + ${QUELLE_ER}`);
});

test('Wechselkurse: Neustart ohne Netz → letzter Stand aus der Sicherung, als veraltet gekennzeichnet; ohne Sicherung null', async () => {
  const a = createFxRates({ fetchImpl: async (u) => antwort(u.includes('er-api') ? ER : EZB) });
  await a.rates();
  const gesichert = JSON.parse(JSON.stringify(a.__dump()));
  const b = createFxRates({ fetchImpl: async () => { throw new Error('offline'); } });
  b.__load(gesichert);
  const d = await b.rates();
  assert.equal(d.rates.NGN, 1650, 'gesicherter Kurs nicht genutzt');
  assert.equal(d.veraltet, true, 'gesicherter Stand nicht als veraltet gekennzeichnet');
  assert.equal(b.istVeraltet(d), true);
  const c = createFxRates({ fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal(await c.rates(), null, 'Kurs ohne Quelle erfunden');
  b.__load({ data: { rates: 'kaputt' } }); // kaputte Sicherung wird ignoriert
  assert.equal((await b.rates()).rates.NGN, 1650);
});

test('Krypto-Kurse: letzter guter Kurs übersteht Neustart (Sicherung), wird aber neu abgefragt', async () => {
  let uhr = 1_000_000;
  const a = createCryptoRates({ fetchImpl: async () => antwort({ tether: { eur: 0.92 }, tron: { eur: 0.21 } }), now: () => uhr });
  await a.ratesEur(['tether', 'tron']);
  const gesichert = JSON.parse(JSON.stringify(a.__dump()));
  let versuche = 0;
  const b = createCryptoRates({ fetchImpl: async () => { versuche++; throw new Error('offline'); }, now: () => uhr + 3_600_000 });
  b.__load(gesichert);
  assert.deepEqual(await b.ratesEur(['tether', 'tron']), { tether: 0.92, tron: 0.21 });
  assert.equal(versuche, 1, 'gesicherter Kurs galt als frisch — kein neuer Abruf');
  b.__load([['x', { eur: -1, at: 1 }], 'kaputt']);
  assert.deepEqual(await b.ratesEur(['x']), {}, 'ungültiger Kurs übernommen');
});

test('Demo-Aktionen: nie im Live-Betrieb (Render/Produktion), nie im Test, nur mit Referenzdaten', () => {
  assert.equal(demoAktionenErlaubt({ RENDER: 'true' }, true), false);
  assert.equal(demoAktionenErlaubt({ NODE_ENV: 'production' }, true), false);
  assert.equal(demoAktionenErlaubt({ NODE_ENV: 'test' }, true), false);
  assert.equal(demoAktionenErlaubt({}, false), false);
  assert.equal(demoAktionenErlaubt({ APOPULSE_DEMO_DEALS: 'off' }, true), false);
  assert.equal(demoAktionenErlaubt({ NODE_ENV: 'development' }, true), true);
});

test('RxNorm-Schreibweise: bekannt → keine Vorschläge; Tippfehler → Vorschläge; Netzfehler → „weiß nicht", nicht gemerkt', async () => {
  let netz = true; const urls = [];
  const fetchImpl = async (u) => {
    urls.push(u);
    if (!netz) throw new Error('offline');
    if (u.includes('/rxcui.json')) return antwort(u.includes('name=Amoxicillin&') ? { idGroup: { rxnormId: ['723'] } } : { idGroup: {} });
    return antwort({ suggestionGroup: { name: 'x', suggestionList: { suggestion: ['amoxicillin', 'Amoxicilin', 'amoxapine', 'a', 'b'] } } });
  };
  const rx = createRxNormService({ fetchImpl, log: { warn() {} } });
  assert.deepEqual(await rx.schreibweise('Amoxicillin'), { bekannt: true, vorschlaege: [] });
  const t = await rx.schreibweise('Amoxicilin');
  assert.equal(t.bekannt, false);
  assert.deepEqual(t.vorschlaege, ['amoxicillin', 'amoxapine', 'a'], 'Eingabe selbst als Vorschlag oder mehr als 3');
  netz = false;
  assert.deepEqual(await rx.schreibweise('Paracetamoll'), { bekannt: null, vorschlaege: [] });
  netz = true;
  assert.equal((await rx.schreibweise('Paracetamoll')).bekannt, false, 'Netzfehler wurde als Ergebnis gemerkt');
  assert.deepEqual(await rx.schreibweise('ab'), { bekannt: null, vorschlaege: [] }, 'zu kurz trotzdem abgefragt');
});

test('HTTP: Quellen aus → Kurse ehrlich „nicht verfügbar" bzw. gesicherter Stand; keine Preise erfunden; Schreibweise aus eigenem Verzeichnis', { timeout: 60000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'apo-di-'));
  const datei = join(dir, 'stand.json');
  const starte = (env) => {
    const kind = spawn(process.execPath, [join(ROOT, 'src', 'http', 'server.js')], {
      env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'di-1', APOPULSE_PRESSE: 'aus', APOPULSE_EXTERN_AUS: '1', APOPULSE_RXNORM: 'off', DATABASE_URL: '', APOPULSE_DATA_FILE: '', APOPULSE_FEATURE_WAEHRUNGSRECHNER: 'an', ...env },
      stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    const port = new Promise((ok, fail) => {
      const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
      const l = (d) => { log += d; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
      kind.stdout.on('data', l); kind.stderr.on('data', l);
    });
    return { kind, port };
  };
  const ende = (kind) => new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  const konto = async (B) => (await (await fetch(B + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Ada', email: 'ada@di.test', password: 'Passwort-1234', country: 'NG', accountType: 'pharmacy' }) })).json()).token;
  // 1) Ohne Netz, ohne Sicherung
  let s = starte({});
  try {
    const B = `http://localhost:${await s.port}`; const tok = await konto(B); const A = { authorization: 'Bearer ' + tok, 'content-type': 'application/json' };
    const fx = await (await fetch(B + '/api/fx-rates', { headers: A })).json();
    assert.deepEqual([fx.rates, fx.veraltet], [null, true], 'Kurse ohne Quelle angezeigt');
    const pr = await (await fetch(B + '/api/prices?country=NG', { headers: A })).json();
    assert.deepEqual(pr.comparisons, [], 'Preise für Nigeria ohne Lieferantendaten erfunden');
    await fetch(B + '/api/shortages/report', { method: 'POST', headers: A, body: JSON.stringify({ wirkstoff: 'Amoxicillin', bezeichnung: 'Amoxicillin 500 mg', status: 'kritisch', country: 'NG' }) });
    const sw = await (await fetch(B + '/api/wirkstoff-pruefen?name=Amoxicilin', { headers: A })).json();
    assert.deepEqual(sw.vorschlaege, [{ name: 'Amoxicillin', quelle: 'ApoPulse' }], 'Tippfehler nicht auf geführten Namen gelenkt');
    const ok = await (await fetch(B + '/api/wirkstoff-pruefen?name=Amoxicillin', { headers: A })).json();
    assert.deepEqual([ok.bekannt, ok.vorschlaege], [true, []]);
    const unbekannt = await (await fetch(B + '/api/wirkstoff-pruefen?name=Xyzolin', { headers: A })).json();
    assert.deepEqual(unbekannt.vorschlaege, [], 'ohne RxNorm etwas vorgeschlagen');
  } finally { await ende(s.kind); }
  // 2) Neustart ohne Netz, aber mit gesichertem Kurs-Stand
  writeFileSync(datei, JSON.stringify({ kurse: { fx: { data: { base: 'EUR', rates: { EUR: 1, NGN: 1650, USD: 1.09 }, quellen: { NGN: QUELLE_ER, USD: QUELLE_EZB }, updated_at: Date.now() - 3 * 86400000, quelle: QUELLE_ER } }, krypto: [['tether', { at: 1, eur: 0.92 }]] } }));
  s = starte({ APOPULSE_DATA_FILE: datei });
  try {
    const B = `http://localhost:${await s.port}`; const tok = await konto(B);
    const fx = await (await fetch(B + '/api/fx-rates', { headers: { authorization: 'Bearer ' + tok } })).json();
    assert.equal(fx.rates.NGN, 1650, 'gesicherter Kurs nach Neustart weg');
    assert.equal(fx.veraltet, true, 'gesicherter Kurs nicht als veraltet gekennzeichnet');
    assert.equal(fx.quellen.NGN, QUELLE_ER);
    await ende(s.kind); // beim Beenden wird gesichert
    const gesichert = JSON.parse(readFileSync(datei, 'utf8'));
    assert.equal(gesichert.kurse && gesichert.kurse.fx && gesichert.kurse.fx.data.rates.NGN, 1650, 'Wechselkurse wandern nicht in die Sicherung');
    assert.deepEqual(gesichert.kurse.krypto, [['tether', { at: 1, eur: 0.92 }]], 'Krypto-Kurse wandern nicht in die Sicherung');
  } finally { await ende(s.kind); rmSync(dir, { recursive: true, force: true }); }
});
