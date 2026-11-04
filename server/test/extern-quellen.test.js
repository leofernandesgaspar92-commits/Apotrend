// Externe Schnittstellen (services/extern/): Zwischenspeicher, Zeitlimit, Rückfall auf den gesicherten
// Stand, Antworten im Format der Anbieter (World Bank, Open-Meteo, Frankfurter, AISStream).
// Die Bauumgebung erreicht die Anbieter nicht — die Antworten sind nach deren Dokumentation
// nachgebildet (Typen: src/services/extern/typen.d.ts). Live-Status zeigt das Betriebs-Cockpit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createExternerSpeicher, createAbruf } from '../src/services/extern/abruf.js';
import { createWeltbank, lpiLesen } from '../src/services/extern/weltbank.js';
import { createHafenWetter, wetterLesen, HAEFEN } from '../src/services/extern/wetter.js';
import { createAisStream, aisAbo } from '../src/services/extern/aisstream.js';
import { createFxRates } from '../src/services/fxRates.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const antwort = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

// ── Abruf-Baustein ─────────────────────────────────────────────────────────

test('Abruf: Zwischenspeicher, ein Abruf für gleichzeitige Anfragen, Rückfall auf gesicherten Stand', async () => {
  let uhr = 1_000_000, aufrufe = 0, modus = 'ok';
  const fetchImpl = async () => { aufrufe++; await new Promise((r) => setTimeout(r, 5)); if (modus === 'weg') throw new Error('ECONNREFUSED'); if (modus === '500') return antwort({}, 500); return antwort({ wert: aufrufe }); };
  const speicher = createExternerSpeicher({ jetzt: () => uhr });
  const a = createAbruf({ name: 'q', quelle: 'Q', link: 'https://q', ttlMs: 60_000, speicher, fetchImpl, jetzt: () => uhr });
  const lesen = (j) => j.wert;
  const [x, y] = await Promise.all([a.holen('k', 'https://q/1', lesen), a.holen('k', 'https://q/1', lesen)]);
  assert.equal(aufrufe, 1, 'gleichzeitige Anfragen nicht zusammengelegt');
  assert.deepEqual([x.aus, x.daten, y.daten], ['live', 1, 1]);
  assert.equal((await a.holen('k', 'https://q/1', lesen)).aus, 'zwischenspeicher');
  assert.equal(aufrufe, 1, 'erneut abgerufen trotz frischem Zwischenspeicher');
  uhr += 61_000; modus = 'weg';
  const r = await a.holen('k', 'https://q/1', lesen);
  assert.deepEqual([r.aus, r.daten, r.veraltet], ['gesichert', 1, true]);
  assert.match(r.fehler, /ECONNREFUSED/);
  assert.equal(r.stand, new Date(1_000_000).toISOString(), 'Stand des gesicherten Werts fehlt');
  modus = '500';
  assert.equal((await a.holen('k', 'https://q/1', lesen)).aus, 'gesichert', 'HTTP 500 nicht als Fehler behandelt');
  assert.deepEqual(await a.holen('neu', 'https://q/2', lesen), { daten: null, stand: null, aus: 'keine', veraltet: true, fehler: 'HTTP 500' }, 'ohne gesicherten Stand darf nichts erfunden werden');
  assert.match(a.status().letzter_fehler, /500/);
});

