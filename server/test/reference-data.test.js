// Referenzdaten sind im Normalzustand AUS.
//
// Owner-Entscheidung vom 04.10.2026: „Keine Beispieldaten." Was erscheint,
// kommt aus echten Quellen — oder es kommt nichts, und die Ansicht sagt das.
//
// Diese Datei prueft den Normalzustand. Die Mechanik darueber (Laenderfilter,
// Preisverrechnung) wird in http-integration.test.js mit eingeschalteten
// Referenzdaten geprueft: Ein ruhender Bestand, dessen Tests verfallen, ist
// nicht ruhend, sondern kaputt.

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

const PORT = 4800 + Math.floor(Math.random() * 300);
process.env.PORT = String(PORT);
process.env.APOPULSE_ADMIN_EMAIL = 'red@apopulse.test';
process.env.APOPULSE_ADMIN_PASSWORD = 'redredred123';
delete process.env.APOPULSE_DATA_FILE;
// Ausdruecklich NICHT setzen: Hier gilt die Voreinstellung.
delete process.env.APOPULSE_REFERENCE_DATA;

const BASE = `http://localhost:${PORT}`;

let httpServer;
before(async () => {
  ({ httpServer } = await import('../src/http/server.js'));
  for (let i = 0; i < 30; i++) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) return; } catch { /* noch nicht bereit */ }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('Server nicht rechtzeitig gestartet');
});
after(() => new Promise((res) => httpServer.close(res)));

async function konto() {
  const uniq = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const r = await (await fetch(BASE + '/api/register', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'T', email: `t_${uniq}@ex.com`, password: 'Passwort123!', handle: `t_${uniq}`, country: 'AT', accountType: 'pharmacy' }),
  })).json();
  return { 'content-type': 'application/json', authorization: 'Bearer ' + r.token };
}

test('keine Beispiel-Engpaesse im Normalzustand', async () => {
  const H = await konto();
  const d = await (await fetch(BASE + '/api/shortages', { headers: H })).json();
  assert.equal(d.shortages.length, 0,
    'Referenzdaten sind abgeschaltet — hier darf nichts stehen, was keine echte Quelle hat');
});

test('keine erfundenen Preise und Rabatte im Normalzustand', async () => {
  const H = await konto();
  const p = await (await fetch(BASE + '/api/prices', { headers: H })).json();
  assert.equal(p.comparisons.length, 0);
  const r = await (await fetch(BASE + '/api/rabatte', { headers: H })).json();
  assert.equal(r.rabatte.length, 0);
});

test('„Großhandel A/B/C" taucht nirgends mehr in einer Antwort auf', async () => {
  // Die neutralen Namen waren der Ersatz fuer echte Firmennamen. Jetzt ist
  // auch der Ersatz weg — es gibt schlicht keine Lieferantenzeile ohne Quelle.
  const H = await konto();
  for (const pfad of ['/api/prices', '/api/rabatte', '/api/shortages']) {
    const txt = await (await fetch(BASE + pfad, { headers: H })).text();
    assert.doesNotMatch(txt, /Großhandel [ABC]/, `${pfad} enthaelt noch Beispiel-Lieferanten`);
  }
});

test('/api/signals antwortet und sagt, ob die KI laeuft', async () => {
  const H = await konto();
  const d = await (await fetch(BASE + '/api/signals', { headers: H })).json();
  assert.ok(Array.isArray(d.signale));
  // Der Stand gehoert in dieselbe Antwort: Das Frontend muss „verbunden,
  // gerade nichts Neues" von „noch nie etwas bekommen" unterscheiden koennen.
  assert.equal(d.stand.land, 'AT');
  assert.equal(d.stand.signale, 0);
  assert.equal(d.ki, 'aus', 'ohne Schluessel gehoert hier ehrlich „aus" zu stehen');
});

test('der Referenzdaten-Schalter laesst sich zurueckdrehen', async () => {
  // Nicht geloescht, sondern abgeschaltet: Wer loescht, kann sich nicht
  // korrigieren. Geprueft am Repo, nicht am laufenden Server — der liest die
  // Umgebung nur beim Start.
  const { createPricesRepo } = await import('../src/repo/pricesRepo.js');
  assert.ok(createPricesRepo({ seed: true }).listComparisons().length > 0,
    'die Referenzdaten muessen weiterhin VORHANDEN sein, nur eben aus');
  assert.equal(createPricesRepo({ seed: false }).listComparisons().length, 0);
});
