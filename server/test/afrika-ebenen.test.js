// Afrika-Start und drei Ebenen (Land / Region / Welt).
//
// Eine englischsprachige Apotheke in Uganda soll nationale, afrikanische und
// weltweite Informationen sehen — jede mit Herkunft. Und: Meldungen von
// Quell-Regionen (EMA, Africa CDC, WHO) erscheinen nie als Meldung eines
// einzelnen Landes (bis 10/2026 landete jede EMA-Meldung im österreichischen Feed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRIES, laenderInRegion, regionVon } from '../src/data/countries.js';
import { activeSources } from '../src/services/sources.js';
import { complianceProfile, paymentMethodsFor } from '../src/domain/compliance.js';
import { regionLage } from '../src/services/regionLage.js';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'http', 'server.js');
const ANGLO_AFRIKA = ['NG', 'KE', 'GH', 'ZA', 'UG', 'TZ', 'ZM', 'ZW', 'RW', 'BW', 'NA', 'MW', 'ET', 'SL', 'LR', 'GM'];

test('Englischsprachiges Afrika: Land, Sprache, Währung, Behörde, Quelle, Krypto', () => {
  const quellen = new Set(activeSources({}).map((s) => s.country));
  for (const cc of ANGLO_AFRIKA) {
    const c = COUNTRIES[cc];
    assert.ok(c, `${cc} fehlt im Register`);
    assert.equal(c.locale_default, 'en', cc);
    assert.equal(c.region, 'AFRICA', cc);
    assert.ok(c.regulator, `${cc} ohne Behörde`);
    assert.ok(quellen.has(cc), `${cc} ohne Quelle`);
    assert.equal(complianceProfile(cc).currency, c.currency, `${cc}: Zahlprofil mit falscher Währung`);
    assert.ok(paymentMethodsFor(cc).some((m) => m.rail === 'crypto'), `${cc} ohne Krypto`);
  }
  // Neue Länder ohne geprüfte Rechtsanalyse: keine Marktplatz-Gebühren.
  assert.equal(complianceProfile('UG').transactionFeeAllowed, false);
  // Zweite Welle 10/2026 (Owner: alle afrikanischen Länder) — je Land geprüft in afrika-alle-laender.test.js.
  const FRANKO = ['SN', 'CI', 'CM', 'CD', 'CG', 'GA', 'BF', 'ML', 'NE', 'TD', 'CF', 'BJ', 'TG', 'GN', 'MG', 'BI', 'DJ', 'KM', 'MR', 'MA', 'DZ', 'TN'];
  const VIERTE = ['EG', 'LY', 'SD', 'SO', 'GQ'];
  assert.deepEqual(laenderInRegion('AFRICA').sort(), [...ANGLO_AFRIKA, 'AO', 'MZ', 'LS', 'SZ', 'MU', 'SC', 'SS', 'ER', 'CV', 'GW', 'ST', ...FRANKO, ...VIERTE].sort());
  assert.equal(regionVon('AFR'), 'AFRICA');
  assert.equal(regionVon('INT'), null);
  // Quell-Regionen haben eigene Quellen.
  assert.ok(quellen.has('AFR') && quellen.has('INT'));
});

