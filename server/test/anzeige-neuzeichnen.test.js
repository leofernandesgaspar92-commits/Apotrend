// Anzeigen nach Sprachwechsel und beim Neuzeichnen (11/2026). Beim ersten Start mit fremder
// Browser-Sprache lädt die App die Kontosprache nach und zeichnet neu — die rechte Spalte (Anzeige,
// Schnellzugriff) blieb dabei in der alten Sprache, und jede Neuzeichnung holte die Anzeige erneut
// (der Server zählt jede Auslieferung als Einblendung). Das Verhalten prüft der Browser-Audit mit
// absichtlich langsamer Sprachdatei; hier die Bausteine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const fn = (name) => { const i = app.indexOf(name); assert.ok(i >= 0, name + ' fehlt'); return app.slice(i, app.indexOf('\n}\n', i)); };

test('Sprachwechsel zeichnet auch die rechte Spalte neu', () => {
  assert.match(fn('function neuZeichnen() {'), /if \(me\) \{ updateViewContext\(\); seitenleisteZeichnen\(\); loadTab\(\); \}/);
  const sl = fn('function seitenleisteZeichnen() {');
  for (const teil of ['renderQuickRail()', "zeigeAnzeige('seite', sp)", 'renderAdSlot()']) assert.ok(sl.includes(teil), teil);
  assert.match(fn('async function mainScreen('), /seitenleisteZeichnen\(\);/);
});

test('Neuzeichnen ist keine neue Einblendung: laufende Anfrage gemerkt (je Konto und Platz, 60 s); Ausblenden/Melden leert', () => {
  const z = fn('async function zeigeAnzeige(platz, ziel, vor = null) {');
  assert.match(z, /const merk = \(\(me && me\.id\) \|\| ''\) \+ '\|' \+ platz;/);
  assert.match(z, /eintrag = \{ at: Date\.now\(\), p: api\('GET', '\/api\/anzeigen\/platz\/' \+ platz\) \};/, 'Merker speichert nicht die laufende Anfrage');
  assert.match(z, /Date\.now\(\) - eintrag\.at >= 60000/);
  const k = fn('function anzeigeKarte(a) {');
  assert.match(k, /\/ausblenden`\); ANZEIGE_MERKER\.clear\(\);/, 'ausgeblendete Anzeige käme aus dem Merker zurück');
  assert.match(k, /\/melden`, \{ grund \}\); ANZEIGE_MERKER\.clear\(\);/);
});
