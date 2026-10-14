// Hinweise zu beobachteten Wirkstoffen (watch_alert): Der Server baut das Label
// mit festen deutschen Bausteinen. Zwei Fehler bis 10/2026:
//  1. Die Push-Nachricht sagte IMMER „meldet … als knapp" — auch bei „wieder
//     verfügbar" und bei einem neuen Liefertermin. Eine Entwarnung kam als
//     Engpass-Meldung aufs Handy.
//  2. In der App stand der deutsche Text („Kritischer Engpass (Community-
//     Meldung)") auch in Uganda.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { pushNachricht } from '../src/services/webPush.js';

const n = (label) => ({ type: 'watch_alert', label, ref_type: 'shortage', ref_id: 'x1' });

test('Push: Text folgt dem Inhalt — knapp, eingeschränkt, wieder verfügbar, Termin', () => {
  const knapp = pushNachricht(n('Oxytocin · Kritischer Engpass (Community-Meldung)'), { sprache: 'en' });
  assert.match(knapp.titel, /^Pharmacy report: Oxytocin$/);
  const wieder = pushNachricht(n('Oxytocin · Wieder verfügbar'), { sprache: 'en' });
  assert.equal(wieder.titel, 'Available again: Oxytocin');
  assert.doesNotMatch(wieder.text, /short/, 'Entwarnung als Engpass gemeldet');
  assert.match(pushNachricht(n('Oxytocin · Wieder verfügbar (Community-Meldung)'), { sprache: 'de' }).titel, /^Wieder verfügbar/);
  assert.match(pushNachricht(n('Oxytocin · Eingeschränkt lieferbar (aktualisiert)'), { sprache: 'pt' }).titel, /^Disponibilidade limitada/);
  const termin = pushNachricht(n('Oxytocin · Termin 2026-11-02'), { sprache: 'en' });
  assert.equal(termin.titel, 'New date: Oxytocin');
  assert.match(termin.text, /02\/11\/2026/);
  assert.match(pushNachricht(n('Oxytocin · Termin offen'), { sprache: 'en' }).text, /No delivery date/);
});

test('App: deutsche Bausteine im Label werden übersetzt (echte Funktion aus app.js)', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const start = app.indexOf('function notifLabel(label) {');
  const ende = app.indexOf('\n}\n', start) + 3;
  assert.ok(start > 0, 'notifLabel nicht gefunden');
  const c = {}; vm.runInNewContext(readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8') + ';__I=I18N', c);
  const E = c.__I.en;
  const ctx = { t: (k) => E[k] || k, ti: (k, v) => (E[k] || k).replace(/\{(\w+)\}/g, (m, x) => v[x]), fmtDateDe: (d) => d.split('-').reverse().join('/') };
  vm.createContext(ctx); vm.runInContext(app.slice(start, ende) + ';globalThis.f = notifLabel;', ctx);
  assert.equal(ctx.f('Oxytocin · Kritischer Engpass (Community-Meldung)'), 'Oxytocin · Critical shortage (pharmacy report)');
  assert.equal(ctx.f('Oxytocin · Wieder verfügbar'), 'Oxytocin · Available again');
  assert.equal(ctx.f('Oxytocin · Eingeschränkt lieferbar (aktualisiert)'), 'Oxytocin · Limited availability (updated)');
  assert.equal(ctx.f('Oxytocin · Termin 2026-11-02'), 'Oxytocin · expected until 02/11/2026');
  assert.equal(ctx.f('Oxytocin · Termin offen'), 'Oxytocin · no date yet');
  // Jeder Baustein, den der Server baut, muss übersetzt werden.
  const server = readFileSync(new URL('../src/services/shortages.js', import.meta.url), 'utf8');
  for (const b of ['Kritischer Engpass', 'Eingeschränkt lieferbar', 'Wieder verfügbar', '(Community-Meldung)', '(aktualisiert)', 'Termin offen']) {
    assert.ok(server.includes(b), `Server baut „${b}" nicht mehr — Test anpassen`);
  }
});
