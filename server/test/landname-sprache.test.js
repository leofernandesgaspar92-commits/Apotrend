// Ländernamen in der Sprache der App. Bis 11/2026 kam der Name aus dem Länderregister — dort gemischt
// („Deutschland", „Österreich" deutsch; „South Africa", „Kenya" englisch). Wer Französisch oder Arabisch
// nutzte, las „Presse — Deutschland", „Durban 🇿🇦 South Africa" oder ein lateinisches „Kenya" mitten im
// arabischen Satz — an 18 Stellen (Afrika-Übersicht, Presse, Lagebild, Häfen, Benachrichtigungen …).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const APP = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

function landLabelIn(locale) {
  const start = APP.indexOf('let LAND_DN = null;');
  assert.ok(start > 0, 'landLabel fehlt');
  const ende = APP.indexOf('\n};\n', start) + 3;
  const ctx = { Intl, LOCALE: locale, COUNTRIES_CACHE: [
    { code: 'ZA', name: 'South Africa', flag: '🇿🇦' }, { code: 'DE', name: 'Deutschland', flag: '🇩🇪' },
    { code: 'KE', name: 'Kenya', flag: '🇰🇪' }, { code: 'SN', name: 'Senegal', flag: '🇸🇳' } ] };
  vm.createContext(ctx);
  vm.runInContext(APP.slice(start, ende) + ';globalThis.f = landLabel;', ctx);
  return ctx.f;
}

test('Ländername folgt der App-Sprache, Flagge bleibt', () => {
  assert.equal(landLabelIn('fr')('ZA'), '🇿🇦 Afrique du Sud');
  assert.equal(landLabelIn('fr')('DE'), '🇩🇪 Allemagne');
  assert.equal(landLabelIn('en')('DE'), '🇩🇪 Germany');
  assert.equal(landLabelIn('de')('ZA'), '🇿🇦 Südafrika');
  assert.equal(landLabelIn('pt')('SN'), '🇸🇳 Senegal');
  assert.equal(landLabelIn('ar')('KE'), '🇰🇪 كينيا');
  // Unbekannter Code: wie bisher der Code selbst.
  assert.equal(landLabelIn('fr')('XX'), 'XX');
});

test('Häfen: eigenes Land, dann eigene Region zuerst', () => {
  assert.match(APP, /\$\{naeheZuerst\(d\.haefen\)\.map\(zeile\)\.join\(''\)\}/);
  assert.match(APP, /r: h\.land === heim \? 0 : REGION_VON\(h\.land\) && REGION_VON\(h\.land\) === REGION_VON\(heim\) \? 1 : 2/);
});