test('Abruf: Zeitlimit, Pause nach 429, kaputte Antwort; gesicherter Stand übersteht einen Neustart', async () => {
  let uhr = 0, aufrufe = 0;
  const haengt = (url, { signal }) => new Promise((_, fail) => { aufrufe++; signal.addEventListener('abort', () => fail(Object.assign(new Error('abgebrochen'), { name: 'AbortError' }))); });
  const s1 = createExternerSpeicher({ jetzt: () => uhr });
  const a = createAbruf({ name: 'q', quelle: 'Q', link: 'x', ttlMs: 1000, speicher: s1, fetchImpl: haengt, zeitlimitMs: 30, jetzt: () => uhr });
  const r = await a.holen('k', 'u', (j) => j);
  assert.equal(r.aus, 'keine'); assert.match(r.fehler, /keine Antwort binnen 30 ms/);
  // 429: Pause, kein weiterer Abruf in dieser Zeit
  aufrufe = 0;
  const b = createAbruf({ name: 'g', quelle: 'G', link: 'x', ttlMs: 1000, speicher: s1, fetchImpl: async () => { aufrufe++; return antwort({}, 429); }, jetzt: () => uhr });
  await b.holen('k', 'u', (j) => j); await b.holen('k', 'u', (j) => j);
  assert.equal(aufrufe, 1, 'nach 429 trotzdem weiter abgefragt');
  assert.ok(b.status().pause_bis);
  // Kaputte Antwort (lesen wirft) → kein Speichern
  const c = createAbruf({ name: 'c', quelle: 'C', link: 'x', ttlMs: 1000, speicher: s1, fetchImpl: async () => antwort({ unsinn: true }), jetzt: () => uhr });
  assert.equal((await c.holen('k', 'u', () => { throw new Error('keine Tageswerte'); })).aus, 'keine');
  // Neustart: gesicherter Stand aus der Sicherung (Datenbank) → Rückfall funktioniert sofort
  const d = createAbruf({ name: 'w', quelle: 'W', link: 'x', ttlMs: 1000, speicher: s1, fetchImpl: async () => antwort({ v: 7 }), jetzt: () => uhr });
  await d.holen('GH', 'u', (j) => j.v);
  const s2 = createExternerSpeicher({ jetzt: () => uhr });
  s2.__load(JSON.parse(JSON.stringify(s1.__dump())));
  uhr += 5000;
  const e = createAbruf({ name: 'w', quelle: 'W', link: 'x', ttlMs: 1000, speicher: s2, fetchImpl: async () => { throw new Error('offline'); }, jetzt: () => uhr });
  const nach = await e.holen('GH', 'u', (j) => j.v);
  assert.deepEqual([nach.aus, nach.daten], ['gesichert', 7], 'nach Neustart kein Rückfall auf den gesicherten Stand');
  s2.__load([['x', null], 'kaputt', null]); assert.equal(s2.groesse, 0, 'kaputte Sicherung übernommen');
});

// ── World Bank ─────────────────────────────────────────────────────────────

const WB_GH = [
  { page: 1, pages: 1, per_page: 50, total: 2, sourceid: '2', lastupdated: '2025-07-01' },
  [
    { indicator: { id: 'LP.LPI.OVRL.XQ', value: 'Logistics performance index: Overall (1=low to 5=high)' }, country: { id: 'GH', value: 'Ghana' }, countryiso3code: 'GHA', date: '2023', value: 2.9, unit: '', obs_status: '', decimal: 2 },
    { indicator: { id: 'LP.LPI.OVRL.XQ', value: '…' }, country: { id: 'GH', value: 'Ghana' }, countryiso3code: 'GHA', date: '2018', value: 2.57, unit: '', obs_status: '', decimal: 2 },
  ],
];

test('World Bank: jüngster LPI-Wert mit Jahr; Fehlerantwort, leere Liste, Unsinn', async () => {
  assert.deepEqual(lpiLesen(WB_GH, 'GH'), { land: 'GH', wert: 2.9, jahr: '2023', skala: '1–5', link: 'https://data.worldbank.org/indicator/LP.LPI.OVRL.XQ?locations=GH' });
  assert.throws(() => lpiLesen([{ message: [{ id: '120', key: 'Invalid value', value: 'The provided parameter value is not valid' }] }], 'GH'), /not valid/);
  assert.equal(lpiLesen([{ page: 1, pages: 0, per_page: 50, total: 0 }, null], 'SS'), null, 'Land ohne Erhebung: kein Wert, kein Fehler');
  assert.throws(() => lpiLesen([WB_GH[0], [{ ...WB_GH[1][0], value: 9.5 }]], 'GH'), /außerhalb/);
  const urls = [];
  const wb = createWeltbank({ speicher: createExternerSpeicher(), fetchImpl: async (u) => { urls.push(u); return antwort(WB_GH); } });
  const r = await wb.logistikIndex('gh');
  assert.equal(r.daten.wert, 2.9);
  assert.match(urls[0], /^https:\/\/api\.worldbank\.org\/v2\/country\/GH\/indicator\/LP\.LPI\.OVRL\.XQ\?format=json&mrnev=1/);
  assert.equal((await wb.logistikIndex('../x')).daten, null);
  assert.equal(urls.length, 1, 'ungültiges Land trotzdem abgefragt');
});

// ── Open-Meteo ─────────────────────────────────────────────────────────────

