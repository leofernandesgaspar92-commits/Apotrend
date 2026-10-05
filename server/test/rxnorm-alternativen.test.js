// ============================================================================
//  Ausweich-Suche über RxNorm
// ============================================================================
//  Der Auftrag nannte das „baugleiche Ausweichpräparate". Genau diese Aussage
//  macht der Dienst NICHT — und darf sie nicht machen:
//
//    Austauschbarkeit hängt an Darreichungsform, Stärke, Hilfsstoffen und
//    nationaler Zulassung. RxNorm kennt davon nur den Wirkstoff.
//
//  Wer „bioäquivalent" an diese Liste schreibt, verwandelt eine Namensauskunft
//  in eine Abgabeempfehlung. Danach wird in einer Apotheke gehandelt. Der
//  erste Test unten hält deshalb fest, dass der einschränkende Hinweis in
//  JEDER Antwort steckt — auch in der leeren.
//
//  Die zweite Eigenschaft, die hier geprüft wird: Der Unterschied zwischen
//  „RxNorm kennt den Namen nicht" (bei deutschen Handelsnamen der Normalfall)
//  und „es gibt keine Präparate". Beides als leere Liste auszugeben würde eine
//  Eigenschaft des US-Bestands wie einen Defekt aussehen lassen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRxNormService, parseRelated, rxnavLink, SUBSTITUTIONS_HINWEIS,
} from '../src/services/rxnorm.js';

const stumm = { log() {}, warn() {}, error() {} };

/** RxNav-Doppelgänger: Pfad -> Antwort. */
function rxnav(antworten, { aufrufe = [] } = {}) {
  return createRxNormService({
    log: stumm,
    fetchImpl: async (url) => {
      const pfad = String(url).replace('https://rxnav.nlm.nih.gov/REST', '');
      aufrufe.push(pfad);
      for (const [muster, body] of Object.entries(antworten)) {
        if (pfad.includes(muster)) {
          if (body instanceof Error) throw body;
          return { ok: true, status: 200, json: async () => body };
        }
      }
      return { ok: false, status: 404, json: async () => ({}) };
    },
  });
}

