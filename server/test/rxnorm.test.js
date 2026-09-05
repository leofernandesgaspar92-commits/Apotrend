// ============================================================================
//  RxNorm — Wirkstoff und Handelsname zusammenbringen
// ============================================================================
//  Der Dienst hängt an einem fremden Server und läuft im Anfragepfad einer
//  Suche. Geprüft wird deshalb vor allem, was passiert, wenn dieser Server
//  NICHT antwortet — denn das ist der Fall, der eine Apotheke betrifft.
//
//  Es geht kein Abruf ins Netz: `fetchImpl` wird injiziert.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRxNormService, parseRxcui, parseNames } from '../src/services/rxnorm.js';

const stumm = { log() {}, warn() {} };

/** Antwortenpaar wie von RxNav: erst die Kennung, dann die Namen. */
function fakeNav({ rxcui = '40790', namen = null, fail = null, zaehler = null } = {}) {
  const standard = {
    allRelatedGroup: {
      conceptGroup: [
        { tty: 'IN', conceptProperties: [{ name: 'pantoprazole' }] },
        { tty: 'BN', conceptProperties: [{ name: 'Protonix' }, { name: 'Pantoloc' }] },
        { tty: 'PIN', conceptProperties: [{ name: 'pantoprazole sodium' }] },
        // Darreichungsformen: dürfen NICHT in die Synonyme wandern.
        { tty: 'SCD', conceptProperties: [{ name: 'pantoprazole 40 MG Oral Tablet' }] },
        { tty: 'SBD', conceptProperties: [{ name: 'Protonix 40 MG Oral Tablet' }] },
      ],
    },
  };
  return async (url) => {
    if (zaehler) zaehler.push(url);
    if (fail) throw fail;
    const json = url.includes('/rxcui.json')
      ? { idGroup: rxcui ? { rxnormId: [rxcui] } : {} }
      : (namen || standard);
    return { ok: true, json: async () => json };
  };
}

// ── Auswertung ──────────────────────────────────────────────────────────────

test('die Kennung wird aus der Antwort gelesen, fehlende ergibt null', () => {
  assert.equal(parseRxcui({ idGroup: { rxnormId: ['40790', '999'] } }), '40790');
  assert.equal(parseRxcui({ idGroup: {} }), null);
  assert.equal(parseRxcui({}), null);
  assert.equal(parseRxcui(null), null);
});

test('nur NAMEN werden übernommen, keine Darreichungsformen', () => {
  // „Pantoprazol 40 MG Oral Tablet" ist kein Name, nach dem jemand sucht —
  // und würde die Trefferliste mit Varianten derselben Sache fluten.
  const namen = parseNames(
    { allRelatedGroup: { conceptGroup: [
      { tty: 'IN', conceptProperties: [{ name: 'pantoprazole' }] },
      { tty: 'BN', conceptProperties: [{ name: 'Protonix' }] },
      { tty: 'SCD', conceptProperties: [{ name: 'pantoprazole 40 MG Oral Tablet' }] },
    ] } },
  );
  assert.deepEqual(namen.sort(), ['Protonix', 'pantoprazole']);
});

test('eine unbrauchbare Antwort ergibt eine leere Liste, keinen Absturz', () => {
  assert.deepEqual(parseNames({}), []);
  assert.deepEqual(parseNames(null), []);
  assert.deepEqual(parseNames({ allRelatedGroup: { conceptGroup: null } }), []);
});

// ── Dienst ──────────────────────────────────────────────────────────────────

test('zu einem Wirkstoff kommen die Handelsnamen zurück', async () => {
  const rx = createRxNormService({ fetchImpl: fakeNav(), log: stumm });
  const namen = await rx.synonyms('Pantoprazol');
  assert.ok(namen.includes('Protonix'));
  assert.ok(namen.includes('Pantoloc'));
  assert.ok(!namen.some((n) => /Oral Tablet/.test(n)), 'keine Darreichungsformen');
});

test('der eingegebene Begriff kommt nicht als eigenes Synonym zurück', () => {
  // Sonst stünde in der Oberfläche „auch gesucht: Pantoprazol" bei einer
  // Suche nach Pantoprazol — sinnlos und verwirrend.
  return createRxNormService({ fetchImpl: fakeNav(), log: stumm })
    .synonyms('pantoprazole')
    .then((n) => assert.ok(!n.map((x) => x.toLowerCase()).includes('pantoprazole')));
});

test('ein zweiter Aufruf kommt aus dem Zwischenspeicher', async () => {
  const zaehler = [];
  const rx = createRxNormService({ fetchImpl: fakeNav({ zaehler }), log: stumm });
  await rx.synonyms('Pantoprazol');
  const vorher = zaehler.length;
  await rx.synonyms('Pantoprazol');
  assert.equal(zaehler.length, vorher, 'kein zweiter Netzabruf');
  assert.equal(rx.stats().cached, 1);
});

test('auch ein Nicht-Treffer wird gemerkt', async () => {
  // Ein österreichischer Handelsname steht dort oft NICHT drin. Ohne diesen
  // Eintrag liefe bei jeder Suche danach erneut eine Abfrage ins Leere.
  const zaehler = [];
  const rx = createRxNormService({ fetchImpl: fakeNav({ rxcui: null, zaehler }), log: stumm });
  assert.deepEqual(await rx.synonyms('Thrombass'), []);
  const nachErstem = zaehler.length;
  assert.deepEqual(await rx.synonyms('Thrombass'), []);
  assert.equal(zaehler.length, nachErstem);
  assert.equal(rx.stats().misses, 1);
});

test('DER WICHTIGE FALL: fällt der fremde Server aus, wirft die Suche nicht', async () => {
  const rx = createRxNormService({ fetchImpl: fakeNav({ fail: new Error('ETIMEDOUT') }), log: stumm });
  assert.deepEqual(await rx.synonyms('Pantoprazol'), [], 'leere Liste statt Fehler');
  assert.equal(rx.stats().errors, 1);
});

test('ein Ausfall wird NICHT als „keine Synonyme" zwischengespeichert', async () => {
  // Sonst bliebe die Suche für diesen Begriff einen Tag lang schlechter —
  // wegen einer einzigen Zeitüberschreitung.
  let kaputt = true;
  const nav = fakeNav();
  const rx = createRxNormService({
    fetchImpl: async (u) => { if (kaputt) throw new Error('ETIMEDOUT'); return nav(u); },
    log: stumm,
  });
  assert.deepEqual(await rx.synonyms('Pantoprazol'), []);
  kaputt = false;
  const namen = await rx.synonyms('Pantoprazol');
  assert.ok(namen.includes('Protonix'), 'nach der Erholung wird wieder nachgeschlagen');
});

test('sehr kurze Begriffe lösen keinen Abruf aus', async () => {
  const zaehler = [];
  const rx = createRxNormService({ fetchImpl: fakeNav({ zaehler }), log: stumm });
  assert.deepEqual(await rx.synonyms('as'), []);
  assert.deepEqual(await rx.synonyms(''), []);
  assert.equal(zaehler.length, 0, 'zwei Zeichen treffen ohnehin alles');
});

test('ein HTTP-Fehler wird wie ein Ausfall behandelt', async () => {
  const rx = createRxNormService({
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
    log: stumm,
  });
  assert.deepEqual(await rx.synonyms('Pantoprazol'), []);
  assert.equal(rx.stats().errors, 1);
});
