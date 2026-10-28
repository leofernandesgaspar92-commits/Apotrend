// ============================================================================
//  Funktionsvorschau (/api/vorschau/:land) — Menü und Startseite
// ============================================================================
//  Die Vorschau zeigt Besucher:innen OHNE Konto echte Einträge. Damit gelten
//  dieselben Regeln wie für die öffentlichen Engpass-Seiten:
//   - ohne Anmeldung abrufbar, unbekanntes Land -> 404
//   - höchstens drei Einträge je Bereich
//   - Engpässe NUR amtlich: eine Apotheken-Meldung darf hier nie erscheinen
//     (ohne Kennzeichnung ginge „nicht amtlich" verloren)
//   - jede Engpass-Zeile nennt ihre Quelle
// ============================================================================

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.PORT = '0';
delete process.env.APOPULSE_DATA_FILE;
process.env.APOPULSE_REFERENCE_DATA = 'an';
process.env.APOPULSE_PRESSE = 'aus';
delete process.env.APOPULSE_AI_PROVIDER;
delete process.env.APOPULSE_AI_API_KEY;

let BASE;
let httpServer;
before(async () => {
  ({ httpServer } = await import('../src/http/server.js'));
  if (!httpServer.listening) {
    await new Promise((ok, fail) => {
      httpServer.once('listening', ok);
      httpServer.once('error', (e) => fail(new Error(`Testserver startet nicht: ${e.code || e.message}`)));
    });
  }
  BASE = `http://localhost:${httpServer.address().port}`;
});
after(() => new Promise((res) => httpServer.close(res)));

async function konto(country) {
  const uniq = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const r = await (await fetch(BASE + '/api/register', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'T', email: `vs_${uniq}@ex.com`, password: 'Passwort123!', handle: `vs_${uniq}`, country, accountType: 'pharmacy' }),
  })).json();
  assert.ok(r.token, 'Registrierung fehlgeschlagen: ' + JSON.stringify(r));
  return { 'content-type': 'application/json', authorization: 'Bearer ' + r.token };
}

test('Vorschau: ohne Anmeldung, je Bereich höchstens drei Einträge, Engpässe mit Quelle', async () => {
  const res = await fetch(BASE + '/api/vorschau/at');
  assert.equal(res.status, 200, 'ohne Anmeldung abrufbar');
  const d = await res.json();
  assert.equal(d.land, 'AT');
  for (const k of ['engpaesse', 'signale', 'news']) {
    assert.ok(Array.isArray(d[k]), `${k} fehlt`);
    assert.ok(d[k].length <= 3, `${k}: mehr als drei Einträge`);
  }
  for (const e of d.engpaesse) {
    assert.ok(e.wirkstoff, 'Engpass ohne Wirkstoff');
    assert.ok(e.quelle, `Engpass ${e.wirkstoff} ohne Quelle`);
    assert.ok(['kritisch', 'eingeschraenkt'].includes(e.status), `Status ${e.status}`);
  }
});

test('Vorschau: Apotheken-Meldungen erscheinen nicht (nur amtliche Engpässe)', async () => {
  const wirkstoff = 'Vorschaucillin' + Math.random().toString(36).slice(2, 6);
  const H = await konto('AT');
  const r = await (await fetch(BASE + '/api/shortages/report', { method: 'POST', headers: H, body: JSON.stringify({ wirkstoff, status: 'kritisch', grund: 'Test' }) })).json();
  assert.ok(r.id, 'Gegenprobe: Meldung angelegt: ' + JSON.stringify(r));
  const d = await (await fetch(BASE + '/api/vorschau/AT')).json();
  assert.ok(!d.engpaesse.some((e) => e.wirkstoff === wirkstoff), 'Apotheken-Meldung in der öffentlichen Vorschau');
});

test('Vorschau: unbekanntes Land -> 404', async () => {
  assert.equal((await fetch(BASE + '/api/vorschau/XX')).status, 404);
});