test('Engpasslage je Region: amtlich und Apotheken getrennt, Mehrländer-Signal über Sprachen', () => {
  const zeilen = [
    { wirkstoff: 'Amoxicillin', status: 'kritisch', country: 'KE', provenance: 'verified', quelle: 'PPB' },
    { wirkstoff: 'Amoxicilina', status: 'eingeschraenkt', country: 'MZ', provenance: 'verified', quelle: 'ANARME' },
    { wirkstoff: 'Ibuprofen', status: 'eingeschraenkt', country: 'KE', provenance: 'verified', quelle: 'PPB' },
    { wirkstoff: 'Salbutamol', status: 'kritisch', country: 'UG', provenance: 'community', reporter_user_id: 'u1' },
    { wirkstoff: 'Metformin', status: 'verfuegbar', country: 'KE', provenance: 'verified' },
  ];
  const r = regionLage({ shortagesRepo: { list: () => zeilen }, chronik: { aufzeichnungSeit: (cc) => (['KE', 'MZ'].includes(cc) ? '2026-10-01' : null) }, laender: COUNTRIES, codes: laenderInRegion('AFRICA') });
  const ke = r.laender.find((l) => l.land === 'KE'); const ug = r.laender.find((l) => l.land === 'UG');
  assert.deepEqual([ke.amtlich, ke.kritisch, ke.apotheken, ke.behoerdenliste], [2, 1, 0, true]);
  assert.deepEqual([ug.amtlich, ug.apotheken, ug.behoerdenliste], [0, 1, false], 'Apotheken-Meldung als amtlich gezählt');
  assert.equal(r.laender[0].land, 'KE', 'Länder mit Behördenliste zuerst');
  assert.equal(r.mit_behoerdenliste, 2);
  assert.equal(r.mehrere_laender.length, 1);
  assert.deepEqual(r.mehrere_laender[0].laender.map((l) => [l.land, l.quelle]), [['KE', 'PPB'], ['MZ', 'ANARME']], 'Amoxicillin = Amoxicilina nicht erkannt');
});

