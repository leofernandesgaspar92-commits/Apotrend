// Die Funktionsschaltung am HTTP-Layer.
//
// Zwei Dateien gehoeren zusammen, und beide braucht es:
//   · test/http-integration.test.js schaltet ALLE Bereiche an und prueft, dass
//     die geparkte Fachlogik weiter funktioniert. Ein ruhender Bereich, dessen
//     Tests verfallen, ist nicht ruhend, sondern kaputt.
//   · Diese Datei prueft den NORMALZUSTAND: Was ruhen soll, schweigt auch.
//
// Ohne die zweite Datei koennte jemand die Schaltung versehentlich wirkungslos
// machen, ohne dass ein Test es merkt — alle anderen laufen ja mit „alles an".

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

import { featureListe, featureEnvKey, KRYPTO_PFADE } from '../src/data/features.js';

const PORT = 4600 + Math.floor(Math.random() * 300);
process.env.PORT = String(PORT);
process.env.APOPULSE_ADMIN_EMAIL = 'red@apopulse.test';
process.env.APOPULSE_ADMIN_PASSWORD = 'redredred123';
delete process.env.APOPULSE_DATA_FILE;
// Ausdruecklich KEINE Feature-Variablen setzen: Hier gilt die Voreinstellung.
for (const f of featureListe({})) delete process.env[featureEnvKey(f.id)];

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

test('GET /api/features nennt Zustand und Begruendung — ohne Anmeldung', async () => {
  const r = await fetch(BASE + '/api/features');
  assert.equal(r.status, 200);
  const d = await r.json();
  const tausch = d.features.find((f) => f.id === 'tauschboerse');
  assert.equal(tausch.zustand, 'ruht');
  // Die Begruendung faehrt mit: Wer in einem halben Jahr fragt, warum der
  // Reiter fehlt, soll die Antwort bekommen, ohne den Code zu lesen.
  assert.match(tausch.grund, /Liquiditaet|Liquidität|Tauschpartner/);
});

test('ruhende Bereiche antworten mit 404 — als gaebe es sie nicht', async () => {
  for (const pfad of ['/api/exchange/offers', '/api/dm/threads', '/api/cart',
    '/api/trending/hashtags', '/api/fx-rates', '/api/colleagues/nearby',
    '/api/patient-info', '/api/tasks', '/api/appointments']) {
    const r = await fetch(BASE + pfad);
    assert.equal(r.status, 404, `${pfad} sollte ruhen, antwortete aber mit ${r.status}`);
    // Kein 403: Ein geparkter Bereich verraet nichts ueber sich, auch nicht
    // seine Existenz.
    const d = await r.json();
    assert.equal(d.error, 'Nicht gefunden');
  }
});

test('der Kern bleibt erreichbar', async () => {
  // Gegenprobe: Wenn hier etwas 404 liefert, hat die Schaltung zu viel gefangen.
  for (const pfad of ['/api/health', '/api/features', '/api/countries', '/api/shortages']) {
    const r = await fetch(BASE + pfad);
    assert.notEqual(r.status, 404, `${pfad} darf nicht ruhen`);
  }
});

test('die Krypto-Wege bleiben offen — auch im Normalzustand', async () => {
  // Die Zusage des Owners: Krypto zu 100 %, weil es die Afrika-Strategie
  // traegt (NG, KE, GH, AO, MZ). data/features.js prueft das auf Musterebene,
  // hier wird es am laufenden Server nachgewiesen: Kein einziger Krypto-Pfad
  // darf 404 liefern. 401 ist in Ordnung — das heisst „bitte anmelden",
  // nicht „gibt es nicht".
  for (const { methode, pfad } of KRYPTO_PFADE) {
    const r = await fetch(BASE + pfad, {
      method: methode,
      headers: { 'content-type': 'application/json' },
      ...(methode === 'POST' ? { body: '{}' } : {}),
    });
    assert.notEqual(r.status, 404,
      `Krypto-Pfad ${methode} ${pfad} ist stillgelegt. Krypto ist nicht abschaltbar.`);
  }
});

test('GET /api/coverage/:land antwortet ohne Anmeldung und ehrlich', async () => {
  // Vor dem ersten Durchlauf ist der Zustand „unbekannt" — ausdruecklich nicht
  // „stumm". Eine Stoerung zu melden, wo nur noch nichts gemessen wurde, waere
  // ausgerechnet in den ersten Sekunden nach jedem Deploy eine Falschaussage.
  const r = await fetch(BASE + '/api/coverage/NG');
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.land, 'NG');
  assert.ok(['unbekannt', 'liefert', 'stumm'].includes(d.zustand), `unerwartet: ${d.zustand}`);
  assert.ok(d.quellen >= 1, 'fuer Nigeria ist eine Quelle eingetragen');
});

test('ein Land ohne Quelle wird als solches benannt', async () => {
  const d = await (await fetch(BASE + '/api/coverage/JP')).json();
  assert.equal(d.zustand, 'keine');
});
