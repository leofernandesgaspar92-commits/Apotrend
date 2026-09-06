// Länderabdeckung: was ANKOMMT, nicht was eingetragen ist (services/coverage.js).
//
// Der Unterschied ist der ganze Zweck dieser Datei. Bis zum 06.09.2026 konnte
// die Plattform nur sagen „für Nigeria ist eine Quelle eingetragen" — wahr und
// trotzdem irreführend, denn eingetragen heißt nicht geliefert. Eine leere
// Liste ohne Erklärung sieht aus wie ein Defekt, und die Nutzerin sucht den
// Fehler bei sich.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createCoverageStore, landStatus } from '../src/services/coverage.js';

const QUELLEN = [
  { id: 'bfarm_news', country: 'DE' },
  { id: 'pei_news', country: 'DE' },
  { id: 'nafdac_news', country: 'NG' },
  { id: 'basg_news', country: 'AT' },
];

test('ohne Durchlauf ist der Zustand „unbekannt" — nicht „stumm"', () => {
  // Der Unterschied zählt: „Wir wissen es noch nicht" als Störung darzustellen
  // wäre eine Falschaussage, und zwar ausgerechnet in den ersten Sekunden nach
  // jedem Deploy.
  const store = createCoverageStore();
  const st = landStatus('NG', { store, quellen: QUELLEN });
  assert.equal(st.zustand, 'unbekannt');
  assert.equal(st.quellen, 1);
});

test('ein Land ohne jede Quelle ist „keine"', () => {
  const store = createCoverageStore();
  assert.equal(landStatus('JP', { store, quellen: QUELLEN }).zustand, 'keine');
});

test('eine antwortende Quelle macht das Land „liefert"', () => {
  const store = createCoverageStore();
  store.ausNewsReport({ perSource: { basg_news: { ok: true, fetched: 7, country: 'AT' } } }, QUELLEN);
  const st = landStatus('AT', { store, quellen: QUELLEN });
  assert.equal(st.zustand, 'liefert');
});

test('null neue Meldungen sind KEINE Störung', () => {
  // Eine Behörde, die drei Tage nichts veröffentlicht, ist nicht kaputt.
  // Würde hier „stumm" stehen, meldete die Plattform an ruhigen Tagen einen
  // Ausfall — und die Warnung wäre nach einer Woche wertlos.
  const store = createCoverageStore();
  store.ausNewsReport({ perSource: { basg_news: { ok: true, fetched: 0, country: 'AT' } } }, QUELLEN);
  assert.equal(landStatus('AT', { store, quellen: QUELLEN }).zustand, 'liefert');
});

test('nur Fehler machen das Land „stumm" — und die Quelle wird benannt', () => {
  const store = createCoverageStore();
  store.ausNewsReport({ perSource: { nafdac_news: { ok: false, error: 'HTTP 404' } } }, QUELLEN);
  const st = landStatus('NG', { store, quellen: QUELLEN });
  assert.equal(st.zustand, 'stumm');
  // „Die NAFDAC antwortet nicht" ist eine Aussage, mit der eine Apotheke etwas
  // anfangen kann. „Keine Daten" ist es nicht.
  assert.deepEqual(st.stumm, ['nafdac_news']);
});

test('eine von zwei Quellen genuegt — das Land liefert', () => {
  const store = createCoverageStore();
  store.ausNewsReport({ perSource: {
    bfarm_news: { ok: true, fetched: 3, country: 'DE' },
    pei_news: { ok: false, error: 'HTTP 404' },
  } }, QUELLEN);
  const st = landStatus('DE', { store, quellen: QUELLEN });
  assert.equal(st.zustand, 'liefert');
  // Die stumme Quelle wird trotzdem festgehalten — sie gehoert repariert.
  assert.deepEqual(st.stumm, ['pei_news']);
});

test('ein abgelehntes soziales Konto zaehlt als stumm, nicht als Erfolg', () => {
  // socialSources.js liefert bei nicht nachgewiesener Identitaet `ok: true`
  // mit `verified: false` — es hat ja technisch geklappt, nur wurde bewusst
  // nichts uebernommen. Als „liefert" zu werten waere hier falsch: Es kommt
  // nichts an.
  const store = createCoverageStore();
  store.ausNewsReport({ perSource: {
    nafdac_news: { ok: true, verified: false, reason: 'Domain nicht nachgewiesen' },
  } }, QUELLEN);
  const st = landStatus('NG', { store, quellen: QUELLEN });
  assert.equal(st.zustand, 'stumm');
});

test('das Land kommt aus der Quellenliste, wenn der Fehlerfall keins traegt', () => {
  // Genau der interessante Fall: Scheitert der Abruf, steht in perSource kein
  // `country` — ohne diesen Rueckgriff waere ausgerechnet die Stoerung
  // unsichtbar.
  const store = createCoverageStore();
  store.ausNewsReport({ perSource: { nafdac_news: { ok: false, error: 'timeout' } } }, QUELLEN);
  assert.equal(landStatus('NG', { store, quellen: QUELLEN }).zustand, 'stumm');
});