const OM_TEMA = {
  latitude: 5.625, longitude: 0, generationtime_ms: 0.1, utc_offset_seconds: 0, timezone: 'GMT', elevation: 10,
  daily_units: { time: 'iso8601', precipitation_sum: 'mm', wind_speed_10m_max: 'km/h', wind_gusts_10m_max: 'km/h' },
  daily: { time: ['2026-11-01', '2026-11-02', '2026-11-03'], precipitation_sum: [12.43, 63.0, null], wind_speed_10m_max: [20.1, 41.3, 18], wind_gusts_10m_max: [44.6, 80.2, 39.9] },
};

test('Open-Meteo: drei Tage, Hinweise nur über den Schwellen; URL mit Koordinaten', async () => {
  const w = wetterLesen(OM_TEMA);
  assert.deepEqual(w.tage[0], { datum: '2026-11-01', regen_mm: 12.4, wind_kmh: 20.1, boeen_kmh: 44.6 });
  assert.equal(w.tage[2].regen_mm, null, 'fehlender Wert erfunden');
  assert.deepEqual(w.hinweise, [{ datum: '2026-11-02', art: 'starkregen', wert: 63 }, { datum: '2026-11-02', art: 'sturm', wert: 80.2 }]);
  assert.throws(() => wetterLesen({ error: true, reason: 'Latitude must be in range' }), /keine Tageswerte/);
  const urls = [];
  const hw = createHafenWetter({ speicher: createExternerSpeicher(), fetchImpl: async (u) => { urls.push(u); return antwort(OM_TEMA); } });
  const tema = HAEFEN.find((h) => h.id === 'tema');
  assert.equal((await hw.fuerHafen(tema)).daten.hinweise.length, 2);
  assert.match(urls[0], /^https:\/\/api\.open-meteo\.com\/v1\/forecast\?latitude=5\.63&longitude=0\.017&daily=precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max&forecast_days=3/);
  assert.deepEqual(HAEFEN.map((h) => h.id).slice(0, 4), ['koper', 'rotterdam', 'tema', 'lagos'], 'die vier gewünschten Häfen fehlen');
});

// ── Frankfurter (Rückfall für Wechselkurse) ────────────────────────────────

test('Wechselkurse: fällt die Hauptquelle aus, EZB-Kurse (Frankfurter) — afrikanische Währungen aus letztem Stand, nie erfunden', async () => {
  let haupt = true; const urls = []; let uhr = 0;
  const fetchImpl = async (u) => {
    urls.push(u);
    if (u.includes('er-api')) { if (!haupt) throw new Error('offline'); return antwort({ result: 'success', rates: { EUR: 1, USD: 1.08, NGN: 1650, GHS: 16.2 }, time_last_update_unix: 1_790_000_000 }); }
    return antwort({ amount: 1, base: 'EUR', date: '2026-10-31', rates: { USD: 1.09, ZAR: 19.8 } });
  };
  const fx = createFxRates({ fetchImpl, ttlMs: 1000, now: () => uhr });
  assert.equal((await fx.rates()).rates.NGN, 1650);
  haupt = false; uhr += 2000;
  const d = await fx.rates();
  assert.equal(d.quelle, 'EZB (Frankfurter)');
  assert.equal(d.rates.USD, 1.09); assert.equal(d.rates.ZAR, 19.8);
  assert.equal(d.rates.NGN, 1650, 'afrikanische Währung aus letztem Stand fehlt');
  assert.ok(urls.some((u) => u === 'https://api.frankfurter.app/latest?from=EUR'));
  const leer = createFxRates({ fetchImpl: async (u) => (u.includes('er-api') ? Promise.reject(new Error('x')) : antwort({ amount: 1, base: 'EUR', date: '2026-10-31', rates: { USD: 1.09 } })) });
  const l = await leer.rates();
  assert.equal(l.rates.NGN, undefined, 'Kurs ohne Quelle erfunden');
});

// ── AISStream ──────────────────────────────────────────────────────────────

const pos = (mmsi, lat, lon, sog, nav) => JSON.stringify({ MessageType: 'PositionReport', MetaData: { MMSI: mmsi, ShipName: 'TEST', latitude: lat, longitude: lon, time_utc: '2026-11-01 08:00:00' }, Message: { PositionReport: { Sog: sog, NavigationalStatus: nav, UserID: mmsi } } });

