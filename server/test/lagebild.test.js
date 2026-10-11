// Lagebild je Land (services/lagebild.js) — die Schutzschicht um die KI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  belegeSammeln, lagebildAuftrag, pruefeLagebild, createLagebildDienst, MIN_BELEGE, LAGEBILD_HINWEIS,
} from '../src/services/lagebild.js';

const KI = { APOPULSE_AI_PROVIDER: 'anthropic', APOPULSE_AI_API_KEY: 'test' };
const signal = (o = {}) => ({
  title: 'NAFDAC warnt vor gefälschtem Amoxicillin', summary: 'Charge X betroffen', originalUrl: 'https://nafdac.gov.ng/1',
  sourceName: 'NAFDAC', country: 'NG', publishedAt: '2026-10-09T00:00:00Z', ...o,
});
const presse = (o = {}) => ({ herkunft: 'presse', titel: 'Naira slump drives medicine shortages', url: 'https://punchng.com/2', quelle: 'punchng.com', datum: '2026-10-10T00:00:00Z', ...o });
const presseDienst = (artikel) => ({ fuerLand: async () => ({ artikel, grund: artikel.length ? null : 'keine_artikel' }) });

// ── Belege ───────────────────────────────────────────────────────────────────

test('Belege: nur Meldungen DES Landes (plus EU für EU-Länder), nummeriert, mit Herkunft', () => {
  const b = belegeSammeln('NG', [signal(), signal({ country: 'AT', originalUrl: 'https://basg.gv.at/x' }), signal({ country: 'EU', originalUrl: 'https://ema.europa.eu/x' })], [presse()]);
  assert.deepEqual(b.map((x) => x.url).sort(), ['https://nafdac.gov.ng/1', 'https://punchng.com/2']);
  assert.deepEqual(b.map((x) => x.nr), [1, 2]);
  assert.ok(b.some((x) => x.herkunft === 'behoerde') && b.some((x) => x.herkunft === 'presse'));

  const at = belegeSammeln('AT', [signal({ country: 'EU', originalUrl: 'https://ema.europa.eu/x' })], []);
  assert.equal(at.length, 1, 'EU-Meldungen gehören zu Österreich');
});

test('Belege: ohne Link kein Beleg', () => {
  assert.equal(belegeSammeln('NG', [signal({ originalUrl: null })], [presse({ url: '' })]).length, 0);
});

test('Belege: viel Presse verdrängt die Behörde nicht', () => {
  const vielPresse = Array.from({ length: 40 }, (_, i) => presse({ url: `https://p.ng/${i}`, titel: 'P' + i, datum: '2026-10-11T00:00:00Z' }));
  const b = belegeSammeln('NG', [signal({ publishedAt: '2026-01-01T00:00:00Z' })], vielPresse, { max: 10 });
  assert.equal(b.length, 10);
  assert.ok(b.some((x) => x.herkunft === 'behoerde'), 'die ältere Behördenmeldung fiel aus dem Fenster');
});