test('ein spaeterer Durchlauf loest den vorigen ab', () => {
  // Faengt eine Behoerde wieder an zu liefern, muss der Hinweis von selbst
  // verschwinden — ohne Deploy, ohne dass jemand daran denken muss.
  const store = createCoverageStore();
  store.ausNewsReport({ perSource: { nafdac_news: { ok: false, error: 'HTTP 404' } } }, QUELLEN);
  assert.equal(landStatus('NG', { store, quellen: QUELLEN }).zustand, 'stumm');
  store.ausNewsReport({ perSource: { nafdac_news: { ok: true, fetched: 2, country: 'NG' } } }, QUELLEN);
  assert.equal(landStatus('NG', { store, quellen: QUELLEN }).zustand, 'liefert');
});

test('der Gesamtstand nennt jedes gemessene Land mit Zeitpunkt', () => {
  const store = createCoverageStore({ now: () => Date.parse('2026-09-06T10:00:00Z') });
  store.ausNewsReport({ perSource: {
    basg_news: { ok: true, fetched: 1, country: 'AT' },
    nafdac_news: { ok: false, error: 'HTTP 404' },
  } }, QUELLEN);
  // Der Schluessel traegt die ART: Nachrichten und Engpaesse kommen aus
  // verschiedenen Quellen und fallen unabhaengig voneinander aus.
  const alle = store.alle();
  assert.equal(alle['news:AT'].ok, true);
  assert.equal(alle['news:NG'].ok, false);
  assert.equal(alle['news:AT'].stand, '2026-09-06T10:00:00.000Z');
});

test('ein leerer Bericht aendert nichts', () => {
  const store = createCoverageStore();
  store.ausNewsReport(null, QUELLEN);
  store.ausNewsReport({}, QUELLEN);
  assert.equal(store.size(), 0);
});

// ── Engpaesse sind eigene Quellen ───────────────────────────────────────────
// Die erste Fassung kannte diese Trennung nicht: Damit erklaerte sich die
// leere ENGPASS-Liste mit der Gesundheit der NACHRICHTEN-Quelle. Oesterreich
// bezieht Nachrichten vom BASG-Newsfeed und Engpaesse aus einer anderen
// BASG-Schnittstelle — zwei Server, die unabhaengig ausfallen.

const ENGPASS_QUELLEN = [
  { id: 'basg_shortages', country: 'AT' },
  { id: 'openfda_shortages', country: 'US' },
];

test('Engpaesse und Nachrichten werden getrennt gefuehrt', () => {
  const store = createCoverageStore();
  // Nachrichten laufen …
  store.ausNewsReport({ perSource: { basg_news: { ok: true, fetched: 5, country: 'AT' } } }, QUELLEN);
  // … die Engpass-Schnittstelle nicht.
  store.ausShortageSummary({ csv: [{ id: 'basg_shortages', error: 'HTTP 503' }] }, ENGPASS_QUELLEN);

  assert.equal(landStatus('AT', { store, quellen: QUELLEN, art: 'news' }).zustand, 'liefert');
  const engpass = landStatus('AT', { store, quellen: ENGPASS_QUELLEN, art: 'shortages' });
  assert.equal(engpass.zustand, 'stumm');
  assert.deepEqual(engpass.stumm, ['basg_shortages']);
});

test('null Engpaesse sind eine gute Nachricht, keine Stoerung', () => {
  // Ein Land ohne aktuelle Engpaesse ist der Idealzustand. Wuerde hier
  // „stumm" stehen, meldete die Plattform ausgerechnet dann einen Ausfall,
  // wenn alles in Ordnung ist.
  const store = createCoverageStore();
  store.ausShortageSummary({ csv: [{ id: 'basg_shortages', count: 0, rejected: 0 }] }, ENGPASS_QUELLEN);
  assert.equal(landStatus('AT', { store, quellen: ENGPASS_QUELLEN, art: 'shortages' }).zustand, 'liefert');
});

test('geantwortet, aber nichts verwertbar zaehlt als stumm', () => {
  // Aendert eine Behoerde ihre Feldnamen, liefert sie weiter brav 200 OK und
  // null brauchbare Zeilen. Als „liefert" zu werten waere hier falsch: Es
  // kommt nichts an, und der Grund ist ein anderer als ein Ausfall.
  const store = createCoverageStore();
  store.ausShortageSummary({ csv: [{ id: 'basg_shortages', count: 0, rejected: 42 }] }, ENGPASS_QUELLEN);
  const st = landStatus('AT', { store, quellen: ENGPASS_QUELLEN, art: 'shortages' });
  assert.equal(st.zustand, 'stumm');
});

test('ein Engpass-Durchlauf ueberschreibt die Nachrichten-Messung NICHT', () => {
  const store = createCoverageStore();
  store.ausNewsReport({ perSource: { basg_news: { ok: true, fetched: 2, country: 'AT' } } }, QUELLEN);
  store.ausShortageSummary({ csv: [{ id: 'basg_shortages', error: 'timeout' }] }, ENGPASS_QUELLEN);
  assert.equal(store.fuerLand('AT', 'news').ok, true);
  assert.equal(store.fuerLand('AT', 'shortages').ok, false);
});

test('ein leerer Engpass-Bericht aendert nichts', () => {
  const store = createCoverageStore();
  store.ausShortageSummary(null, ENGPASS_QUELLEN);
  store.ausShortageSummary({}, ENGPASS_QUELLEN);
  assert.equal(store.size(), 0);
});