test('AISStream: Abo-Format, Zählung je Hafen (vor Anker/festgemacht/in Fahrt), alte und fremde Meldungen raus', () => {
  const tema = HAEFEN.find((h) => h.id === 'tema');
  const abo = aisAbo('KEY', [tema]);
  assert.equal(abo.APIKey, 'KEY');
  assert.deepEqual(abo.FilterMessageTypes, ['PositionReport']);
  assert.ok(Math.abs(abo.BoundingBoxes[0][0][0] - (5.63 - 0.15)) < 1e-9 && Math.abs(abo.BoundingBoxes[0][1][1] - (0.017 + 0.15)) < 1e-9);
  let uhr = 10_000_000;
  const a = createAisStream({ apiKey: 'KEY', haefen: HAEFEN, WebSocketImpl: null, jetzt: () => uhr });
  assert.equal(a.verarbeite(pos(1, 5.60, 0.02, 0.1, 1)), true);   // vor Anker
  assert.equal(a.verarbeite(pos(2, 5.64, 0.00, 0, 5)), true);     // festgemacht
  assert.equal(a.verarbeite(pos(3, 5.70, 0.10, 12.5, 0)), true);  // in Fahrt
  assert.equal(a.verarbeite(pos(4, 5.61, 0.01, 0.2, 15)), true);  // langsam, ohne Status → wartend
  assert.equal(a.verarbeite(pos(5, 40.0, 10.0, 3, 0)), false, 'Meldung außerhalb aller Häfen gezählt');
  assert.equal(a.verarbeite('kein json'), false);
  assert.equal(a.verarbeite(Buffer.from(pos(1, 5.60, 0.02, 0.1, 1))), true, 'Nachricht als Bytes nicht gelesen');
  assert.deepEqual({ ...a.lage('tema'), stand: null }, { im_gebiet: 4, vor_anker: 2, festgemacht: 1, in_fahrt: 1, stand: null });
  uhr += 3 * 60 * 60_000;
  assert.equal(a.lage('tema').im_gebiet, 0, 'Meldungen älter als 2 Stunden gezählt');
  a.verarbeite(JSON.stringify({ error: 'Api Key Is Not Valid' }));
  assert.match(a.status().letzter_fehler, /Not Valid/);
});

test('AISStream: ohne Schlüssel aus (keine Verbindung); mit Schlüssel abonnieren und nach Abbruch neu verbinden', () => {
  let erstellt = 0;
  class FalscherWS { constructor(url) { erstellt++; this.url = url; this.gesendet = []; FalscherWS.letzter = this; } send(d) { this.gesendet.push(d); } close() { this.onclose && this.onclose(); } }
  const aus = createAisStream({ apiKey: '', haefen: HAEFEN, WebSocketImpl: FalscherWS });
  aus.start();
  assert.equal(erstellt, 0); assert.equal(aus.aktiv, false); assert.equal(aus.lage('tema'), null);
  assert.match(aus.status().letzter_fehler, /AISSTREAM_API_KEY nicht gesetzt/);
  const geplant = [];
  const an = createAisStream({ apiKey: 'KEY', haefen: HAEFEN, WebSocketImpl: FalscherWS, setTimeoutImpl: (fn, ms) => { geplant.push(ms); return null; } });
  an.start();
  assert.equal(FalscherWS.letzter.url, 'wss://stream.aisstream.io/v0/stream');
  FalscherWS.letzter.onopen();
  assert.equal(JSON.parse(FalscherWS.letzter.gesendet[0]).APIKey, 'KEY');
  assert.equal(an.status().verbunden, true);
  FalscherWS.letzter.onclose();
  assert.equal(an.status().verbunden, false);
  assert.deepEqual(geplant, [5000], 'nach Abbruch kein neuer Versuch geplant');
  const kaputt = createAisStream({ apiKey: 'KEY', haefen: HAEFEN, WebSocketImpl: class { constructor() { throw new Error('kein Netz'); } }, setTimeoutImpl: (fn, ms) => { geplant.push(ms); } });
  assert.doesNotThrow(() => kaputt.start());
  assert.equal(geplant.at(-1), 5000);
});

// ── Ende zu Ende ───────────────────────────────────────────────────────────

