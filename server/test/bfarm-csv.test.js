// BfArM-Lieferengpassliste (CSV) — so, wie sie laut öffentlich sichtbarem
// Kopf aussieht: Semikolon, Windows-1252, KEINE Statusspalte, Tippfehler
// „Arzneimittlbezeichnung", deutsche Datumsangaben.
//
// Ohne Anpassung wäre jede Zeile verworfen worden („Status unbekannt").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shortagesFromCsv, textDekodieren, isoDatum, sourcesByKind } from '../src/services/sources.js';

const BFARM_KOPF = 'PZN;ENR;Bearbeitungsnummer;Referenz Erstmeldung;Meldungsart;Beginn;Ende;Datum der letzten Meldung;Art des Grundes;Arzneimittlbezeichnung;ATC Code;Wirkstoffe;Krankenhausrelevant;Zulassungsinhaber;Grund';
const bfarmZeile = (pzn, name, wirkstoff, beginn, ende, grund = 'Erhöhte Nachfrage') =>
  `${pzn};2100000;LE-1;;Erstmeldung;${beginn};${ende};${beginn};Sonstige;${name};J01CA04;${wirkstoff};nein;Beispiel Pharma GmbH;${grund}`;
// Windows-1252-Bytes: so kommt die Datei an.
const alsWin1252 = (text) => Uint8Array.from([...text].map((c) => { const n = c.charCodeAt(0); if (n > 255) throw new Error('nicht in 1252'); return n; }));

const CSV = [BFARM_KOPF,
  bfarmZeile('01234567', 'Amoxicillin 1000 mg Filmtabletten', 'Amoxicillin', '01.09.2026', '31.12.2026'),
  bfarmZeile('07654321', 'Salbutamol Dosieraerosol', 'Salbutamol', '01.03.2026', '30.06.2026'),
].join('\r\n');

test('Windows-1252 wird erkannt — „Erhöhte", nicht „Erhhte"', () => {
  const text = textDekodieren(alsWin1252(CSV), 'text/csv');
  assert.match(text, /Erhöhte Nachfrage/);
  assert.equal(textDekodieren(new TextEncoder().encode('Grüße'), ''), 'Grüße', 'echtes UTF-8 bleibt UTF-8');
  assert.equal(textDekodieren(alsWin1252('Grüße'), 'text/csv; charset=ISO-8859-1'), 'Grüße', 'Zeichensatz aus dem Kopf');
});

test('ohne Statusspalte: Standardstatus, Ende vorbei -> verfügbar', () => {
  const { rows, rejected } = shortagesFromCsv(CSV, { standardStatus: 'eingeschraenkt', heute: '2026-10-13' });
  assert.equal(rejected.length, 0, rejected.join(' | '));
  assert.deepEqual(rows.map((r) => [r.bezeichnung, r.wirkstoff, r.status]), [
    ['Amoxicillin 1000 mg Filmtabletten', 'Amoxicillin', 'eingeschraenkt'],
    ['Salbutamol Dosieraerosol', 'Salbutamol', 'verfuegbar'],
  ]);
  assert.equal(rows[0].gemeldet_am, '2026-09-01', 'deutsches Datum in ISO');
  assert.equal(rows[0].voraussichtlich_bis, '2026-12-31');
});

test('ohne Standardstatus wäre jede Zeile verworfen worden — und ein unbekannter Status bleibt verworfen', () => {
  assert.equal(shortagesFromCsv(CSV).rows.length, 0);
  const mitSpalte = 'Bezeichnung;Status\r\nA 500 mg;irgendwas';
  assert.equal(shortagesFromCsv(mitSpalte, { standardStatus: 'eingeschraenkt' }).rows.length, 0,
    'Standardstatus darf einen vorhandenen, unbekannten Status nicht überdecken');
});

test('isoDatum: nur das eindeutige deutsche Format wird umgestellt', () => {
  assert.equal(isoDatum('3.4.2026'), '2026-04-03');
  assert.equal(isoDatum('03/04/2026'), '03/04/2026', 'US/GB-Mehrdeutigkeit wird nicht geraten');
  assert.equal(isoDatum('2026-04-03'), '2026-04-03');
  assert.equal(isoDatum(''), null);
});

test('die eingebaute BfArM-Quelle ist angeschlossen (DE, CSV, Standardstatus)', () => {
  const q = sourcesByKind('shortages', {}).find((s) => s.id === 'bfarm_shortages');
  assert.deepEqual([q.country, q.format, q.standardStatus], ['DE', 'csv', 'eingeschraenkt']);
});
