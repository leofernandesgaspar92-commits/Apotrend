// KI-Extraktion und Signalbildung.
//
// Der wichtigste Test dieser Datei ist „die KI kann die Herkunft NICHT
// überschreiben". Ohne diese Grenze wäre der gesamte Herkunfts-Proof wertlos:
// Eine Angabe, die ein Sprachmodell setzen kann, ist kein Beleg, sondern eine
// Behauptung — und darunter stünde ein Behördenname an einer Engpassmeldung,
// zu der die Behörde nie etwas gesagt hat.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AI_ENV, aiKonfiguration, parseAiAntwort, normalisiereExtraktion,
  bewerteExtraktion, extractSignal,
} from '../src/services/aiExtract.js';
import { baueSignal, dedupeKey, createSignalStore } from '../src/services/signals.js';
import { baueAuftrag, AI_SYSTEM_PROMPT } from '../src/services/aiPrompt.js';

const MIT_KI = {
  [AI_ENV.anbieter]: 'anthropic',
  [AI_ENV.schluessel]: 'test-schluessel',
};

const HERKUNFT = {
  originalUrl: 'https://www.bfarm.de/meldung/42',
  sourceName: 'BfArM — Lieferengpaesse',
  sourceId: 'bfarm_news',
  country: 'DE',
  kind: 'news',
};

const MELDUNG = {
  title: 'Lieferengpass Amoxicillin 1000 mg Filmtabletten',
  summary: 'Aufgrund einer Produktionsverzögerung ist Amoxicillin eingeschränkt lieferbar.',
  raw: 'Das BfArM informiert über einen Lieferengpass bei Amoxicillin 1000 mg.',
};

// ── Konfiguration ───────────────────────────────────────────────────────────

test('ohne Anbieter oder Schlüssel ist die KI aus — und das ist in Ordnung', () => {
  assert.equal(aiKonfiguration({}), null);
  assert.equal(aiKonfiguration({ [AI_ENV.anbieter]: 'anthropic' }), null);
  assert.equal(aiKonfiguration({ [AI_ENV.schluessel]: 'x' }), null);
  // Unbekannter Anbieter gilt als aus — nicht als Fehler, der den Start stoppt.
  assert.equal(aiKonfiguration({ [AI_ENV.anbieter]: 'hausmarke', [AI_ENV.schluessel]: 'x' }), null);
});

test('jeder Anbieter bekommt ein vernünftiges Standardmodell', () => {
  assert.match(aiKonfiguration(MIT_KI).modell, /claude/);
  assert.match(aiKonfiguration({ ...MIT_KI, [AI_ENV.anbieter]: 'openai' }).modell, /gpt/);
});

// ── Antwort auswerten ───────────────────────────────────────────────────────

