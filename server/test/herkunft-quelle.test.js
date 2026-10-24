// Herkunfts-Etikett (10/2026): Auf jeder amtlichen Engpass-Karte stand „✔ BASG (verified)"
// — auch bei Meldungen von SAHPRA, FDA Ghana oder BfArM. Bei Engpass-Angaben ist eine
// falsche Quelle schlimmer als keine (CLAUDE.md: sicherheitsrelevante Aussagen nur mit
// Quelle). Jetzt: „✔ Official · <tatsächliche Behörde>".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const i18nText = readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8');
const c = {}; vm.runInNewContext(i18nText + ';this.I = I18N;', c);
const I = c.I;

test('kein „BASG" als Etikett für alle amtlichen Daten, in keiner Sprache', () => {
  for (const sp of ['de', 'en', 'pt', 'fr', 'ar']) {
    for (const k of ['prov_verified', 'csv_prov_verified', 'pl_v', 'sc_mod_src']) assert.doesNotMatch(I[sp][k], /BASG|autrichien|Austrian|النمساوي/, `${sp}.${k}`);
    assert.match(I[sp].prov_verified_q, /\{q\}/, sp);
  }
});

test('echte provLabel(): amtlich mit tatsächlicher Quelle, andere Herkünfte unverändert', () => {
  const a = app.indexOf('const PROV_I18N = {');
  const e = app.indexOf('\n}\n', app.indexOf('function provLabel(')) + 3;
  const ti0 = app.slice(app.indexOf('function ti(key, vars) {'), app.indexOf('\n}\n', app.indexOf('function ti(key, vars) {')) + 3);
  const ctx = { LOCALE: 'en', t: (k) => I.en[k] ?? k, frPraepositionen: (s) => s };
  vm.createContext(ctx);
  vm.runInContext(ti0 + app.slice(a, e) + ';globalThis.p = provLabel;', ctx);
  assert.equal(ctx.p('verified', 'SAHPRA'), '✔ Official · SAHPRA');
  assert.equal(ctx.p('verified'), '✔ Official', 'ohne Quelle nur „Official" — nie eine erfundene Behörde');
  assert.equal(ctx.p('community', 'x'), I.en.prov_community);
  // Jede Stelle einzeln (zwei sehen gleich aus — „irgendwo" reicht nicht):
  for (const stelle of [
    '<span class="vis" title="${esc(t(\'pl_open\'))}">${esc(provLabel(s.provenance, s.quelle))}</span>', // Engpass-Karte
    '${esc(pr.supplier)} · ${esc(provLabel(pr.provenance, pr.quelle))}', // Preiszeile
    '<b>${esc(s.bezeichnung)}</b> <span class="muted" style="font-size:13px">· ${esc(provLabel(s.provenance, s.quelle))}', // Übersichtsliste
  ]) assert.ok(app.includes(stelle), stelle);
  assert.match(app, /s\.provenance === 'verified' && s\.quelle \? `\$\{provText\.verified\} \(\$\{s\.quelle\}\)`/, 'CSV-Export');
});

test('keine Österreich-Bezüge in den Texten außerhalb Deutsch', () => {
  for (const sp of ['en', 'pt', 'fr', 'ar']) {
    const roh = JSON.stringify(I[sp]);
    assert.doesNotMatch(roh, /Austria|Autriche|autrichien|Áustria|austríac|النمسا|BASG/, sp);
  }
});
