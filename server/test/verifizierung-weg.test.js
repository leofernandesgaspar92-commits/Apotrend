// Weg zur Betriebs-Bestätigung (Logistik, Tauschbörse): Knopf führt direkt zum Antrag;
// der Antragstext passt zu jeder Kontoart (nicht nur „Apotheke").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const APP = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const I18N = readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8');

test('„Betrieb bestätigen lassen" springt zum Antrag (Feld im Bild, Cursor drin) — von Logistik und Tauschbörse', () => {
  assert.equal((APP.match(/\[data-verify\]'\)(\.onclick)? = \(\) => zurVerifizierung\(\);|if \(vb\) vb\.onclick = \(\) => zurVerifizierung\(\);/g) || []).length, 2);
  assert.ok(!/openProfile\(me\.handle\)\); \};\n.*data-verify/.test(APP));
  const f = APP.slice(APP.indexOf('async function zurVerifizierung('), APP.indexOf('async function openProfile('));
  assert.match(f, /getElementById\('vf_lic'\) \|\| document\.getElementById\('vf_note'\)/);
  assert.match(f, /scrollIntoView\(\{ behavior: 'smooth', block: 'center' \}\); feld\.focus/);
});

test('Antragstext neutral („Betrieb"), in allen 5 Sprachen — kein „Apotheke" für Spedition oder Klinik', () => {
  const texte = [...I18N.matchAll(/vf_desc:(['"])(.*?)(?<!\\)\1/g)].map((m) => m[2]);
  assert.equal(texte.length, 5);
  for (const t of texte) assert.ok(!/Apotheke|pharmacy|farmácia|pharmacie|صيدلي/i.test(t), t);
});