function rss(titel, link) {
  const d = new Date().toUTCString();
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>x</title><item><title>${titel}</title><link>${link}</link><pubDate>${d}</pubDate><description>${titel}</description></item></channel></rss>`;
}

test('Über HTTP: Uganda sieht Land, Afrika und Welt — jede Meldung mit Herkunft', { timeout: 90000 }, async () => {
  const FEEDS = {
    '/ng.xml': rss('NAFDAC warns about falsified amoxicillin', 'https://nafdac.example/a1'),
    '/afr.xml': rss('Africa CDC update on medicine supply', 'https://africacdc.example/a1'),
    '/who.xml': rss('WHO global medical product alert', 'https://who.example/a1'),
    '/at.xml': rss('BASG informiert über Lieferengpass', 'https://basg.example/a1'),
    '/fda.xml': rss('FDA announces drug shortage update', 'https://fda.example/a1'),
    '/ema.xml': rss('EMA shortage update for Europe', 'https://ema.example/a1'),
  };
  const STRUKTUR = {
    '/basg.json': JSON.stringify({ items: [{ wirkstoff: 'Amoxicillin', bezeichnung: 'Amoxicillin 1000 mg', status: 'nicht lieferbar' }] }),
    '/fda.json': JSON.stringify({ meta: { results: { skip: 0, limit: 1, total: 1 } }, results: [{ generic_name: 'Amoxicillin', status: 'Currently in Shortage' }] }),
  };
  const dienst = http.createServer((req, res) => {
    const p = new URL(req.url, 'http://x').pathname;
    if (FEEDS[p]) { res.writeHead(200, { 'content-type': 'application/rss+xml' }); return res.end(FEEDS[p]); }
    if (STRUKTUR[p]) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(STRUKTUR[p]); }
    res.writeHead(404); res.end();
  });
  await new Promise((ok) => dienst.listen(0, ok));
  const B0 = `http://localhost:${dienst.address().port}`;
  // Alle Quellen aus, nur die nachgestellten an.
  const ziel = { NAFDAC_NEWS: '/ng.xml', AFRICACDC_NEWS: '/afr.xml', WHO_NEWS: '/who.xml', BASG_NEWS: '/at.xml', FDA_NEWS: '/fda.xml', EMA_NEWS: '/ema.xml', BASG_SHORTAGES: '/basg.json', OPENFDA_SHORTAGES: '/fda.json' };
  const env = { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'afrika-test', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus', APOPULSE_REFERENCE_DATA: '',
    APOPULSE_ADMIN_EMAIL: 'red@afr.test', APOPULSE_ADMIN_PASSWORD: 'afrika-test-123', APOPULSE_QUELLEN_LOKAL_ERLAUBT: '1' };
  for (const s of activeSources({})) {
    const id = s.id.toUpperCase();
    env[`APOPULSE_SOURCE_${id}_URL`] = ziel[id] ? B0 + ziel[id] : '';
  }
  const kind = spawn(process.execPath, [SERVER], { env, stdio: ['ignore', 'pipe', 'pipe'] });
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
    const get = async (pfad, t) => (await fetch(B + pfad, { headers: H(t) })).json();
    const red = (await (await fetch(B + '/api/login', { method: 'POST', headers: H(''), body: JSON.stringify({ email: 'red@afr.test', password: 'afrika-test-123' }) })).json()).token;
    const ug = (await (await fetch(B + '/api/register', { method: 'POST', headers: H(''), body: JSON.stringify({ name: 'Kampala Pharmacy', email: 'ug@afr.test', password: 'Passwort123!', country: 'UG', accountType: 'pharmacy' }) })).json()).token;
    const at = (await (await fetch(B + '/api/register', { method: 'POST', headers: H(''), body: JSON.stringify({ name: 'Wien Apotheke', email: 'at@afr.test', password: 'Passwort123!', country: 'AT', accountType: 'pharmacy' }) })).json()).token;
    assert.ok(red && ug && at);

    const run = await fetch(B + '/api/live/run/news', { method: 'POST', headers: H(red) });
    assert.equal(run.status, 200, await run.text());
    const quellen = (n) => n.posts.map((p) => p.country).sort();

    // Uganda: eigenes Land leer (noch keine NDA-Meldung), Afrika: NAFDAC + Africa CDC, Welt: dazu WHO, FDA, EMA.
    const land = await get('/api/news?ebene=land', ug);
    assert.deepEqual(quellen(land), [], 'fremde Meldungen im ugandischen Feed: ' + quellen(land));
    const afrika = await get('/api/news?ebene=region', ug);
    assert.equal(afrika.region, 'AFRICA');
    assert.deepEqual(quellen(afrika), ['AFR', 'NG']);
    const welt = await get('/api/news?ebene=welt&sprache=en', ug);
    assert.deepEqual(quellen(welt), ['AFR', 'EU', 'INT', 'NG', 'US'], 'Welt für Englischsprachige: ' + quellen(welt));
    assert.ok(!quellen(welt).includes('AT'), 'deutschsprachige Behördenmeldung in der englischen Welt-Ansicht');

    // Österreich: EMA NICHT mehr im Landesfeed (der alte Fehler), aber unter Europa.
    assert.deepEqual(quellen(await get('/api/news?ebene=land', at)), ['AT'], 'EMA-Meldung als österreichische Meldung');
    assert.deepEqual(quellen(await get('/api/news?ebene=region', at)), ['AT', 'EU']);

    // Engpasslage: Afrika ohne Behördenlisten (ehrlich), Welt mit Mehrländer-Signal.
    await fetch(B + '/api/shortages/report', { method: 'POST', headers: H(ug), body: JSON.stringify({ wirkstoff: 'Salbutamol', bezeichnung: 'Salbutamol Inhaler', status: 'kritisch', country: 'UG' }) });
    assert.equal((await fetch(B + '/api/live/run/shortages', { method: 'POST', headers: H(red) })).status, 200);
    const la = await get('/api/lage/ebene?ebene=region', ug);
    assert.equal(la.laender.length, laenderInRegion('AFRICA').length);
    const lu = la.laender.find((l) => l.land === 'UG');
    assert.deepEqual([lu.behoerdenliste, lu.amtlich, lu.apotheken], [false, 0, 1]);
    const lw = await get('/api/lage/ebene?ebene=welt', ug);
    const amox = lw.mehrere_laender.find((w) => /amoxicillin/i.test(w.wirkstoff));
    assert.ok(amox, 'Mehrländer-Signal fehlt: ' + JSON.stringify(lw.mehrere_laender));
    assert.deepEqual(amox.laender.map((l) => l.land), ['AT', 'US']);
    assert.ok(amox.laender.every((l) => l.quelle), 'Mehrländer-Signal ohne Quelle');
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
    dienst.close();
  }
});
