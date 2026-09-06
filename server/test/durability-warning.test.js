// Die Warnung auf dem Registrierungs-Bildschirm: Sie muss erscheinen, wenn der
// Server Konten nicht dauerhaft speichert — und schweigen, wenn er es tut.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Seit dem 06.09.2026 liegen die Sprachtexte in public/i18n.js. Geprueft
// wird, was der Browser zusammen sieht — sonst meldet dieser Test das
// Fehlen einer Uebersetzung, die es sehr wohl gibt.
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8')
  + readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8');

test('die Warnung haengt an der Auskunft, nicht an einer Vermutung', () => {
  assert.match(app, /fetch\('\/api\/health'\)/);
  assert.match(app, /h\.durability === 'sicher'/);
});

test('die Warnung steht in allen drei Sprachen bereit', () => {
  assert.equal((app.match(/au_durability_warn:/g) || []).length, 3);
});
