// Teilseiten mit Vorschau (http/teilseite.js) von Ende zu Ende.
//
// Messenger lesen kein JavaScript: Die Vorschau entsteht nur aus fertigem
// HTML mit Open-Graph-Angaben. Geprüft wird, dass die Aussage aus derselben
// Quelle kommt wie die App (Behördenliste, mit Quelle), dass „nicht knapp" und
// „keine Liste" nicht verwechselt werden, dass alles aus der Adresse escaped
// wird und dass der Knopf den Wirkstoff zur Beobachtung mitgibt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { teilseite } from '../src/http/teilseite.js';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'http', 'server.js');
const meta = (html, prop) => {
  const m = html.match(new RegExp(`<meta (?:property|name)="${prop}" content="([^"]*)"`));
  return m ? m[1] : null;
};

test('Seite: drei Aussagen, Quelle, Knopf mit Beobachtung, alles escaped', () => {
  const basis = 'https://apopulse.example';
  const knapp = teilseite({ art: 'wirkstoff', land: 'AT', sprache: 'de', pfad: '/teilen/w/AT/Amoxicillin', wirkstoff: 'Amoxicillin', beobachtet_land: true, knapp: true, seit_tagen: 12, herkunft: 'verified', quelle: 'BASG', stand: '2026-10-01' }, { basis });
  assert.equal(meta(knapp, 'og:title'), 'Amoxicillin: knapp in Österreich seit 12 Tagen');
  assert.equal(meta(knapp, 'og:description'), 'Quelle: BASG · Stand: 01.10.2026');
  assert.equal(meta(knapp, 'og:image'), 'https://apopulse.example/og-bild.png');
  assert.equal(meta(knapp, 'og:url'), 'https://apopulse.example/teilen/w/AT/Amoxicillin');
  assert.match(knapp, /href="\/\?land=AT&amp;beobachten=Amoxicillin"/);

  const nicht = teilseite({ art: 'wirkstoff', land: 'AT', sprache: 'de', pfad: '/x', wirkstoff: 'Ibuprofen', beobachtet_land: true, knapp: false }, { basis });
  assert.equal(meta(nicht, 'og:title'), 'Ibuprofen: in Österreich derzeit nicht als knapp gemeldet');
  // Ohne Behördenliste darf die Seite NICHT „nicht knapp" behaupten.
  const unbekannt = teilseite({ art: 'wirkstoff', land: 'PT', sprache: 'pt', pfad: '/x', wirkstoff: 'Ibuprofen', beobachtet_land: false, knapp: false }, { basis });
  assert.match(meta(unbekannt, 'og:title'), /ainda não há lista/);
  // Gemeldet aus Apotheken: als nicht amtlich gekennzeichnet.
  const community = teilseite({ art: 'wirkstoff', land: 'AT', sprache: 'de', pfad: '/x', wirkstoff: 'X', beobachtet_land: true, knapp: true, herkunft: 'community' }, { basis });
  assert.match(meta(community, 'og:description'), /nicht amtlich/);

  const boese = '"><script>alert(1)</script>';
  const html = teilseite({ art: 'wirkstoff', land: 'AT', sprache: 'de', pfad: '/teilen/w/AT/' + boese, wirkstoff: boese, beobachtet_land: true, knapp: false }, { basis });
  assert.ok(!html.includes('<script>'), 'Name aus der Adresse landet roh im HTML');
  assert.match(meta(html, 'og:title'), /^&quot;&gt;&lt;script&gt;/, 'Attribut lässt sich aufbrechen');
});

test('Teilseiten über den Server: Behördenliste, unbekanntes Land, Aufrufe im Cockpit', { timeout: 60000 }, async () => {
  const behoerde = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ items: [{ wirkstoff: 'Amoxicillin', bezeichnung: 'Amoxicillin 1000 mg', status: 'nicht lieferbar', meldedatum: '2026-09-01' }] }));
  });
  await new Promise((ok) => behoerde.listen(0, ok));
  const kind = spawn(process.execPath, [SERVER], {
    env: {
      ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'teil-test',
      APOPULSE_ADMIN_EMAIL: 'red@teil.test', APOPULSE_ADMIN_PASSWORD: 'teil-test-123',
      APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus', APOPULSE_REFERENCE_DATA: '', APOPULSE_PUBLIC_URL: '',
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
    const J = (tok) => ({ 'content-type': 'application/json', authorization: 'Bearer ' + tok });
    const mod = (await (await fetch(B + '/api/login', { method: 'POST', headers: J(''), body: JSON.stringify({ email: 'red@teil.test', password: 'teil-test-123' }) })).json()).token;
    assert.ok(mod, 'Redaktions-Login fehlgeschlagen');

    // Vor dem ersten Abruf: keine Liste — keine Entwarnung.
    let r = await fetch(B + '/teilen/w/AT/Amoxicillin');
    assert.equal(r.status, 200);
    assert.match(meta(await r.text(), 'og:title'), /noch keine Behördenliste/);

    assert.equal((await fetch(B + '/api/live/run/shortages', { method: 'POST', headers: J(mod) })).status, 200);

    // Andere Schreibweise, gleicher Wirkstoff — wie in der App.
    r = await fetch(B + '/teilen/w/at/' + encodeURIComponent('amoxicillin'));
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /text\/html/);
    let html = await r.text();
    assert.match(meta(html, 'og:title'), /^Amoxicillin: knapp in Österreich/);
    assert.match(meta(html, 'og:description'), /Quelle: BASG/);
    assert.equal(meta(html, 'og:image'), `http://localhost:${port}/og-bild.png`);

    r = await fetch(B + '/teilen/w/AT/Ibuprofen');
    assert.equal(meta(await r.text(), 'og:title'), 'Ibuprofen: in Österreich derzeit nicht als knapp gemeldet');

    r = await fetch(B + '/teilen/lage/AT');
    html = await r.text();
    assert.equal(meta(html, 'og:title'), '1 Wirkstoff auf der Engpassliste in Österreich');
    assert.match(html, /href="\/\?land=AT"/);

    r = await fetch(B + '/teilen/w/AT/' + encodeURIComponent('<img src=x onerror=alert(1)>'));
    html = await r.text();
    assert.ok(!html.includes('<img src=x'), 'Name aus der Adresse landet roh im HTML');

    // Gefälschter Host-Kopf landet nicht in der zwischengespeicherten Seite.
    const gefaelscht = await new Promise((ok, fail) => {
      http.get({ port, path: '/teilen/lage/AT', headers: { host: 'x.example', 'x-forwarded-proto': 'javascript:"><script>a()</script>' } }, (res) => {
        let t = ''; res.on('data', (d) => { t += d; }); res.on('end', () => ok(t));
      }).on('error', fail);
    });
    assert.ok(!gefaelscht.includes('<script>a()'), 'Kopfzeile landet roh im HTML');
    assert.equal(meta(gefaelscht, 'og:image'), 'http://x.example/og-bild.png');

    assert.equal((await fetch(B + '/teilen/lage/XX')).status, 404);
    assert.equal((await fetch(B + '/og-bild.png')).headers.get('content-type'), 'image/png');

    const bt = await (await fetch(B + '/api/betrieb', { headers: J(mod) })).json();
    assert.equal(bt.teilen.aufrufe_7, 6, 'jede ausgelieferte Teilseite zählt einmal');
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
    behoerde.close();
  }
});