test('Server: Häfen, Logistik-Index, Status — ohne Netz kein Absturz, ehrlich „nicht verfügbar"; Sicherung enthält den Speicher', { timeout: 60000 }, async () => {
  const src = readFileSync(join(ROOT, 'src', 'http', 'server.js'), 'utf8');
  assert.match(src, /extern: externerSpeicher\.__dump\(\)/, 'gesicherter Stand wandert nicht mit in die Datenbank');
  assert.match(src, /externerSpeicher\.__load\(snap\.extern\)/);
  const kind = spawn(process.execPath, [join(ROOT, 'src', 'http', 'server.js')], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'ext-1', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus', APOPULSE_EXTERN_AUS: '1', AISSTREAM_API_KEY: '', DATABASE_URL: '',
      APOPULSE_ADMIN_EMAIL: 'red@ext.test', APOPULSE_ADMIN_PASSWORD: 'ext-test-PW-123' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  try {
    const port = await new Promise((ok, fail) => {
      const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
      const l = (d) => { log += d; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
      kind.stdout.on('data', l); kind.stderr.on('data', l);
    });
    const B = `http://localhost:${port}`; const H = { 'content-type': 'application/json' };
    const tok = (await (await fetch(B + '/api/register', { method: 'POST', headers: H, body: JSON.stringify({ name: 'Ama', email: 'a@ext.test', password: 'Passwort-1234', country: 'GH', accountType: 'pharmacy' }) })).json()).token;
    const A = { authorization: 'Bearer ' + tok };
    const h = await (await fetch(B + '/api/logistik/haefen', { headers: A })).json();
    assert.equal(h.haefen.length, HAEFEN.length);
    assert.match(h.hinweis, /keine Aussage über einzelne Lieferungen oder Engpässe/);
    assert.equal(h.haefen[0].wetter.verfuegbar, false); assert.deepEqual(h.haefen[0].wetter.tage, []);
    assert.equal(h.haefen[0].schiffe, null, 'ohne Schlüssel keine Schiffsdaten vorgetäuscht');
    const lpi = await fetch(B + '/api/laender/GH/logistik-index', { headers: A });
    assert.equal(lpi.status, 200);
    const lj = await lpi.json();
    assert.equal(lj.index, null); assert.equal(lj.veraltet, true);
    assert.equal((await fetch(B + '/api/laender/XX/logistik-index', { headers: A })).status, 404);
    assert.equal((await fetch(B + '/api/extern/status', { headers: A })).status, 403, 'Status für alle offen');
    const red = (await (await fetch(B + '/api/login', { method: 'POST', headers: H, body: JSON.stringify({ email: 'red@ext.test', password: 'ext-test-PW-123' }) })).json()).token;
    const st = await (await fetch(B + '/api/extern/status', { headers: { authorization: 'Bearer ' + red } })).json();
    assert.deepEqual(st.quellen.map((q) => q.name), ['weltbank', 'openmeteo', 'aisstream', undefined, 'wechselkurse', 'openfda_zulassungen', 'clinicaltrials', 'who_ausbrueche'].map((n, i) => n ?? st.quellen[i].name));
    assert.match(st.quellen.find((q) => q.name === 'openmeteo').letzter_fehler, /abgeschaltet/);
    const b = await (await fetch(B + '/api/betrieb', { headers: { authorization: 'Bearer ' + red } })).json();
    assert.equal(b.extern.length, 8); // + openFDA, ClinicalTrials.gov, WHO (Sprint 5)
    // Größe der Sicherung (11/2026): erledigte Apotheken-Meldungen verfallen bisher nie — der Betreiber
    // soll das Wachstum sehen, bevor es teuer wird.
    assert.equal(typeof b.sicherung.roh_mb, 'number'); assert.ok(b.sicherung.roh_mb >= 0);
    assert.equal(typeof b.sicherung.dauer_ms, 'number');
    assert.deepEqual([typeof b.sicherung.apotheken_meldungen, typeof b.sicherung.erledigt, b.sicherung.hinweis], ['number', 'number', false]);
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});

test('Cockpit: Hinweis auf Aufbewahrungsregel ab 50 MB Sicherung, Zeile in 5 Sprachen', () => {
  const server = readFileSync(join(ROOT, 'src', 'http', 'server.js'), 'utf8');
  assert.match(server, /const SICHERUNG_HINWEIS_MB = 50;/);
  assert.match(server, /hinweis: roh \/ 1e6 >= SICHERUNG_HINWEIS_MB/);
  const app = readFileSync(join(ROOT, 'public', 'app.js'), 'utf8');
  assert.match(app, /data-btsicherung>/); assert.match(app, /b\.sicherung\.hinweis \? `<div data-btsicherunghinweis/);
});