test('JSON wird auch aus einer umrahmten Antwort geholt', () => {
  // Modelle rahmen gern in ```json … ``` oder stellen einen Satz davor.
  assert.deepEqual(parseAiAntwort('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseAiAntwort('Hier ist das Ergebnis:\n{"a":1}'), { a: 1 });
  assert.deepEqual(parseAiAntwort('{"a":1}'), { a: 1 });
});

test('aus Textfragmenten wird NICHTS geraten', () => {
  // Lieber kein Ergebnis als ein zusammengesuchtes.
  assert.equal(parseAiAntwort('Der Wirkstoff ist vermutlich Amoxicillin.'), null);
  assert.equal(parseAiAntwort(''), null);
  assert.equal(parseAiAntwort('{kaputt'), null);
});

test('unbekannte Werte werden verworfen, nicht durchgereicht', () => {
  const e = normalisiereExtraktion({
    category: 'VERMUTUNG',          // keine der vier erlaubten
    schweregrad: 'ziemlich schlimm', // keiner der vier erlaubten
    wirkstoff: 'unbekannt',          // ausdrücklich „weiß nicht"
    gueltig_bis: 'bald',             // kein Datum
  });
  assert.equal(e.kategorie, null);
  assert.equal(e.schweregrad, null);
  assert.equal(e.wirkstoff, null);
  assert.equal(e.gueltigBis, null);
});

test('gültige Werte kommen sauber durch', () => {
  const e = normalisiereExtraktion({
    category: 'shortage', schweregrad: 'KRITISCH', wirkstoff: 'Amoxicillin',
    gueltig_von: '2026-10-01', gueltig_bis: '2026-12-31',
    summaries: { de: 'Deutsch', en: 'English', pt: 'Português', xx: 'ignoriert' },
  });
  assert.equal(e.kategorie, 'SHORTAGE');
  assert.equal(e.schweregrad, 'kritisch');
  assert.equal(e.wirkstoff, 'Amoxicillin');
  assert.match(e.gueltigVon, /^2026-10-01/);
  assert.deepEqual(Object.keys(e.uebersetzungen).sort(), ['de', 'en', 'pt']);
});

// ── Vertrauenswert ──────────────────────────────────────────────────────────

test('ein Wirkstoff, der NICHT im Originaltext steht, senkt den Wert deutlich', () => {
  // Der klassische Fall einer frei erfundenen Angabe. Das Modell nach seiner
  // eigenen Sicherheit zu fragen, würde das nie auffangen.
  const gut = normalisiereExtraktion({ category: 'SHORTAGE', schweregrad: 'kritisch', wirkstoff: 'Amoxicillin', ursache: 'Produktionsverzögerung', summaries: { de: 'a', en: 'b' } });
  const erfunden = { ...gut, wirkstoff: 'Pantoprazol' };
  const text = MELDUNG.title + MELDUNG.raw;
  assert.ok(bewerteExtraktion(gut, text) > bewerteExtraktion(erfunden, text) + 0.2,
    'ein nicht belegter Wirkstoff muss den Wert spürbar senken');
});

test('ein widersprüchlicher Zeitraum senkt den Wert', () => {
  const basis = normalisiereExtraktion({ category: 'NEWS', wirkstoff: 'Amoxicillin' });
  const verdreht = { ...basis, gueltigVon: '2026-12-31T00:00:00.000Z', gueltigBis: '2026-10-01T00:00:00.000Z' };
  assert.ok(bewerteExtraktion(verdreht, MELDUNG.raw) < bewerteExtraktion(basis, MELDUNG.raw));
});

// ── Der Ablauf ──────────────────────────────────────────────────────────────

test('ohne Schlüssel läuft die Meldung unverändert weiter', async () => {
  const r = await extractSignal(MELDUNG, { env: {} });
  assert.equal(r.aiUsed, false);
  assert.equal(r.confidence, 0);
  assert.match(r.grund, /kein KI-Anbieter/);
  assert.equal(r.wirkstoff, null);
});

test('eine Störung beim Anbieter hält den Dienst NICHT an', async () => {
  // Zeitüberschreitung, Kontingent erschöpft, Anbieter down — immer dasselbe
  // Ergebnis: Die Meldung erscheint, nur ohne Anreicherung. Eine Plattform,
  // deren Engpassdienst von einem KI-Anbieter abhängt, ist keine.
  const r = await extractSignal(MELDUNG, {
    env: MIT_KI,
    frage: async () => { throw new Error('HTTP 429'); },
  });
  assert.equal(r.aiUsed, false);
  assert.equal(r.confidence, 0);
  assert.match(r.grund, /429/);
});

test('eine unbrauchbare Antwort führt nicht zu geratenen Feldern', async () => {
  const r = await extractSignal(MELDUNG, {
    env: MIT_KI,
    frage: async () => 'Ich bin mir nicht sicher, aber vermutlich Amoxicillin.',
  });
  assert.equal(r.aiUsed, false);
  assert.equal(r.wirkstoff, null);
});

test('eine gute Antwort reichert an', async () => {
  const r = await extractSignal(MELDUNG, {
    env: MIT_KI,
    frage: async () => JSON.stringify({
      wirkstoff: 'Amoxicillin', category: 'SHORTAGE', schweregrad: 'eingeschraenkt',
      ursache: 'Produktionsverzögerung',
      summaries: { de: 'Amoxicillin eingeschränkt lieferbar.', en: 'Amoxicillin limited.', pt: 'Amoxicilina limitada.' },
    }),
  });
  assert.equal(r.aiUsed, true);
  assert.equal(r.wirkstoff, 'Amoxicillin');
  assert.equal(r.kategorie, 'SHORTAGE');
  assert.ok(r.confidence > 0.7, `Vertrauenswert zu niedrig: ${r.confidence}`);
});

// ── DIE Grenze: Herkunft ────────────────────────────────────────────────────

test('der Auftrag an das Modell enthält KEINE Herkunft', () => {
  // Was das Modell nicht sieht, kann es weder bestätigen noch erfinden.
  const auftrag = baueAuftrag(MELDUNG);
  assert.doesNotMatch(auftrag, /bfarm\.de/i);
  assert.doesNotMatch(auftrag, /sourceName|originalUrl/);
  // Und der Systemtext verbietet das Erfinden ausdrücklich.
  assert.match(AI_SYSTEM_PROMPT, /ERFINDE NICHTS/);
});

test('die KI kann die Herkunft NICHT überschreiben', () => {
  // Der Angriff: Das Modell liefert Felder, die wie Herkunft heißen.
  const boese = {
    wirkstoff: 'Amoxicillin',
    originalUrl: 'https://boese.example/gefaelscht',
    sourceName: 'Europäische Arzneimittelagentur',
    country: 'FR',
    sourceId: 'gefaelscht',
  };
  const s = baueSignal({ meldung: MELDUNG, herkunft: HERKUNFT, extraktion: boese });
  assert.equal(s.originalUrl, HERKUNFT.originalUrl);
  assert.equal(s.sourceName, HERKUNFT.sourceName);
  assert.equal(s.country, 'DE');
  assert.equal(s.sourceId, 'bfarm_news');
});

test('ohne Herkunft entsteht KEIN Signal', () => {
  // Eine Engpassmeldung ohne Rückverweis ist ein Gerücht mit Amtsanstrich.
  assert.throws(() => baueSignal({ meldung: MELDUNG, herkunft: { ...HERKUNFT, originalUrl: '' } }), /originalUrl/);
  assert.throws(() => baueSignal({ meldung: MELDUNG, herkunft: { ...HERKUNFT, sourceName: '' } }), /sourceName/);
  assert.throws(() => baueSignal({ meldung: MELDUNG, herkunft: { ...HERKUNFT, country: 'Deutschland' } }), /Land/);
  assert.throws(() => baueSignal({ meldung: { summary: 'x' }, herkunft: HERKUNFT }), /Titel/);
});

test('ohne KI entsteht trotzdem ein vollständiges Signal', () => {
  const s = baueSignal({ meldung: MELDUNG, herkunft: HERKUNFT, extraktion: {} });
  assert.equal(s.title, MELDUNG.title);
  assert.equal(s.originalUrl, HERKUNFT.originalUrl);
  assert.equal(s.category, 'NEWS');       // aus der Art der Quelle
  assert.equal(s.confidenceScore, 0);     // 0 = keine KI gelaufen
  assert.equal(s.wirkstoff, null);
});

test('die Art der Quelle bestimmt die Kategorie, wenn die KI schweigt', () => {
  const s = baueSignal({ meldung: MELDUNG, herkunft: { ...HERKUNFT, kind: 'shortages' }, extraktion: {} });
  assert.equal(s.category, 'SHORTAGE');
});

// ── Speicher ────────────────────────────────────────────────────────────────

test('dieselbe Meldung erzeugt keine zweite Zeile', () => {
  const store = createSignalStore();
  const s = baueSignal({ meldung: MELDUNG, herkunft: HERKUNFT, extraktion: {} });
  assert.equal(store.upsert(s), true, 'beim ersten Mal neu');
  assert.equal(store.upsert(s), false, 'beim zweiten Mal nicht mehr');
  assert.equal(store.size(), 1);
});

test('ein geänderter Titel erzeugt keine zweite Zeile', () => {
  // Behörden ändern Überschriften nach. Würde der Titel in den Schlüssel
  // eingehen, stünde die Meldung danach doppelt im Feed.
  const store = createSignalStore();
  store.upsert(baueSignal({ meldung: MELDUNG, herkunft: HERKUNFT, extraktion: {} }));
  store.upsert(baueSignal({ meldung: { ...MELDUNG, title: 'Korrigiert: Lieferengpass Amoxicillin' }, herkunft: HERKUNFT, extraktion: {} }));
  assert.equal(store.size(), 1);
});

test('eine aktualisierte Meldung wandert nicht wieder an die Spitze', () => {
  // Sonst sähe der Feed bei jedem Durchlauf aus, als sei alles neu.
  const store = createSignalStore();
  const erst = baueSignal({ meldung: MELDUNG, herkunft: HERKUNFT, extraktion: {}, jetzt: () => new Date('2026-10-01T10:00:00Z') });
  store.upsert(erst);
  store.upsert(baueSignal({ meldung: MELDUNG, herkunft: HERKUNFT, extraktion: {}, jetzt: () => new Date('2026-10-04T10:00:00Z') }));
  assert.match(store.get(erst.dedupeKey).verifiedAt, /^2026-10-01/);
});

test('Filter nach Land, Kategorie und Wirkstoff', () => {
  const store = createSignalStore();
  const bauen = (land, kat, wk, url) => baueSignal({
    meldung: { ...MELDUNG, title: `${wk} in ${land}` },
    herkunft: { ...HERKUNFT, country: land, originalUrl: url },
    extraktion: { kategorie: kat, wirkstoff: wk },
  });
  store.upsert(bauen('DE', 'SHORTAGE', 'Amoxicillin', 'https://a/1'));
  store.upsert(bauen('AT', 'SHORTAGE', 'Amoxicillin', 'https://a/2'));
  store.upsert(bauen('DE', 'RECALL', 'Pantoprazol', 'https://a/3'));

  assert.equal(store.list({ country: 'DE' }).length, 2);
  assert.equal(store.list({ category: 'SHORTAGE' }).length, 2);
  assert.equal(store.list({ country: 'DE', category: 'RECALL' }).length, 1);
  // Teilzeichenkette: „amoxi" findet „Amoxicillin".
  assert.equal(store.list({ wirkstoff: 'amoxi' }).length, 2);
  assert.equal(store.list({ country: 'DE', wirkstoff: 'amoxi' }).length, 1);
});

test('der Landesstand unterscheidet „noch nie" von „gerade nichts Neues"', () => {
  // Der ganze Unterschied zwischen „kaputt" und „ruhig".
  const store = createSignalStore();
  assert.deepEqual(store.landStand('KE'), { land: 'KE', signale: 0, letzte: null });
  store.upsert(baueSignal({ meldung: MELDUNG, herkunft: HERKUNFT, extraktion: {} }));
  const stand = store.landStand('DE');
  assert.equal(stand.signale, 1);
  assert.ok(stand.letzte, 'der Zeitpunkt des letzten Signals gehört dazu');
});

test('der Doppel-Schlüssel ist aus Quelle UND Adresse gebaut', () => {
  assert.notEqual(dedupeKey('bfarm_news', 'https://a/1'), dedupeKey('pei_news', 'https://a/1'));
  assert.equal(dedupeKey('bfarm_news', 'https://a/1'), dedupeKey('bfarm_news', ' https://a/1 '));
});
