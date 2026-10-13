// Engpass-Chronik von Ende zu Ende: Behördenabruf -> Chronik -> API.
//
// Die Regeln der Chronik prüft test/chronik.test.js. Hier geht es um die
// VERDRAHTUNG: Kommt ein echter Abruf über den eingebauten BASG-Weg
// (strukturierte Quelle) in der Chronik an, steht sie in /api/shortages und
// auf der Wirkstoff-Seite, und schließt der nächste Abruf ohne die Zeile die
// Episode? Ein eigener Prozess, weil die Quellen-Adressen aus der Umgebung
// beim Start gelesen werden.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'http', 'server.js');

test('Abruf füllt die Chronik; der nächste Abruf ohne die Zeile beendet die Episode', { timeout: 60000 }, async () => {
  // Nachgestellte Behördenliste — veränderbar zwischen zwei Abrufen.
  let fda = [{ generic_name: 'Lisinopril', status: 'Currently in Shortage' }];
  let liste = [
    { wirkstoff: 'Amoxicillin', bezeichnung: 'Amoxicillin 1000 mg', status: 'nicht lieferbar', meldedatum: '2026-09-01' },
    { wirkstoff: 'Ibuprofen', bezeichnung: 'Ibuprofen 400 mg', status: 'eingeschränkt lieferbar' },
  ];
  const behoerde = http.createServer((req, res) => {
    // Drei Behörden. BfArM (DE): CSV in Windows-1252, ohne Statusspalte —
    // wie die echte Datei.
    // TGA (AU) als EIGENE Quelle der Redaktion — CSV ohne Statusspalte.
    if (req.url.startsWith('/tga')) {
      res.writeHead(200, { 'content-type': 'text/csv' });
      return res.end('Active ingredients,Trade name,Shortage start\r\nCefalexin,Keflex 500 mg,2026-09-20');
    }
    if (req.url.startsWith('/bfarm')) {
      const csv = 'PZN;Beginn;Ende;Arzneimittlbezeichnung;Wirkstoffe;Grund\r\n01234567;01.09.2026;31.12.2099;Ibuprofen 400 mg Filmtabletten;Ibuprofen;Erhöhte Nachfrage';
      res.writeHead(200, { 'content-type': 'text/csv' });
      return res.end(Buffer.from(csv, 'latin1'));
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    // FDA (US) seitenweise wie openFDA, aber mit EINEM Eintrag je Seite: Liest
    // der Server nur die erste Seite, fehlt Cefuroxim — und die Frühwarnung
    // bleibt aus. Alles andere: BASG (AT).
    if (req.url.startsWith('/fda')) {
      const skip = Number(new URL(req.url, 'http://x').searchParams.get('skip') || 0);
      return res.end(JSON.stringify({ meta: { results: { skip, limit: 1, total: fda.length } }, results: fda.slice(skip, skip + 1) }));
    }
    res.end(JSON.stringify({ items: liste }));
  });
  await new Promise((ok) => behoerde.listen(0, ok));
  const feed = `http://localhost:${behoerde.address().port}/basg.json`;

  const kind = spawn(process.execPath, [SERVER], {
    env: {
      ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'chronik-test',
      APOPULSE_ADMIN_EMAIL: 'red@chronik.test', APOPULSE_ADMIN_PASSWORD: 'chronik-test-123',
      APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus', APOPULSE_REFERENCE_DATA: '',
      APOPULSE_SOURCE_BASG_SHORTAGES_URL: feed,
      APOPULSE_SOURCE_OPENFDA_SHORTAGES_URL: `http://localhost:${behoerde.address().port}/fda.json`,
      APOPULSE_SOURCE_BFARM_SHORTAGES_URL: `http://localhost:${behoerde.address().port}/bfarm.csv`,
      APOPULSE_QUELLEN_LOKAL_ERLAUBT: '1', // nur damit die nachgestellte TGA-Liste lokal laufen darf
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
    const mod = (await (await fetch(B + '/api/login', { method: 'POST', headers: J(''), body: JSON.stringify({ email: 'red@chronik.test', password: 'chronik-test-123' }) })).json()).token;
    assert.ok(mod, 'Redaktions-Login fehlgeschlagen');
    const abruf = async () => {
      const r = await fetch(B + '/api/live/run/shortages', { method: 'POST', headers: J(mod) });
      assert.equal(r.status, 200, await r.text());
    };

    await abruf();
    // Deutschland aus der BfArM-CSV: Standardstatus, Umlaut heil, Datum in ISO.
    const de = (await (await fetch(B + '/api/shortages?country=DE', { headers: J(mod) })).json()).shortages;
    const ibu = de.find((z) => z.wirkstoff === 'Ibuprofen');
    assert.ok(ibu, 'BfArM-Zeile kam nicht an: ' + JSON.stringify(de.map((z) => z.wirkstoff)));
    assert.deepEqual([ibu.status, ibu.grund, ibu.gemeldet_am, ibu.country], ['eingeschraenkt', 'Erhöhte Nachfrage', '2026-09-01', 'DE']);
    // Die Wirkstoff-Seite findet die BfArM-Zeile auch unter anderer Schreibweise.
    const ibuSeite = await (await fetch(B + '/api/wirkstoff/Ibuprofen-Lysinat?country=DE', { headers: J(mod) })).json();
    assert.ok(ibuSeite.shortages.some((z) => z.wirkstoff === 'Ibuprofen'), 'Salzform fand den Engpass nicht');
    const d = await (await fetch(B + '/api/shortages?country=AT', { headers: J(mod) })).json();
    assert.ok(d.chronik_seit, 'Aufzeichnungsbeginn fehlt');
    const amox = d.shortages.find((s) => s.wirkstoff === 'Amoxicillin');
    assert.ok(amox, 'Behördenzeile kam nicht an: ' + JSON.stringify(d.shortages.map((s) => s.wirkstoff)));
    assert.equal(amox.chronik.anzahl, 1);
    assert.ok(d.shortages.find((s) => s.wirkstoff === 'Ibuprofen'), '„eingeschränkt lieferbar" (mit Umlaut) wurde verworfen');

    const w1 = await (await fetch(B + '/api/wirkstoff/Amoxicillin?country=AT', { headers: J(mod) })).json();
    assert.equal(w1.chronik.offen.beginn, '2026-09-01', 'Meldedatum der Behörde als Beginn');
    assert.equal(w1.chronik.offen.beginn_art, 'gemeldet');

    // Premium-Schnitt AUF DEM SERVER: ohne Premium Zusammenfassung ja,
    // Episodenliste nein — und der Export antwortet 403.
    const kunde = (await (await fetch(B + '/api/register', { method: 'POST', headers: J(''), body: JSON.stringify({ name: 'K', email: 'k@chronik.test', password: 'Passwort123!', handle: 'k_chronik', country: 'AT', accountType: 'pharmacy' }) })).json()).token;
    const frei = await (await fetch(B + '/api/wirkstoff/Amoxicillin?country=AT', { headers: J(kunde) })).json();
    assert.equal(frei.chronik.anzahl, 1, 'Zusammenfassung ist frei');
    assert.deepEqual(frei.chronik.episoden, [], 'Episodenliste ging ohne Premium über die Leitung');
    assert.equal(frei.chronik.episoden_gesperrt, true);
    assert.equal((await fetch(B + '/api/chronik?country=AT', { headers: J(kunde) })).status, 403);

    // Premium über den echten Weg: Krypto-Zahlung melden, Redaktion bestätigt.
    const start = await (await fetch(B + '/api/payments/crypto/start', { method: 'POST', headers: J(kunde), body: JSON.stringify({ productId: 'premium_monthly', coin: 'btc' }) })).json();
    const tx = Array.from({ length: 64 }, (_, i) => '0123456789abcdef'[(i * 7 + 3) % 16]).join('');
    assert.equal((await fetch(B + `/api/payments/crypto/${start.payment_id}/claim`, { method: 'POST', headers: J(kunde), body: JSON.stringify({ txRef: tx }) })).status, 200);
    assert.equal((await fetch(B + `/api/payments/${start.payment_id}/confirm`, { method: 'POST', headers: J(mod), body: '{}' })).status, 200);
    const voll = await (await fetch(B + '/api/wirkstoff/Amoxicillin?country=AT', { headers: J(kunde) })).json();
    assert.equal(voll.chronik.episoden.length, 1, 'mit Premium fehlt die Episodenliste');
    const ex = await (await fetch(B + '/api/chronik?country=AT', { headers: J(kunde) })).json();
    assert.ok(ex.episoden.some((e) => e.wirkstoff === 'Amoxicillin'));

    // Zweiter Abruf: Amoxicillin ist von der Liste.
    // Öffentliche Lage für die Startseite: nur Zahlen, ohne Anmeldung.
    const lage = await (await fetch(B + '/api/lage/DE')).json();
    assert.deepEqual([lage.daten, lage.offen, lage.quellen], [true, 1, ['BfArM — Lieferengpassmeldungen']]);
    assert.ok(!JSON.stringify(lage).includes('Ibuprofen'), 'Wirkstoffnamen gehören nicht in die öffentliche Zahl');
    assert.equal((await (await fetch(B + '/api/lage/PT')).json()).daten, false, 'ohne Behördendaten keine Zahl');
    assert.equal((await fetch(B + '/api/lage/XX')).status, 404);

    // Quellen testen (Redaktion): derselbe Weg wie der echte Abruf.
    const probe = await (await fetch(B + '/api/quellen/probe', { method: 'POST', headers: J(mod), body: JSON.stringify({ id: 'bfarm_shortages' }) })).json();
    assert.equal(probe.ok, true, JSON.stringify(probe));
    assert.deepEqual([probe.zeilen, probe.beispiele[0].wirkstoff, probe.beispiele[0].status], [1, 'Ibuprofen', 'eingeschraenkt']);
    assert.equal((await fetch(B + '/api/quellen/probe', { method: 'POST', headers: J(kunde), body: JSON.stringify({ id: 'bfarm_shortages' }) })).status, 403, 'Nicht-Redaktion darf den Server nichts abrufen lassen');
    // Eigene Quelle: erst als Entwurf testen, dann speichern — der nächste Abruf nimmt sie mit.
    const tga = { country: 'AU', format: 'csv', url: `http://localhost:${behoerde.address().port}/tga.csv`, label: 'TGA (eigene Quelle)', standardStatus: 'eingeschraenkt' };
    // Erster Test: Die Spalten heißen anders — der Probe-Abruf sagt warum und nennt die Spalten.
    const ohne = await (await fetch(B + '/api/quellen/probe', { method: 'POST', headers: J(mod), body: JSON.stringify(tga) })).json();
    assert.equal(ohne.ok, false);
    assert.match(ohne.gruende[0], /Bezeichnung fehlt/);
    assert.deepEqual(ohne.spalten, ['Active ingredients', 'Trade name', 'Shortage start']);
    // Mit Zuordnung klappt es.
    tga.columns = { bezeichnung: 'Trade name', wirkstoff: 'Active ingredients', gemeldet_am: 'Shortage start' };
    const entwurf = await (await fetch(B + '/api/quellen/probe', { method: 'POST', headers: J(mod), body: JSON.stringify(tga) })).json();
    assert.equal(entwurf.ok, true, JSON.stringify(entwurf));
    assert.deepEqual([entwurf.beispiele[0].wirkstoff, entwurf.beispiele[0].gemeldet_am], ['Cefalexin', '2026-09-20']);
    const neu = await (await fetch(B + '/api/quellen', { method: 'POST', headers: J(mod), body: JSON.stringify(tga) })).json();
    assert.equal(neu.quelle.id, 'eigen_au_1');
    const status = await (await fetch(B + '/api/live/status')).json();
    assert.ok(status.sources.some((q) => q.id === 'eigen_au_1' && q.eigen), 'eigene Quelle fehlt auf der Datenquellen-Seite');

    // Frühwarnung: Die Kundin (Premium, Österreich) beobachtet Cefuroxim.
    // Im zweiten Abruf meldet die FDA es neu — in Österreich ist es nicht knapp.
    await fetch(B + '/api/watchlist', { method: 'POST', headers: J(kunde), body: JSON.stringify({ wirkstoff: 'Cefuroxim' }) });
    // Heimat-Alarm (gratis): Eine Apotheke OHNE Premium in Österreich beobachtet
    // Amoxicillin (läuft schon) und Paracetamol (noch nicht knapp).
    const frei2 = (await (await fetch(B + '/api/register', { method: 'POST', headers: J(''), body: JSON.stringify({ name: 'Frei', email: 'frei@chronik.test', password: 'Passwort123!', country: 'AT', accountType: 'pharmacy' }) })).json()).token;
    await fetch(B + '/api/watchlist', { method: 'POST', headers: J(frei2), body: JSON.stringify({ wirkstoff: 'Amoxicillin' }) });
    await fetch(B + '/api/watchlist', { method: 'POST', headers: J(frei2), body: JSON.stringify({ wirkstoff: 'Paracetamol' }) });
    fda = [...fda, { generic_name: 'Cefuroxim', status: 'Currently in Shortage' }];
    liste = [...liste.filter((z) => z.wirkstoff !== 'Amoxicillin'), { wirkstoff: 'Paracetamol', bezeichnung: 'Paracetamol 500 mg', status: 'nicht lieferbar' }];
    await abruf();
    const heim = (await (await fetch(B + '/api/notifications', { headers: J(frei2) })).json()).notifications
      .filter((n) => n.type === 'shortage_home' || n.type === 'shortage_ended').map((n) => [n.type, n.label]).sort();
    assert.deepEqual(heim, [['shortage_ended', 'Amoxicillin · AT'], ['shortage_home', 'Paracetamol · AT']], 'Behördenabruf im Heimatland löste keinen Hinweis aus');
    const glocke = (await (await fetch(B + '/api/notifications', { headers: J(kunde) })).json()).notifications.filter((n) => n.type === 'shortage_abroad');
    assert.deepEqual(glocke.map((n) => n.label), ['Cefuroxim · US'], 'Frühwarnung kam nicht an');
    const ov = await (await fetch(B + '/api/overview?country=AT', { headers: J(kunde) })).json();
    assert.deepEqual(ov.fruehwarnung.map((f) => [f.wirkstoff, f.laender[0].land]), [['Cefuroxim', 'US']]);
    const wk = await (await fetch(B + '/api/wirkstoff/Cefuroxim?country=AT', { headers: J(kunde) })).json();
    assert.deepEqual(wk.ausland.map((a) => a.land), ['US']);
    // Die eigene TGA-Quelle wurde im Takt mit abgerufen.
    const au = (await (await fetch(B + '/api/shortages?country=AU', { headers: J(mod) })).json()).shortages;
    assert.ok(au.some((z) => z.wirkstoff === 'Cefalexin' && z.quelle === 'TGA (eigene Quelle)'), 'eigene Quelle wurde nicht abgerufen: ' + JSON.stringify(au.map((z) => z.wirkstoff)));
    // Lisinopril lief schon beim ersten US-Abruf: kein Alarm für Altfälle.
    assert.ok(!glocke.some((n) => /Lisinopril/.test(n.label)));
    const w2 = await (await fetch(B + '/api/wirkstoff/Amoxicillin?country=AT', { headers: J(kunde) })).json();
    assert.equal(w2.chronik.offen, null, 'Episode blieb offen, obwohl die Behörde den Engpass nicht mehr führt');
    assert.equal(w2.chronik.anzahl, 1);
    assert.ok(w2.chronik.episoden[0].ende);

    // Ein Land, das nie beobachtet wurde: keine erfundene „0× knapp"-Aussage.
    const pt = await (await fetch(B + '/api/wirkstoff/Amoxicillin?country=PT', { headers: J(kunde) })).json();
    assert.equal(pt.chronik, null);
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
    behoerde.close();
  }
});