test('Auftrag: Herkunft je Beleg sichtbar, Antwortsprache benannt', () => {
  const a = lagebildAuftrag('NG', 'pt', belegeSammeln('NG', [signal()], [presse()]));
  assert.match(a, /\[\d\] \(BEHÖRDE, NAFDAC/);
  assert.match(a, /\[\d\] \(PRESSE, punchng\.com/);
  assert.match(a, /Português/);
  assert.match(a, /Nigeria/);
});

// ── Die Prüfung der Antwort ──────────────────────────────────────────────────

const belege = belegeSammeln('NG', [signal()], [presse()]);

test('Prüfung: ein Punkt ohne gültige Belegnummer wird verworfen', () => {
  const roh = JSON.stringify({ punkte: [
    { text: 'Gefälschtes Amoxicillin im Umlauf.', belege: [1] },
    { text: 'Die Regierung plant Preiskontrollen.', belege: [] },          // kein Beleg
    { text: 'Indien liefert weniger Wirkstoffe.', belege: [7] },          // erfundene Nummer
    { text: 'Laut Medienberichten verschärft der Naira-Verfall die Lage.', belege: ['2', 2, 99] },
  ] });
  const { punkte, verworfen } = pruefeLagebild(roh, belege);
  assert.equal(punkte.length, 2);
  assert.equal(verworfen, 2);
  assert.deepEqual(punkte[1].quellen.map((q) => q.nr), [2], 'doppelte und ungültige Nummern bereinigt');
  assert.equal(punkte[0].quellen[0].url, belege[0].url, 'jeder Punkt trägt die Links seiner Quellen');
});

test('Prüfung: Links im Text werden entfernt — die einzigen Links sind die Belege', () => {
  const roh = JSON.stringify({ punkte: [{ text: 'Mehr unter https://boese.example/x dazu.', belege: [1] }] });
  assert.doesNotMatch(pruefeLagebild(roh, belege).punkte[0].text, /https?:/);
});

test('Prüfung: kaputte Antwort ergibt keine Punkte, keinen Absturz', () => {
  assert.equal(pruefeLagebild('Ich kann das nicht.', belege).punkte.length, 0);
  assert.equal(pruefeLagebild('{"punkte":"nein"}', belege).punkte.length, 0);
});

// ── Der Dienst ───────────────────────────────────────────────────────────────

test('Dienst: ohne KI kein Lagebild — und keine Abfrage', async () => {
  let gefragt = false;
  const d = createLagebildDienst({ env: {}, presse: presseDienst([presse()]), signale: () => [signal()], frage: async () => { gefragt = true; } });
  const r = await d.fuerLand('NG');
  assert.equal(r.verfuegbar, false);
  assert.equal(r.grund, 'ki_aus');
  assert.equal(gefragt, false);
});

test(`Dienst: unter ${MIN_BELEGE} Quellen kein Lagebild — die KI wird gar nicht gefragt`, async () => {
  let gefragt = false;
  const d = createLagebildDienst({ env: KI, presse: presseDienst([]), signale: () => [signal()], frage: async () => { gefragt = true; return '{}'; } });
  const r = await d.fuerLand('NG');
  assert.equal(r.grund, 'zu_wenig_quellen');
  assert.equal(r.quellen_gesamt, 1);
  assert.equal(gefragt, false, 'aus einer Quelle ein „Lagebild" zu machen, hiesse sie umzuschreiben');
});

test('Dienst: die KI bekommt NUR die nummerierten Belege', async () => {
  let auftrag = null, system = null;
  const d = createLagebildDienst({
    env: KI, presse: presseDienst([presse()]), signale: () => [signal()],
    frage: async (_cfg, a, o) => { auftrag = a; system = o.system; return JSON.stringify({ punkte: [{ text: 'X', belege: [1] }] }); },
  });
  const r = await d.fuerLand('NG', { sprache: 'en' });
  assert.equal(r.verfuegbar, true);
  assert.match(system, /AUSSCHLIESSLICH/);
  assert.match(system, /keine Vermutungen/);
  assert.match(auftrag, /English/);
  assert.equal(r.hinweis, LAGEBILD_HINWEIS.en, 'der Hinweis fährt in jeder Antwort mit');
});

test('Dienst: nur unbelegte Punkte -> ehrlich „keine belegte Aussage"', async () => {
  const d = createLagebildDienst({
    env: KI, presse: presseDienst([presse()]), signale: () => [signal()],
    frage: async () => JSON.stringify({ punkte: [{ text: 'Alles wird gut.', belege: [] }] }),
  });
  const r = await d.fuerLand('NG');
  assert.equal(r.verfuegbar, false);
  assert.equal(r.grund, 'keine_belegte_aussage');
  assert.equal(r.verworfen, 1);
});

test('Dienst: Fehlschlag wird nicht gespeichert, Erfolg je Belegstand schon', async () => {
  let n = 0;
  const antworten = [new Error('HTTP 529'), JSON.stringify({ punkte: [{ text: 'A', belege: [1] }] })];
  const d = createLagebildDienst({
    env: KI, presse: presseDienst([presse()]), signale: () => [signal()],
    frage: async () => { n++; const a = antworten.shift(); if (a instanceof Error) throw a; return a; },
  });
  assert.equal((await d.fuerLand('NG')).grund, 'ki_fehler');
  assert.equal((await d.fuerLand('NG')).verfuegbar, true, 'der Fehlschlag blieb nicht hängen');
  const dritter = await d.fuerLand('NG');
  assert.equal(n, 2, 'gleicher Belegstand -> kein neuer Aufruf');
  assert.equal(dritter.zwischengespeichert, true);
});
