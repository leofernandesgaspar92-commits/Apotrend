// Die Warnung auf dem Registrierungs-Bildschirm: Sie muss erscheinen, wenn der
// Server Konten nicht dauerhaft speichert — und schweigen, wenn er es tut.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

test('die Warnung haengt an der Auskunft, nicht an einer Vermutung', () => {
  assert.match(app, /fetch\('\/api\/health'\)/);
  assert.match(app, /h\.durability === 'sicher'/);
});

test('die Warnung steht in allen drei Sprachen bereit', () => {
  assert.equal((app.match(/au_durability_warn:/g) || []).length, 3);
});
