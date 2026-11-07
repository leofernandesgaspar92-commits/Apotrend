// Krypto-Zahlung Premium: „Gestartet" muss VOR der Zahlung liegen.
// Fund 11/2026: Die Premium-Seite startete die Zahlung erst beim Melden der Transaktions-ID —
// „Gestartet" = „Gemeldet", also immer NACH der echten Zahlung. Prüfpunkt 3 der Redaktion sagt aber:
// „Liegt die Transaktion vor ‚Gestartet‘, ist es vermutlich eine abgeschriebene fremde Zahlung."
// Wer sich daran hielt, musste JEDE echte Premium-Zahlung für Betrug halten. (Anzeigen: richtig.)
// Jetzt: Start beim ersten Griff zur Adresse (Wallet öffnen / Adresse kopieren), gemerkt über das
// Neuladen hinweg (Wechsel in die Wallet-App); Meldung nutzt genau diese Zahlung. Fehlt der Start
// (anderes Gerät), sagt die Prüfliste ehrlich, dass Punkt 3 hier nicht greift.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = readFileSync(join(ROOT, 'public', 'app.js'), 'utf8');
const I18N = readFileSync(join(ROOT, 'public', 'i18n.js'), 'utf8');
const AUDIT = readFileSync(join(ROOT, 'tools', 'loop-browser-audit.mjs'), 'utf8');

test('Premium: Start beim Griff zur Adresse, Meldung nutzt denselben Start', () => {
  assert.match(APP, /async function kryptoStartMerken\(plan, walletId[,)]/);
  const f = APP.slice(APP.indexOf('async function kryptoStartMerken('), APP.indexOf('async function kryptoStartMerken(') + 1500);
  assert.match(f, /localStorage\.getItem\('apo_krypto_start'\)/);
  assert.match(f, /st\.uid === \(me && me\.id\) && st\.plan === plan && st\.wallet === walletId/, 'Start eines anderen Kontos/Plans/Wallets übernommen');
  assert.match(APP, /cc\.querySelector\('\.btn-link'\)\.addEventListener\('click', \(\) => \{ kryptoStartMerken\(prPlan, c\.id\)\.catch\(\(\) => \{\}\); \}\);/, 'Wallet öffnen startet nicht');
  assert.match(APP, /\[data-copy\]'\)\.onclick = async \(e\) => \{ kryptoStartMerken\(prPlan, c\.id\)\.catch\(\(\) => \{\}\);/, 'Adresse kopieren startet nicht');
  assert.match(APP, /const pid = await kryptoStartMerken\(prPlan, c\.id\);/, 'Meldung startet neu statt den gemerkten Start zu nutzen');
  assert.match(APP, /localStorage\.removeItem\('apo_krypto_start'\)/, 'gemerkter Start wird nach der Meldung nicht gelöscht');
  // Abmelden: gemerkter Start gehört dem Konto.
  const leeren = APP.slice(APP.indexOf('async function offlineSpeicherLeeren()'), APP.indexOf('async function offlineSpeicherLeeren()') + 700);
  assert.match(leeren, /apo_krypto_start/);
});

test('Prüfliste: Start ≈ Meldung → Hinweis, dass Punkt 3 nicht greift (5 Sprachen)', () => {
  assert.match(APP, /data-kpgleichzeitig/);
  assert.match(APP, /Math\.abs\(Date\.parse\(z\.claimed_at\) - Date\.parse\(z\.created_at\)\) < 15000/);
  for (const sp of ['de', 'en', 'pt', 'fr', 'ar']) {
    const start = I18N.indexOf(`\n  ${sp}: {`);
    const blk = I18N.slice(start, I18N.indexOf('\n  },', start));
    assert.match(blk, /[\s,]kp_gleichzeitig:/, `kp_gleichzeitig fehlt (${sp})`);
  }
});

test('Browser-Audit prüft den echten Ablauf (kopieren → warten → melden → Start vor Meldung)', () => {
  assert.match(AUDIT, /Krypto-Premium: Start vor der Meldung/);
  assert.match(AUDIT, /Krypto-Anzeige: Start vor der Meldung/);
});

// Fund 11/2026, Folgezyklus: Bei Anzeigen derselbe Fehler (Start erst beim Melden) — der HTTP-Test rief die
// Schnittstelle in der richtigen Reihenfolge, die Oberfläche nicht. Dazu fehlten „Adresse kopieren" und
// „In Wallet-App öffnen": Die lange Adresse musste von Hand markiert werden.
test('Anzeige: Kopieren/Wallet-Knopf, Start beim Griff zur Adresse, Meldung nutzt ihn', () => {
  const f = APP.slice(APP.indexOf('async function zahlungKampagne('), APP.indexOf('async function zeigeRechnung('));
  assert.match(f, /href="\$\{esc\(c\.uri\)\}"[^>]*data-wbwallet/, 'kein „In Wallet-App öffnen"');
  assert.match(f, /<button class="ghost small" data-wbkopie>\$\{esc\(t\('pr_copy_addr'\)\)\}<\/button>/, 'kein „Adresse kopieren"');
  assert.match(f, /const starten = \(\) => kryptoStartMerken\('anzeige:' \+ k\.id, c\.id, \(\) => api\('POST', `\/api\/werbung\/kampagnen\/\$\{k\.id\}\/krypto\/start`, \{ walletId: c\.id \}\)\);/);
  assert.match(f, /\[data-wbwallet\]'\)\.addEventListener\('click', \(\) => \{ starten\(\)\.catch\(\(\) => \{\}\); \}\);/);
  assert.match(f, /\[data-wbkopie\]'\)\.onclick = async \(e\) => \{ starten\(\)\.catch\(\(\) => \{\}\);/);
  assert.match(f, /const pid = await starten\(\);/, 'Meldung startet neu statt den gemerkten Start zu nutzen');
  assert.doesNotMatch(f, /const st = await api\('POST', `\/api\/werbung\/kampagnen\/\$\{k\.id\}\/krypto\/start`/, 'alter Start beim Melden');
  assert.match(APP, /async function kryptoStartMerken\(plan, walletId, starten = /, 'Merk-Baustein ohne eigene Start-Funktion');
});
