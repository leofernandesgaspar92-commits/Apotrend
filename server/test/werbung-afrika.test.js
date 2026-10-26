// Werben aus Sicht einer Firma in Nigeria (26.10.2026): Firmenkonto führt zurück zur Buchung,
// Zielländer beginnen beim eigenen Land und der eigenen Region, Zahlwege nennen die echten Münzen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { cryptoWallets } from '../src/data/cryptoWallets.js';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const srv = readFileSync(new URL('../src/http/server.js', import.meta.url), 'utf8');
const abschnitt = (von, bis) => app.slice(app.indexOf(von), app.indexOf(bis, app.indexOf(von)));

test('Zielländer: eigenes Land, dann eigene Region, dann der Rest — je alphabetisch', () => {
  const code = abschnitt('function wbLaenderFolge(', 'async function openWerbung(') + abschnitt('function landAnzeige(', '\n}\n') + '\n}';
  const L = [['AT', 'EUROPE'], ['DE', 'EUROPE'], ['NG', 'AFRICA'], ['GH', 'AFRICA'], ['KE', 'AFRICA'], ['US', 'AMERICAS']].map(([code, region]) => ({ code, region, flag: '🏳', name: code }));
  const r = vm.runInNewContext(code + ';wbLaenderFolge(L, "NG").map((c) => c.code)', { L, COUNTRIES_CACHE: L, LOCALE: 'en', Intl });
  assert.deepEqual([...r], ['NG', 'GH', 'KE', 'AT', 'DE', 'US']);
});

test('„Firmenkonto anlegen": Kontotyp Großhandel, Hinweis, danach direkt zur Werbung', () => {
  assert.match(app, /data-wbkonto\]'\); if \(k\) k\.onclick = \(\) => \{ try \{ localStorage\.setItem\('apo_absicht', JSON\.stringify\(\{ werbung: true \}\)\)/);
  assert.match(app, /accountTypeOptionsHtml\(ab && ab\.werbung \? 'wholesale' : 'pharmacy'\)/);
  assert.match(app, /if \(absicht && absicht\.werbung\) \{[\s\S]{0,200}openWerbung\(\);\s*return;/);
});

test('Mediadaten nennen die eingerichteten Münzen (USDT, sobald Tron eingerichtet ist)', () => {
  assert.match(srv, /krypto_muenzen: \[\.\.\.new Set\(cryptoWallets\(\)\.map\(\(w\) => w\.symbol\)\)\]/);
  const mitTron = [...new Set(cryptoWallets({ APOPULSE_WALLET_TRON: 'TXyz123456789012345678901234567890' }).map((w) => w.symbol))];
  assert.ok(mitTron.includes('USDT'), mitTron.join());
  assert.match(app, /ti\('wb2_krypto_mit', \{ muenzen: md\.zahlung\.krypto_muenzen\.join\(', '\) \}\)/);
});
