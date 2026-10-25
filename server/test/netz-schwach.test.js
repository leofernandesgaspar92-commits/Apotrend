// Schwaches Netz (25.10.2026): Meldungen gehen nicht verloren, offline keine ruhenden Bereiche.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const abschnitt = (von, bis) => app.slice(app.indexOf(von), app.indexOf(bis, app.indexOf(von)));

test('Bereiche: online gemerkt, offline der gemerkte Stand statt „alles an"', async () => {
  const code = abschnitt('const FEATURE_ZUSTAND = {};', 'const featureAn');
  const speicher = {};
  const ls = { getItem: (k) => speicher[k] ?? null, setItem: (k, v) => { speicher[k] = String(v); } };
  const online = { localStorage: ls, fetch: async () => ({ json: async () => ({ features: [{ id: 'tauschboerse', zustand: 'ruht' }, { id: 'social', zustand: 'an' }] }) }) };
  await vm.runInNewContext(code + ';ladeFeatures()', online);
  assert.equal(JSON.parse(speicher.apo_features).tauschboerse, 'ruht');
  const offline = { localStorage: ls, fetch: async () => { throw new TypeError('Failed to fetch'); } };
  await vm.runInNewContext(code + ';this.p = ladeFeatures().then(() => FEATURE_ZUSTAND)', offline);
  assert.equal((await offline.p).tauschboerse, 'ruht');
});

test('Melden ohne Netz: Hinweis statt Fehler, Entwurf, automatisch senden, danach löschen', () => {
  const rk = abschnitt('function reportShortageCard(', '// Von der Startseite');
  assert.match(rk, /if \(e && e\.code === 'network'\) \{[\s\S]*?sh_rep_wartet[\s\S]*?entwurfSichern\(\);[\s\S]*?addEventListener\('online'[\s\S]*?\{ once: true \}/);
  assert.match(rk, /voraussichtlichBis:[^\n]*\n\s*\}\);\n\s*entwurfLoeschen\(\);/);
  assert.match(rk, /form\.addEventListener\('input', entwurfSichern\)/);
  assert.match(rk, /Date\.now\(\) - \(ent\.ts \|\| 0\) < 3 \* 86400000/);
});

test('Abmelden löscht den Meldungs-Entwurf (geteiltes Gerät)', () => {
  assert.match(abschnitt('async function offlineSpeicherLeeren(', 'function updateOfflineBanner('), /removeItem\('apo_meldeentwurf'\)/);
});
