// „Seit deinem letzten Besuch" (25.10.2026): Wer nach einer Woche zurückkommt, sieht oben, was
// sich bei beobachteten Wirkstoffen geändert hat — je Wirkstoff das Neueste, immer mit Herkunft.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const i18n = readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8');
const code = app.slice(app.indexOf('const SEIT_TYPEN'), app.indexOf('async function seitBesuchKarte('));
const zeilen = (n) => JSON.parse(JSON.stringify(vm.runInNewContext(code + ';seitBesuchZeilen(N)', { N: n })));

test('Je Wirkstoff nur die neueste ungelesene Engpass-Nachricht; Gelesenes und Fremdes fällt weg', () => {
  const z = zeilen([
    { id: 'a', type: 'watch_alert', label: 'Paracétamol · Wieder verfügbar (Community-Meldung)', read: false, created_at: '2026-10-25T10:00:00Z' },
    { id: 'b', type: 'watch_alert', label: 'Paracétamol · Eingeschränkt lieferbar (Community-Meldung)', read: false, created_at: '2026-10-24T10:00:00Z' },
    { id: 'c', type: 'watch_alert', label: 'Ocytocine · Kritischer Engpass (Community-Meldung)', read: false },
    { id: 'd', type: 'shortage_confirm', label: 'Amoxicilline', actor: { display_name: 'Fatou Sarr' }, read: false },
    { id: 'e', type: 'shortage_ended', label: 'Salbutamol · SN', read: false },
    { id: 'f', type: 'watch_alert', label: 'Insuline · Kritischer Engpass (Community-Meldung)', read: true },
    { id: 'g', type: 'follow', label: 'x', read: false },
  ]);
  assert.deepEqual(z.map((x) => [x.w, x.art, x.quelle, x.ids.join()]), [
    ['Paracétamol', 'wieder', 'apotheke', 'a,b'],
    ['Ocytocine', 'kritisch', 'apotheke', 'c'],
    ['Amoxicilline', 'bestaetigt', 'apotheke', 'd'],
    ['Salbutamol', 'wieder', 'amtlich', 'e'],
  ]);
  assert.equal(z[2].wer, 'Fatou Sarr');
  assert.deepEqual(zeilen([]), []);
});

test('Karte steht VOR dem Überblick und nennt die Herkunft; „Gesehen" markiert genau diese als gelesen', () => {
  const k = app.slice(app.indexOf('async function seitBesuchKarte('), app.indexOf('async function loadOverview('));
  assert.match(k, /if \(!kopf \|\| !kopf\.isConnected\) return;\s*feed\.querySelectorAll\('\[data-seitbesuch\]'\)\.forEach\(\(x\) => x\.remove\(\)\);\s*kopf\.before\(k\);/, 'nie zwei Karten, nie in eine verworfene Seite');
  assert.match(k, /seit_q_amtlich' : 'nl_community'/);
  assert.match(k, /zeilen\.flatMap\(\(z\) => z\.ids\)[\s\S]*\/api\/notifications\/\$\{encodeURIComponent\(id\)\}\/read/);
  for (const key of ['seit_titel', 'seit_kritisch', 'seit_eing', 'seit_wieder', 'seit_ausland', 'seit_bestaetigt', 'seit_bestaetigt_kurz', 'seit_gesehen', 'seit_alle', 'seit_q_amtlich']) {
    assert.equal((i18n.match(new RegExp(`\\b${key}:'`, 'g')) || []).length, 5, key);
  }
});
