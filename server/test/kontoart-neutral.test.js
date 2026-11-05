// Texte, die die Nutzer:in direkt ansprechen, dürfen keine Apotheke voraussetzen. Fund 11/2026 (Rundgang als
// Klinik, en-NG): „Is something short at your pharmacy?", „Special price for pharmacies in Africa" — der
// Sonderpreis gilt aber für jede Kontoart. Deutsch war oft schon neutral („Ist bei Ihnen etwas knapp?"),
// die Übersetzungen machten daraus „Ihre Apotheke".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const c = {}; vm.runInNewContext(readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8') + ';__I=I18N', c);
const I = c.__I;
const APOTHEKE = /apothek|pharmac|farmácia|صيدلي/i;

test('Ansprache ohne „Ihre Apotheke" — Ärzt:innen, Kliniken, Großhandel lesen dieselben Texte', () => {
  for (const k of ['sh_leer_land', 'sc_conf_ok', 'absicht_banner_best', 'ei_bitte_text', 'pr_region_hint', 'tm_sub', 'th_sub'])
    for (const l of ['de', 'en', 'pt', 'fr', 'ar']) assert.doesNotMatch(I[l][k], APOTHEKE, `${k} (${l}): ${I[l][k]}`);
});
