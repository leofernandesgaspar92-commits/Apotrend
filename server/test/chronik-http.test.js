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
  let liste = [
    { wirkstoff: 'Amoxicillin', bezeichnung: 'Amoxicillin 1000 mg', status: 'nicht lieferbar', meldedatum: '2026-09-01' },
    { wirkstoff: 'Ibuprofen', bezeichnung: 'Ibuprofen 400 mg', status: 'eingeschränkt lieferbar' },
  ];
  const behoerde = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
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
      APOPULSE_SOURCE_OPENFDA_SHORTAGES_URL: '', // abgeschaltet: kein Netz im Test
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
    const d = await (await fetch(B + '/api/shortages?country=AT', { headers: J(mod) })).json();
    assert.ok(d.chronik_seit, 'Aufzeichnungsbeginn fehlt');
    const amox = d.shortages.find((s) => s.wirkstoff === 'Amoxicillin');
    assert.ok(amox, 'Behördenzeile kam nicht an: ' + JSON.stringify(d.shortages.map((s) => s.wirkstoff)));
    assert.equal(amox.chronik.anzahl, 1);
    assert.ok(d.shortages.find((s) => s.wirkstoff === 'Ibuprofen'), '„eingeschränkt lieferbar" (mit Umlaut) wurde verworfen');

    const w1 = await (await fetch(B + '/api/wirkstoff/Amoxicillin?country=AT', { headers: J(mod) })).json();
    assert.equal(w1.chronik.offen.beginn, '2026-09-01', 'Meldedatum der Behörde als Beginn');
    assert.equal(w1.chronik.offen.beginn_art, 'gemeldet');

    // Zweiter Abruf: Amoxicillin ist von der Liste.
    liste = liste.filter((z) => z.wirkstoff !== 'Amoxicillin');
    await abruf();
    const w2 = await (await fetch(B + '/api/wirkstoff/Amoxicillin?country=AT', { headers: J(mod) })).json();
    assert.equal(w2.chronik.offen, null, 'Episode blieb offen, obwohl die Behörde den Engpass nicht mehr führt');
    assert.equal(w2.chronik.anzahl, 1);
    assert.ok(w2.chronik.episoden[0].ende);

    // Ein Land, das nie beobachtet wurde: keine erfundene „0× knapp"-Aussage.
    const pt = await (await fetch(B + '/api/wirkstoff/Amoxicillin?country=PT', { headers: J(mod) })).json();
    assert.equal(pt.chronik, null);
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
    behoerde.close();
  }
});
