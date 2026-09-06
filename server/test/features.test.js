// Funktionsschaltung (data/features.js) — Ergebnis des Audits vom 06.09.2026.
//
// Der wichtigste Test dieser Datei ist der letzte Block: Er macht die Zusage
// „Krypto bleibt zu 100 %" durchsetzbar statt bloß aufgeschrieben.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FEATURES, KRYPTO_PFADE, ZUSTAende, featureEnvKey,
  zustandVon, featureListe, istAktiv, ruhenderBereichFuer,
} from '../src/data/features.js';

const LEER = {};

// ── Grundform ───────────────────────────────────────────────────────────────

test('jeder Bereich ist vollstaendig und plausibel beschrieben', () => {
  const ids = new Set();
  for (const f of FEATURES) {
    assert.ok(f.id && !ids.has(f.id), `doppelte oder fehlende Kennung: ${f.id}`);
    ids.add(f.id);
    assert.ok(ZUSTAende.includes(f.zustand), `${f.id}: unbekannter Zustand ${f.zustand}`);
    assert.ok(f.titel, `${f.id}: kein Titel`);
    // Der Grund ist keine Zierde: Wer in einem halben Jahr einen ruhenden
    // Bereich findet, muss ohne Rueckfrage verstehen, warum er ruht.
    assert.ok(f.grund && f.grund.length > 30, `${f.id}: keine belastbare Begruendung`);
    assert.ok(Array.isArray(f.api), `${f.id}: api fehlt`);
  }
});

test('das Audit-Ergebnis steht so im Code, wie es beschlossen wurde', () => {
  const zustand = Object.fromEntries(featureListe(LEER).map((f) => [f.id, f.zustand]));
  for (const id of ['engpaesse', 'news', 'konten', 'preise', 'rabatte']) {
    assert.equal(zustand[id], 'aktiv', `${id} sollte aktiv sein (Behalten/Reparieren)`);
  }
  for (const id of ['tauschboerse', 'bestellung', 'zusammenarbeit', 'termine',
    'patienteninfo', 'waehrungsrechner', 'verzeichnis',
    'social', 'direktnachrichten', 'werbung', 'bindungsmechanik']) {
    assert.equal(zustand[id], 'ruht', `${id} sollte ruhen (Parken/Streichen)`);
  }
});

// ── Zurueckschalten ─────────────────────────────────────────────────────────

test('die Umgebung schlaegt die Voreinstellung — in beide Richtungen', () => {
  assert.equal(istAktiv('tauschboerse', LEER), false);
  assert.equal(istAktiv('tauschboerse', { APOPULSE_FEATURE_TAUSCHBOERSE: 'an' }), true);
  assert.equal(istAktiv('engpaesse', { APOPULSE_FEATURE_ENGPAESSE: 'aus' }), false);
  assert.equal(featureEnvKey('tauschboerse'), 'APOPULSE_FEATURE_TAUSCHBOERSE');
});

test('ein Tippfehler legt keinen Bereich still', () => {
  // „Was man abschalten kann, schaltet irgendwann jemand versehentlich ab" —
  // ein unbekannter Wert MUSS deshalb die Voreinstellung stehen lassen.
  const f = FEATURES.find((x) => x.id === 'engpaesse');
  assert.equal(zustandVon(f, { APOPULSE_FEATURE_ENGPAESSE: 'vielleicht' }), 'aktiv');
  assert.equal(zustandVon(f, { APOPULSE_FEATURE_ENGPAESSE: '' }), 'aktiv');
});

test('eine unbekannte Kennung gilt als aktiv', () => {
  // Nichts verstecken, was gar nicht benannt ist.
  assert.equal(istAktiv('gibt-es-nicht', LEER), true);
});

// ── Pfad-Zuordnung ──────────────────────────────────────────────────────────

test('ruhende Bereiche fangen ihre Pfade ein', () => {
  assert.equal(ruhenderBereichFuer('/api/exchange/offers', LEER).id, 'tauschboerse');
  assert.equal(ruhenderBereichFuer('/api/dm/threads', LEER).id, 'direktnachrichten');
  assert.equal(ruhenderBereichFuer('/api/hashtag/engpass', LEER).id, 'social');
  assert.equal(ruhenderBereichFuer('/api/cart', LEER).id, 'bestellung');
  assert.equal(ruhenderBereichFuer('/api/fx-rates', LEER).id, 'waehrungsrechner');
});

test('aktive Bereiche bleiben unangetastet', () => {
  for (const p of ['/api/shortages', '/api/news', '/api/login', '/api/me',
    '/api/prices', '/api/rabatte', '/api/live/status', '/api/wirkstoff/ibuprofen']) {
    assert.equal(ruhenderBereichFuer(p, LEER), null, `${p} darf nicht ruhen`);
  }
});

test('wird ein Bereich zurueckgeschaltet, sind seine Pfade sofort wieder frei', () => {
  assert.equal(ruhenderBereichFuer('/api/exchange/offers',
    { APOPULSE_FEATURE_TAUSCHBOERSE: 'an' }), null);
});

// ── DIE Zusage: Krypto ──────────────────────────────────────────────────────

test('KEIN Bereich darf jemals einen Krypto-Pfad einfangen', () => {
  // Der Owner hat festgelegt: Krypto bleibt zu 100 %, es traegt die
  // Afrika-Strategie (NG, KE, GH, AO, MZ). Die Krypto-Wege liegen unter
  // /api/payments — also mitten in dem Bereich, den das Audit zum Parken
  // vorschlug. Traegt jemand spaeter /^\/api\/payments/ in einen ruhenden
  // Bereich ein, faellt dieser Test. Vor dem Deploy, nicht danach.
  for (const { pfad } of KRYPTO_PFADE) {
    const bereich = ruhenderBereichFuer(pfad, LEER);
    assert.equal(bereich, null,
      `Krypto-Pfad ${pfad} wird von Bereich "${bereich && bereich.id}" stillgelegt. `
      + 'Krypto ist nicht abschaltbar — siehe Kommentar bei `zahlungen` in data/features.js.');
  }
});

test('Krypto bleibt auch dann frei, wenn ALLES abgeschaltet wird', () => {
  // Der haerteste Fall: Jemand setzt jeden Schalter auf „aus".
  const allesAus = Object.fromEntries(FEATURES.map((f) => [featureEnvKey(f.id), 'aus']));
  for (const { pfad } of KRYPTO_PFADE) {
    assert.equal(ruhenderBereichFuer(pfad, allesAus), null,
      `Krypto-Pfad ${pfad} faellt aus, wenn alle Bereiche abgeschaltet werden`);
  }
});

test('der Waehrungsrechner ruht, die Krypto-Kurse nicht', () => {
  // Zwei verschiedene Dinge, die leicht verwechselt werden: /api/fx-rates ist
  // der Fiat-Rechner (Nische), /api/payments/crypto liefert die Kurse, ohne
  // die eine Krypto-Zahlung keinen Betrag anzeigen kann.
  assert.ok(ruhenderBereichFuer('/api/fx-rates', LEER));
  assert.equal(ruhenderBereichFuer('/api/payments/crypto', LEER), null);
});