const RXCUI = { idGroup: { rxnormId: ['7646'] } };
const WIRKSTOFF = {
  relatedGroup: {
    conceptGroup: [
      { tty: 'IN', conceptProperties: [{ rxcui: '7646', name: 'pantoprazole' }] },
      { tty: 'PIN', conceptProperties: [{ rxcui: '7647', name: 'pantoprazole sodium' }] },
    ],
  },
};
const PRAEPARATE = {
  relatedGroup: {
    conceptGroup: [
      { tty: 'SBD', conceptProperties: [{ rxcui: '111', name: 'Protonix 40 MG Oral Tablet' }] },
      { tty: 'SCD', conceptProperties: [{ rxcui: '222', name: 'pantoprazole 40 MG Oral Tablet' }] },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  Der Hinweis ist nicht optional
// ─────────────────────────────────────────────────────────────────────────────

test('der einschraenkende Hinweis steckt in JEDER Antwort', async () => {
  const voll = rxnav({ '/rxcui.json': RXCUI, 'tty=IN+PIN': WIRKSTOFF, 'tty=SBD+SCD': PRAEPARATE });
  const leer = rxnav({ '/rxcui.json': { idGroup: {} } });
  const kaputt = rxnav({ '/rxcui.json': new Error('weg') });

  for (const [was, svc, term] of [
    ['Vollantwort', voll, 'Protonix'],
    ['unbekannter Name', leer, 'Pantoloc'],
    ['Netzfehler', kaputt, 'Protonix'],
    ['zu kurz', voll, 'ab'],
  ]) {
    const r = await svc.alternativen(term);
    assert.equal(r.hinweis, SUBSTITUTIONS_HINWEIS, was + ': Hinweis fehlt');
  }
});

test('der Hinweis sagt ausdruecklich, dass es KEINE Austauschbarkeits-Aussage ist', () => {
  assert.match(SUBSTITUTIONS_HINWEIS, /KEINE Aussage über Austauschbarkeit/);
  assert.match(SUBSTITUTIONS_HINWEIS, /Darreichungsform/);
  assert.match(SUBSTITUTIONS_HINWEIS, /nationaler Zulassung/);
  // Und wer entscheidet.
  assert.match(SUBSTITUTIONS_HINWEIS, /Apotheke/);
  // Was NICHT drinstehen darf:
  assert.doesNotMatch(SUBSTITUTIONS_HINWEIS, /bioäquivalent|baugleich|austauschbar sind/i);
});

// ─────────────────────────────────────────────────────────────────────────────
//  „Kennt den Namen nicht" ist kein Defekt
// ─────────────────────────────────────────────────────────────────────────────

test('ein unbekannter Handelsname ergibt „unbekannt", nicht „keine"', async () => {
  // Der Normalfall fuer deutsche und oesterreichische Handelsnamen: RxNorm ist
  // das US-Vokabular. Das als „nichts gefunden" auszugeben liesse eine
  // Eigenschaft des Bestands wie einen Fehler aussehen.
  const svc = rxnav({ '/rxcui.json': { idGroup: {} } });
  const r = await svc.alternativen('Pantoloc');
  assert.equal(r.grund, 'unbekannt');
  assert.deepEqual(r.wirkstoffe, []);
  assert.deepEqual(r.praeparate, []);
});

test('ein Netzfehler ergibt „nicht_erreichbar" und wird NICHT zwischengespeichert', async () => {
  let n = 0;
  const svc = createRxNormService({
    log: stumm,
    fetchImpl: async (url) => {
      n++;
      if (n === 1) throw new Error('ECONNRESET');
      const pfad = String(url);
      if (pfad.includes('/rxcui.json')) return { ok: true, status: 200, json: async () => RXCUI };
      if (pfad.includes('tty=IN+PIN')) return { ok: true, status: 200, json: async () => WIRKSTOFF };
      return { ok: true, status: 200, json: async () => PRAEPARATE };
    },
  });
  assert.equal((await svc.alternativen('Protonix')).grund, 'nicht_erreichbar');
  // Ein Netzausfall ist keine Aussage darueber, was RxNorm kennt — der zweite
  // Versuch muss erneut fragen.
  const zweiter = await svc.alternativen('Protonix');
  assert.equal(zweiter.grund, null);
  assert.equal(zweiter.wirkstoffe.length, 2);
});

test('gefundene Wirkstoffe ohne Praeparate ergeben „keine_praeparate"', async () => {
  const svc = rxnav({
    '/rxcui.json': RXCUI, 'tty=IN+PIN': WIRKSTOFF,
    'tty=SBD+SCD': { relatedGroup: { conceptGroup: [] } },
  });
  const r = await svc.alternativen('Protonix');
  assert.equal(r.grund, 'keine_praeparate');
  // Der Wirkstoff ist trotzdem da — und er ist der nuetzliche Teil, weil der
  // INN international ist.
  assert.equal(r.wirkstoffe.length, 2);
});

test('zu kurze Eingaben loesen keine Abfrage aus', async () => {
  const aufrufe = [];
  const svc = rxnav({ '/rxcui.json': RXCUI }, { aufrufe });
  for (const t of ['', 'a', 'ab', null]) {
    const r = await svc.alternativen(t);
    assert.equal(r.grund, 'zu_kurz');
  }
  assert.equal(aufrufe.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
//  Die eigentliche Auskunft
// ─────────────────────────────────────────────────────────────────────────────

test('Wirkstoff und Praeparate kommen mit Kennung und Rueckverweis', async () => {
  const svc = rxnav({ '/rxcui.json': RXCUI, 'tty=IN+PIN': WIRKSTOFF, 'tty=SBD+SCD': PRAEPARATE });
  const r = await svc.alternativen('Protonix');
  assert.equal(r.rxcui, '7646');
  assert.deepEqual(r.wirkstoffe.map((w) => w.name), ['pantoprazole', 'pantoprazole sodium']);
  assert.deepEqual(r.praeparate.map((pr) => pr.name), ['Protonix 40 MG Oral Tablet', 'pantoprazole 40 MG Oral Tablet']);
  // Herkunft an JEDER Zeile — dieselbe Regel wie bei den Behoerdenmeldungen.
  // Hier besonders wichtig, weil der Bestand US-amerikanisch ist und eine
  // Apothekerin pruefen koennen muss, was dort wirklich steht.
  assert.match(r.quelle, /mor\.nlm\.nih\.gov\/RxNav/);
  for (const w of r.wirkstoffe) assert.match(w.quelle, /RXCUI/);
  for (const pr of r.praeparate) assert.match(pr.quelle, /RXCUI/);
});

test('der eingegebene Begriff erscheint nicht als eigenes Ausweichpraeparat', async () => {
  const svc = rxnav({
    '/rxcui.json': RXCUI, 'tty=IN+PIN': WIRKSTOFF,
    'tty=SBD+SCD': {
      relatedGroup: {
        conceptGroup: [{
          tty: 'SBD',
          conceptProperties: [
            { rxcui: '1', name: 'Protonix' },
            { rxcui: '2', name: 'Andere Marke' },
          ],
        }],
      },
    },
  });
  const r = await svc.alternativen('Protonix');
  assert.deepEqual(r.praeparate.map((pr) => pr.name), ['Andere Marke']);
});

test('die Praeparateliste wird begrenzt', async () => {
  const viele = {
    relatedGroup: {
      conceptGroup: [{
        tty: 'SCD',
        conceptProperties: Array.from({ length: 80 }, (_, i) => ({ rxcui: String(i), name: 'Mittel ' + i })),
      }],
    },
  };
  const svc = rxnav({ '/rxcui.json': RXCUI, 'tty=IN+PIN': WIRKSTOFF, 'tty=SBD+SCD': viele });
  const r = await svc.alternativen('Protonix', { maxPraeparate: 5 });
  assert.equal(r.praeparate.length, 5);
});

test('der fuehrende Wirkstoff ist IN, nicht PIN', async () => {
  // Bei einem Kombinationspraeparat waere die Vereinigung aller Wirkstoffe eine
  // Liste, in der kein Eintrag dasselbe enthaelt wie das Original. Deshalb
  // fuehrt genau EINER — und das ist der Wirkstoff (IN), nicht das Salz (PIN).
  const aufrufe = [];
  const svc = rxnav({ '/rxcui.json': RXCUI, 'tty=IN+PIN': WIRKSTOFF, 'tty=SBD+SCD': PRAEPARATE }, { aufrufe });
  await svc.alternativen('Protonix');
  // 7646 = IN (pantoprazole), 7647 = PIN. Der zweite Schritt muss auf 7646 gehen.
  assert.ok(aufrufe.some((a) => a.includes('/rxcui/7646/related.json?tty=SBD+SCD')),
    'der IN-Wirkstoff fuehrt nicht: ' + aufrufe.join(', '));
  assert.ok(!aufrufe.some((a) => a.includes('/rxcui/7647/related.json?tty=SBD+SCD')));
});

test('ein zweiter Aufruf kommt aus dem Zwischenspeicher', async () => {
  const aufrufe = [];
  const svc = rxnav({ '/rxcui.json': RXCUI, 'tty=IN+PIN': WIRKSTOFF, 'tty=SBD+SCD': PRAEPARATE }, { aufrufe });
  await svc.alternativen('Protonix');
  const n = aufrufe.length;
  await svc.alternativen('Protonix');
  assert.equal(aufrufe.length, n, 'die Schnittstelle bittet um Zurueckhaltung — ein zweiter Netzaufruf waere unnoetig');
});

test('Ausweich-Suche und Synonym-Suche teilen den Speicher nicht', async () => {
  // Zwei verschiedene Fragen mit zwei verschiedenen Antwortformen. Ein
  // gemeinsamer Schluessel wuerde die eine mit der anderen beantworten.
  const svc = rxnav({
    '/rxcui.json': RXCUI,
    'tty=IN+PIN': WIRKSTOFF, 'tty=SBD+SCD': PRAEPARATE,
    '/allrelated.json': { allRelatedGroup: { conceptGroup: [{ tty: 'BN', conceptProperties: [{ name: 'Protonix' }] }] } },
  });
  const alt = await svc.alternativen('pantoprazole');
  const syn = await svc.synonyms('pantoprazole');
  assert.ok(Array.isArray(syn), 'Synonyme bleiben ein Array');
  assert.ok(alt.wirkstoffe, 'die Ausweich-Antwort bleibt ein Objekt');
  assert.notDeepEqual(alt, syn);
});

// ─────────────────────────────────────────────────────────────────────────────
//  Auswertung ohne Netz
// ─────────────────────────────────────────────────────────────────────────────

test('parseRelated liefert Name, Art und Kennung — und dedupliziert', () => {
  const r = parseRelated({
    relatedGroup: {
      conceptGroup: [
        { tty: 'IN', conceptProperties: [{ rxcui: '1', name: 'ibuprofen' }, { rxcui: '1', name: 'ibuprofen' }] },
        { tty: 'SBD', conceptProperties: [{ rxcui: '2', name: 'Nurofen' }] },
      ],
    },
  });
  assert.deepEqual(r, [
    { name: 'ibuprofen', tty: 'IN', rxcui: '1' },
    { name: 'Nurofen', tty: 'SBD', rxcui: '2' },
  ]);
});

test('parseRelated filtert nach Art und haelt Unbrauchbares heraus', () => {
  const json = {
    relatedGroup: {
      conceptGroup: [
        { tty: 'IN', conceptProperties: [{ rxcui: '1', name: 'ibuprofen' }] },
        { tty: 'DF', conceptProperties: [{ rxcui: '9', name: 'Oral Tablet' }] },
        { tty: 'SBD', conceptProperties: [{ rxcui: '3', name: '   ' }] },
      ],
    },
  };
  assert.deepEqual(parseRelated(json, { kinds: ['IN'] }).map((x) => x.name), ['ibuprofen']);
  // Namenlose Eintraege fallen heraus, statt als leere Zeile zu erscheinen.
  assert.deepEqual(parseRelated(json, { kinds: ['SBD'] }), []);
});

test('parseRelated uebersteht kaputte Antworten', () => {
  for (const j of [null, {}, { relatedGroup: {} }, { relatedGroup: { conceptGroup: null } }]) {
    assert.deepEqual(parseRelated(j), []);
  }
});

test('rxnavLink zeigt auf die nachschlagbare Seite', () => {
  assert.equal(rxnavLink('7646'), 'https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=7646');
  // Kodiert, damit eine ungewoehnliche Kennung die Adresse nicht zerlegt.
  assert.match(rxnavLink('a b&c'), /searchTerm=a%20b%26c/);
});
