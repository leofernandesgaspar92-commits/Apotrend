// Premium (10/2026): „Womit zahlst du?" statt aller Wallets untereinander. Das
// Krypto-Bezahlen muss vollständig bleiben (Owner: wichtig für die Afrika-Strategie) —
// geprüft wird, dass jeder Zahlweg einen Knopf hat und keiner verloren geht.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/app.css', import.meta.url), 'utf8');

test('jeder Zahlweg hat einen Knopf, der erste ist vorgewählt, keiner wird entfernt', () => {
  const k = app.slice(app.indexOf("if (opt.coins.length > 1) {"), app.indexOf("body.appendChild(el(`<div class=\"muted\" style=\"font-size:13px;margin-top:10px\">${esc(t('pr_note'))}"));
  assert.match(k, /opt\.coins\.map\(\(c, i\) => `<button type="button" class="small sortbtn\$\{i \? '' : ' active'\}"/);
  assert.match(k, /opt\.coins\.forEach\(\(c, i\) => \{/, 'alle Wallets werden weiter gebaut');
  assert.match(k, /<div class="crypto-pay" data-coinid="\$\{esc\(c\.id\)\}"\$\{i && opt\.coins\.length > 1 \? ' hidden' : ''\}>/);
  assert.match(k, /k\.hidden = k\.dataset\.coinid !== b\.dataset\.coin;/);
  assert.match(css, /\.crypto-pay\[hidden\] \{ display:none; \}/);
});
