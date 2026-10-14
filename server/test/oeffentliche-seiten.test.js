// Öffentliche Engpass-Seiten (services/oeffentlicheSeiten.js): lesbar ohne
// JavaScript, nur amtliche Daten mit Quelle, 404 statt Leerseiten, Sitemap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { slug } from '../src/services/oeffentlicheSeiten.js';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'http', 'server.js');

test('Adressen: lesbar, ohne Umlaute und Sonderzeichen', () => {
  assert.equal(slug('Amoxicillin'), 'amoxicillin');
  assert.equal(slug('Clavulansäure / Amoxicillin'), 'clavulansaeure-amoxicillin');
  assert.equal(slug('Cefuroxim-Axetil'), 'cefuroxim-axetil');
  assert.equal(slug('Amoxicilina + Ácido clavulânico'), 'amoxicilina-acido-clavulanico');
  assert.equal(slug('<script>'), 'script');
});

test('Über HTTP: Länder, Wirkstoffe, nur amtlich, 404, robots, Sitemap', { timeout: 60000 }, async () => {
  let liste = [
    { wirkstoff: 'Amoxicillin', bezeichnung: 'Amoxicillin 1000 mg Filmtabletten', status: 'nicht lieferbar', meldedatum: '2026-09-01', voraussichtlich_bis: '2026-12-15' },
    { wirkstoff: 'Amoxicillin', bezeichnung: 'Amoxicillin 500 mg Kapseln', status: 'eingeschränkt lieferbar' },
    { wirkstoff: 'Clavulansäure', bezeichnung: 'Clavulansäure <b>Test</b>', status: 'eingeschränkt lieferbar' },
  ];
  const behoerde = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ items: liste })); });
  await new Promise((ok) => behoerde.listen(0, ok));
  const kind = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'seo-test', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus', APOPULSE_REFERENCE_DATA: 'an',
      APOPULSE_ADMIN_EMAIL: 'red@seo.test', APOPULSE_ADMIN_PASSWORD: 'seo-test-123', APOPULSE_PUBLIC_URL: 'https://apopulse.example',
      APOPULSE_SOURCE_BASG_SHORTAGES_URL: `http://localhost:${behoerde.address().port}/basg.json` },
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
    const holen = async (pfad) => { const r = await fetch(B + pfad); return { status: r.status, typ: r.headers.get('content-type'), text: await r.text() }; };
    const red = (await (await fetch(B + '/api/login', { method: 'POST', headers: H(''), body: JSON.stringify({ email: 'red@seo.test', password: 'seo-test-123' }) })).json()).token;

    // Vor dem ersten Abruf: Österreich hat nur Beispieldaten -> keine öffentliche Seite.
    assert.equal((await holen('/engpaesse/at')).status, 404, 'Beispieldaten öffentlich als Engpassliste');
    // Eine Apotheke meldet etwas (nicht amtlich) — das gehört nicht auf die öffentlichen Seiten.
    const apo = (await (await fetch(B + '/api/register', { method: 'POST', headers: H(''), body: JSON.stringify({ name: 'Apo', email: 'apo@seo.test', password: 'Passwort123!', country: 'AT', accountType: 'pharmacy' }) })).json()).token;
    const meldung = await fetch(B + '/api/shortages/report', { method: 'POST', headers: H(apo), body: JSON.stringify({ wirkstoff: 'Gemeldetin', bezeichnung: 'Gemeldetin 5 mg', status: 'kritisch', country: 'AT' }) });
    assert.equal(meldung.status, 200, 'Testaufbau: Apotheken-Meldung nicht angelegt — ' + await meldung.text());
    // Gegencheck: In der App ist die Meldung sichtbar (gekennzeichnet) — nur öffentlich nicht.
    const inApp = await (await fetch(B + '/api/shortages?country=AT', { headers: H(apo) })).json();
    assert.ok(JSON.stringify(inApp).includes('Gemeldetin'), 'Testaufbau: Meldung nicht in der App');

    assert.equal((await fetch(B + '/api/live/run/shortages', { method: 'POST', headers: H(red) })).status, 200);

    let r = await holen('/engpaesse');
    assert.equal(r.status, 200);
    assert.match(r.text, /href="\/engpaesse\/at"/);

    r = await holen('/engpaesse/at');
    assert.equal(r.status, 200);
    assert.match(r.typ, /text\/html/);
    assert.match(r.text, /<title>Lieferengpässe Österreich — aktuelle Liste · ApoPulse<\/title>/);
    assert.match(r.text, /<link rel="canonical" href="https:\/\/apopulse\.example\/engpaesse\/at">/);
    assert.match(r.text, /2 Wirkstoffe stehen derzeit auf der Engpassliste in Österreich/, 'Präparate statt Wirkstoffe gezählt');
    assert.match(r.text, /href="\/engpaesse\/at\/amoxicillin"/);
    assert.match(r.text, /Quelle: BASG/);
    assert.ok(!/Gemeldetin/.test(r.text), 'Apotheken-Meldung auf der öffentlichen Seite');
    assert.ok(!/Levothyroxin/.test(r.text), 'Beispieldaten auf der öffentlichen Seite');

    r = await holen('/engpaesse/at/amoxicillin');
    assert.equal(r.status, 200);
    assert.match(r.text, /<h1>Amoxicillin: Lieferengpass in Österreich<\/h1>/);
    assert.match(r.text, /Amoxicillin 1000 mg Filmtabletten/);
    assert.match(r.text, /nicht lieferbar/);
    assert.match(r.text, /voraussichtlich bis 15\.12\.2026/);
    assert.match(r.text, /href="\/\?land=AT&amp;beobachten=Amoxicillin"/, 'Knopf führt nicht in die Beobachtung');
    assert.match(r.text, /Keine Therapie- oder Austauschempfehlung/);
    assert.match(r.text, /application\/ld\+json/);
    // Inhalte aus der Behördenliste werden escaped.
    r = await holen('/engpaesse/at/clavulansaeure');
    assert.equal(r.status, 200);
    assert.ok(!r.text.includes('<b>Test</b>') && r.text.includes('&lt;b&gt;Test&lt;/b&gt;'));

    // Unbekannt -> 404 (keine endlosen Leerseiten, keine App-Hülle mit 200).
    for (const pfad of ['/engpaesse/at/gibtsnicht', '/engpaesse/xx', '/engpaesse/pt', '/engpaesse/at/Amoxicillin', '/engpaesse/at/gemeldetin']) {
      const x = await holen(pfad);
      assert.equal(x.status, 404, pfad);
      assert.match(x.text, /noindex/);
    }

    // Wieder lieferbar: Seite bleibt, sagt es ehrlich.
    liste = liste.filter((z) => z.wirkstoff !== 'Amoxicillin');
    await fetch(B + '/api/live/run/shortages', { method: 'POST', headers: H(red) });
    r = await holen('/engpaesse/at/amoxicillin');
    assert.equal(r.status, 200);
    assert.match(r.text, /Amoxicillin in Österreich: derzeit kein Lieferengpass gemeldet/);
    assert.match(r.text, /Zuletzt knapp bis/);
    assert.ok(!/href="\/engpaesse\/at\/amoxicillin"/.test((await holen('/engpaesse/at')).text), 'beendeter Engpass weiter in der aktuellen Liste');

    r = await holen('/robots.txt');
    assert.match(r.text, /Disallow: \/api\//);
    assert.match(r.text, /Sitemap: https:\/\/apopulse\.example\/sitemap\.xml/);
    r = await holen('/sitemap.xml');
    assert.match(r.typ, /application\/xml/);
    assert.match(r.text, /<loc>https:\/\/apopulse\.example\/engpaesse\/at\/amoxicillin<\/loc>/, 'beendeter Wirkstoff fehlt in der Sitemap');
    assert.match(r.text, /<loc>https:\/\/apopulse\.example\/engpaesse\/at\/clavulansaeure<\/loc>/);
    assert.ok(!/gemeldetin|levothyroxin/i.test(r.text));

    const bt = await (await fetch(B + '/api/betrieb', { headers: H(red) })).json();
    assert.ok(bt.seiten.aufrufe_7 >= 5, 'Aufrufe der öffentlichen Seiten nicht gezählt');
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
    behoerde.close();
  }
});
