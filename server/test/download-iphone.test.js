// Downloads (Datenauskunft, Wiederherstellungscodes, CSV) über EINE Funktion. Bis 11/2026 gab jede der vier
// Stellen die Blob-Adresse gleich nach click() frei — Safari (iPhone) bricht den Download dann ab, bekanntes
// WebKit-Verhalten (FileSaver.js wartet deshalb 40 s). Am schwersten wiegt das bei den Wiederherstellungscodes:
// Scheitert der Download still, sperrt man sich später womöglich aus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const APP = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

test('Alle Downloads laufen über dateiSpeichern; Freigabe erst nach 40 s, Link hängt kurz im Dokument', () => {
  const start = APP.indexOf('function dateiSpeichern(name, blob) {');
  assert.ok(start > 0, 'dateiSpeichern fehlt');
  const rumpf = APP.slice(start, APP.indexOf('\n}\n', start));
  assert.match(rumpf, /document\.body\.appendChild\(a\); a\.click\(\); a\.remove\(\);/);
  assert.match(rumpf, /setTimeout\(\(\) => URL\.revokeObjectURL\(url\), 40000\)/);
  // Keine weitere Stelle gibt eine Blob-Adresse frei oder baut einen eigenen Download-Link.
  assert.equal((APP.match(/revokeObjectURL/g) || []).length, 1, 'eine Stelle gibt die Blob-Adresse sofort frei');
  assert.equal((APP.match(/\.download = /g) || []).length, 1, 'eigener Download-Link außerhalb von dateiSpeichern');
  for (const name of ["'apopulse-meine-daten.json'", "'apopulse-wiederherstellungscodes.txt'"]) assert.ok(APP.includes(`dateiSpeichern(${name}`), name);
});
