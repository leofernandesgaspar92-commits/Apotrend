// Filter der Benachrichtigungsliste („Beschaffung" / „Sozial"). Bis 11/2026 kannte „Beschaffung" nur eine
// feste Liste älterer Arten — alles andere fiel unter „Sozial": Proforma-Antworten, neue Zulassungen,
// Frühwarnungen, Widersprüche, „noch aktuell?", Preisalarme, sogar Zahlungsbestätigungen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const social = readFileSync(new URL('../src/services/social.js', import.meta.url), 'utf8');

function gruppe() {
  const start = app.indexOf('function notifGruppe(type) {');
  assert.ok(start > 0, 'notifGruppe nicht gefunden');
  const vorher = app.lastIndexOf('const NOTIF_SOZIAL', start);
  assert.ok(vorher > 0 && vorher < start, 'NOTIF_SOZIAL fehlt vor notifGruppe');
  const ende = app.indexOf('\n}\n', start) + 3;
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(app.slice(vorher, ende) + ';globalThis.g = notifGruppe;', ctx);
  return ctx.g;
}

test('Neue Beschaffungs-Arten landen unter „Beschaffung", Konto-Meldungen nicht unter „Sozial"', () => {
  const g = gruppe();
  for (const t of ['sourcing_antwort', 'sourcing_anfrage', 'medint_neu', 'ausbruch_signal', 'shortage_widerspruch', 'shortage_noch_aktuell', 'price_alert', 'shortage_home', 'watch_alert', 'exchange_offer', 'signal_alert', 'shortage_bestaetigt'])
    assert.equal(g(t), 'beschaffung', t);
  for (const t of ['follow', 'comment', 'reaction', 'mention', 'dm', 'repost', 'poll_vote', 'einladung', 'live_start'])
    assert.equal(g(t), 'sozial', t);
  for (const t of ['payment_confirmed', 'payment_rejected', 'verified', 'verify_rejected', 'premium_ablauf', 'anzeige_freigegeben'])
    assert.equal(g(t), 'konto', t);
});

test('Jede Art mit Server-Kategorie „watch" ist Beschaffung, jede „community"/„follows"/„dm" ist Sozial', () => {
  const g = gruppe();
  const block = social.slice(social.indexOf('const NOTIF_CATEGORY = {'), social.indexOf('};', social.indexOf('const NOTIF_CATEGORY = {')));
  const paare = [...block.matchAll(/(\w+):\s*'(\w+)'/g)].map((m) => [m[1], m[2]]);
  assert.ok(paare.length > 15, 'Kategorien nicht gelesen');
  for (const [typ, kat] of paare) {
    if (kat === 'watch') assert.equal(g(typ), 'beschaffung', `${typ} (watch)`);
    if (['community', 'follows', 'dm'].includes(kat)) assert.equal(g(typ), 'sozial', `${typ} (${kat})`);
  }
  // Die Liste nutzt die Regel (keine zweite feste Liste).
  assert.match(app, /notifFilter === 'procurement' \? notifGruppe\(n\.type\) === 'beschaffung' : notifGruppe\(n\.type\) === 'sozial'/);
  // Filterleiste nur, wenn beide Filter etwas zeigen (sonst ein leerer „Sozial"-Knopf).
  assert.match(app, /showFilter = d\.notifications\.length >= 5 && procCount > 0 && sozCount > 0/);
});
