// Regressionstests für den BASG-Engpass-Parser (backend/api/engpass.js).
// Läuft ohne Netzwerk gegen synthetisches BASG-XML.  Ausführen: `node --test`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBasgXml, mapStatus, fmtDate, decodeEntities, STATUS_RANK } from '../api/engpass.js';

// Synthetisches XML in der offiziellen BASG-Struktur (<Packungen><Packung>…).
const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Packungen>
  <Packung>
    <Zulassungsnummer>1-23456</Zulassungsnummer>
    <Bezeichnung_Arzneispezialitaet>Amoxicillin 1000 mg Filmtabletten</Bezeichnung_Arzneispezialitaet>
    <Status>nicht verf&#252;gbar</Status>
    <Wirkstoffe>Amoxicillin</Wirkstoffe>
    <Grund>Erh&#246;hte Nachfrage</Grund>
    <Beginn_Vertriebseinschraenkung>2026-01-15</Beginn_Vertriebseinschraenkung>
    <Datum_letzte_Aenderung>2026-06-01</Datum_letzte_Aenderung>
    <Datum_voraussichtliche_Wiederbelieferung>2026-08-01</Datum_voraussichtliche_Wiederbelieferung>
  </Packung>
  <Packung>
    <Zulassungsnummer>1-23457</Zulassungsnummer>
    <Bezeichnung_Arzneispezialitaet>Amoxicillin 1000 mg Filmtabletten</Bezeichnung_Arzneispezialitaet>
    <Status>eingeschr&#228;nkt verf&#252;gbar</Status>
    <Wirkstoffe>Amoxicillin</Wirkstoffe>
    <Datum_voraussichtliche_Wiederbelieferung>2026-07-01</Datum_voraussichtliche_Wiederbelieferung>
  </Packung>
  <Packung>
    <Zulassungsnummer>2-99999</Zulassungsnummer>
    <Bezeichnung_Arzneispezialitaet>Levothyroxin 100 &#181;g Tabletten</Bezeichnung_Arzneispezialitaet>
    <Status>verf&#252;gbar</Status>
    <Wirkstoffe>Levothyroxin-Natrium</Wirkstoffe>
  </Packung>
</Packungen>`;

test('mapStatus bildet offizielle BASG-Statuswerte korrekt ab', () => {
  assert.equal(mapStatus('nicht verfügbar'), 'kritisch');
  assert.equal(mapStatus('eingeschränkt verfügbar'), 'eingeschraenkt');
  assert.equal(mapStatus('verfügbar gemäß § 4 (1)'), 'eingeschraenkt');
  assert.equal(mapStatus('verfügbar'), 'verfuegbar');
  assert.equal(mapStatus(''), 'verfuegbar');
});

test('STATUS_RANK ordnet kritisch > eingeschraenkt > verfuegbar', () => {
  assert.ok(STATUS_RANK.kritisch > STATUS_RANK.eingeschraenkt);
  assert.ok(STATUS_RANK.eingeschraenkt > STATUS_RANK.verfuegbar);
});

test('decodeEntities dekodiert benannte und numerische Entities', () => {
  assert.equal(decodeEntities('A &amp; B'), 'A & B');
  assert.equal(decodeEntities('erh&#246;ht'), 'erhöht');
});

test('fmtDate normalisiert ISO- und Leer-Datum', () => {
  assert.equal(fmtDate('2026-08-01'), '01.08.2026');
  assert.equal(fmtDate(''), '—');
});

test('parseBasgXml gruppiert nach Arzneispezialität, schlechtester Status gewinnt', () => {
  const items = parseBasgXml(SAMPLE_XML);
  // 2 Produkte (die zwei Amoxicillin-Packungen werden zu einem gruppiert)
  assert.equal(items.length, 2);
  const amox = items.find(i => i.name.startsWith('Amoxicillin'));
  assert.ok(amox, 'Amoxicillin-Produkt vorhanden');
  // schlechtester Packungs-Status (kritisch) gewinnt gegenüber eingeschraenkt
  assert.equal(amox.status, 'kritisch');
  assert.equal(amox.wirkstoff, 'Amoxicillin');
  assert.equal(amox.quelle, 'BASG');
  assert.equal(amox.bis, '01.08.2026');
});

test('parseBasgXml erfindet keine Alternativen (alt bleibt Platzhalter)', () => {
  const items = parseBasgXml(SAMPLE_XML);
  for (const i of items) assert.equal(i.alt, '—');
});

test('parseBasgXml liefert bei leerem/kaputtem XML ein leeres Array', () => {
  assert.deepEqual(parseBasgXml(''), []);
  assert.deepEqual(parseBasgXml('<html>kein xml</html>'), []);
});
