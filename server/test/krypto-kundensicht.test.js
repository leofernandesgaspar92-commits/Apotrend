// Krypto-Zahlung aus Kundensicht (27.10.2026): Ablehnungsgrund und Produktname in der Sprache der
// Kundin, nach „Zahlung melden" sofort der Wartezustand oben.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const i18nText = readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8');
const ctx = {}; vm.runInNewContext(i18nText + ';this.I = I18N;', ctx);
const code = app.slice(app.indexOf('function produktName('), app.indexOf('function ablehnGrund(')) + app.slice(app.indexOf('function ablehnGrund('), app.indexOf('\n}\n', app.indexOf('function ablehnGrund(')) + 3);
const lauf = (sp, ausdruck) => vm.runInNewContext(code + ';' + ausdruck, { t: (k) => (ctx.I[sp][k] ?? k) });

test('Ablehnungsgrund: Code → Satz in der Sprache der Kundin, mit Zusatz; freier Text bleibt', () => {
  assert.match(lauf('en', 'ablehnGrund("#tx_vor_start")'), /^The transaction is older than the start of your payment/);
  assert.match(lauf('fr', 'ablehnGrund("#betrag_zu_niedrig")'), /^Le montant reçu est trop faible/);
  assert.match(lauf('ar', 'ablehnGrund("#falsches_netz")'), /ERC-20/);
  assert.equal(lauf('en', 'ablehnGrund("#nicht_gefunden: TX 7f…")'), 'The transaction was not found on the blockchain — please check the transaction ID. — TX 7f…');
  assert.equal(lauf('en', 'ablehnGrund("Bitte Support kontaktieren")'), 'Bitte Support kontaktieren', 'freier Text unverändert');
  assert.equal(lauf('en', 'ablehnGrund("#unbekannt")'), '#unbekannt', 'unbekannter Code nicht erfunden');
  for (const sp of ['de', 'en', 'pt', 'fr', 'ar']) for (const c of ['tx_vor_start', 'betrag_zu_niedrig', 'falsche_adresse', 'falsches_netz', 'nicht_gefunden']) assert.ok(ctx.I[sp]['kg_' + c], sp + ' ' + c);
});

test('Produktname in Benachrichtigungen übersetzt (auch für alte, deutsche Namen)', () => {
  assert.equal(lauf('en', 'produktAusName("ApoPulse Premium (Monat)")'), 'ApoPulse Premium (1 month)');
  assert.equal(lauf('en', 'produktAusName("Etwas anderes")'), 'Etwas anderes');
  assert.match(app, /n\.type==='payment_confirmed'\?produktAusName\(n\.label\):n\.type==='payment_rejected'\?ablehnGrund\(n\.label\)/);
  assert.match(app, /zitat\(ablehnGrund\(letzte\.review_note\)\)/);
});

test('Redaktion wählt den Grund aus einer Liste; „Zahlung melden" baut die Premium-Seite neu auf', () => {
  assert.match(app, /<select data-kpgrundwahl><option value="" selected disabled>[^\n]*\$\{ABLEHN_GRUENDE\.map/);
  assert.match(app, /<option value="" selected disabled>\$\{esc\(t\('kg_bitte'\)\)\}<\/option>/, 'kein Grund vorausgewählt');
  assert.match(app, /const grund = code && code !== '__frei' \? '#' \+ code \+ \(zusatz \? ': ' \+ zusatz : ''\) : zusatz;/);
  assert.match(app, /msg\.textContent = t\('pr_reported'\); inp\.value = '';\s*\/\/[^\n]*\n[^\n]*\n\s*await openPremium\(\); window\.scrollTo/);
});
