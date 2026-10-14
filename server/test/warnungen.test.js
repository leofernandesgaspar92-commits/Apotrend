// Fälschungs- und Rückrufwarnungen in Behördenmeldungen (domain/warnung.js)
// und afrikatypische Vorschläge in den ersten Schritten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { warnTyp } from '../src/domain/warnung.js';
import { ersteSchritte } from '../src/services/ersteSchritte.js';
import { activeSources } from '../src/services/sources.js';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'http', 'server.js');

test('Erkennung: Fälschung vor Rückruf, drei Sprachen, keine Fehlalarme bei „fake news"', () => {
  for (const t of ['NAFDAC alerts the public on falsified Augmentin', 'WHO alert: substandard cough syrups', 'Counterfeit malaria drugs seized', 'Beware of fake drugs in circulation', 'BfArM warnt vor gefälschtem Ozempic', 'INFARMED alerta para medicamentos falsificados'])
    assert.equal(warnTyp(t), 'faelschung', t);
  for (const t of ['Recall of contaminated paracetamol syrup batches', 'PPB recalls insulin pens', 'Chargenrückruf: Ibuprofen 400 mg', 'Recolha voluntária de lotes'])
    assert.equal(warnTyp(t), 'rueckruf', t);
  assert.equal(warnTyp('Falsified batches recalled'), 'faelschung', 'Fälschung hat Vorrang');
  for (const t of ['Minister dismisses fake news about vaccines', 'Workshop on medicine supply chains', 'New guidelines for pharmacy licensing', ''])
    assert.equal(warnTyp(t), null, t);
});

test('Erste Schritte in Afrika: Malaria, Mutter-Kind, HIV, Tuberkulose statt europäischer Liste', () => {
  const leer = { list: () => [] };
  const ug = ersteSchritte({ shortagesRepo: leer, land: 'UG', sprache: 'en', region: 'AFRICA' }).vorschlaege.map((v) => v.wirkstoff);
  assert.equal(ug[0], 'Artemether/Lumefantrine');
  for (const w of ['Oxytocin', 'Oral rehydration salts']) assert.ok(ug.includes(w), w);
  const ao = ersteSchritte({ shortagesRepo: leer, land: 'AO', sprache: 'pt', region: 'AFRICA' }).vorschlaege.map((v) => v.wirkstoff);
  assert.equal(ao[0], 'Artemeter/Lumefantrina');
  const at = ersteSchritte({ shortagesRepo: leer, land: 'AT', sprache: 'de', region: 'EUROPE' }).vorschlaege.map((v) => v.wirkstoff);
  assert.ok(!at.includes('Oxytocin') && at[0] === 'Amoxicillin', 'Afrika-Liste in Europa');
});

test('Über HTTP: „Nur Warnungen" zeigt nur die Fälschungswarnung, markiert', { timeout: 60000 }, async () => {
  const d = new Date().toUTCString();
  const rss = `<?xml version="1.0"?><rss version="2.0"><channel><title>x</title>
    <item><title>NAFDAC alerts the public on falsified Augmentin in circulation</title><link>https://nafdac.example/1</link><pubDate>${d}</pubDate><description>falsified</description></item>
    <item><title>NAFDAC holds stakeholder workshop in Lagos</title><link>https://nafdac.example/2</link><pubDate>${d}</pubDate><description>workshop</description></item>
  </channel></rss>`;
  const dienst = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'application/rss+xml' }); res.end(rss); });
  await new Promise((ok) => dienst.listen(0, ok));
  const env = { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'warn-test', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus', APOPULSE_REFERENCE_DATA: '',
    APOPULSE_ADMIN_EMAIL: 'red@wn.test', APOPULSE_ADMIN_PASSWORD: 'warn-test-123', APOPULSE_QUELLEN_LOKAL_ERLAUBT: '1' };
  for (const s of activeSources({})) env[`APOPULSE_SOURCE_${s.id.toUpperCase()}_URL`] = s.id === 'nafdac_news' ? `http://localhost:${dienst.address().port}/ng.xml` : '';
  const kind = spawn(process.execPath, [SERVER], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  try {
    const port = await new Promise((ok, fail) => {
      const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
      const lies = (x) => { log += x; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
      kind.stdout.on('data', lies); kind.stderr.on('data', lies);
      kind.on('exit', (c) => { clearTimeout(zeit); fail(new Error(`Server beendet (${c}):\n${log}`)); });
    });
    const B = `http://localhost:${port}`;
    const H = (t) => ({ 'content-type': 'application/json', ...(t ? { authorization: 'Bearer ' + t } : {}) });
    const red = (await (await fetch(B + '/api/login', { method: 'POST', headers: H(''), body: JSON.stringify({ email: 'red@wn.test', password: 'warn-test-123' }) })).json()).token;
    const ug = (await (await fetch(B + '/api/register', { method: 'POST', headers: H(''), body: JSON.stringify({ name: 'Kampala', email: 'ug@wn.test', password: 'Passwort123!', country: 'UG', accountType: 'pharmacy' }) })).json()).token;
    assert.equal((await fetch(B + '/api/live/run/news', { method: 'POST', headers: H(red) })).status, 200);
    const alle = await (await fetch(B + '/api/news?ebene=region', { headers: H(ug) })).json();
    assert.equal(alle.posts.length, 2);
    const warn = await (await fetch(B + '/api/news?ebene=region&nur=warnungen', { headers: H(ug) })).json();
    assert.equal(warn.posts.length, 1, 'Filter lässt Nicht-Warnungen durch');
    assert.equal(warn.posts[0].warnung, 'faelschung');
    assert.match(warn.posts[0].body, /falsified Augmentin/);
    const es = await (await fetch(B + '/api/erste-schritte', { headers: H(ug) })).json();
    assert.equal(es.vorschlaege[0].wirkstoff, 'Artemether/Lumefantrine', 'Server reicht die Region nicht durch');
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
    dienst.close();
  }
});
