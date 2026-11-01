// Schwaches Netz (25.10.2026): Meldungen gehen nicht verloren, offline keine ruhenden Bereiche.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const abschnitt = (von, bis) => app.slice(app.indexOf(von), app.indexOf(bis, app.indexOf(von)));

test('Bereiche: online gemerkt, offline der gemerkte Stand statt „alles an"', async () => {
  // ladeFeatures nutzt die Frist für Start-Abfragen (mitFrist) — mit in den Ausschnitt.
  const code = app.match(/const START_FRIST_MS = [^\n]+\n/)[0] + app.match(/const mitFrist = [^\n]+\n/)[0] + abschnitt('const FEATURE_ZUSTAND = {};', 'const featureAn');
  const speicher = {};
  const ls = { getItem: (k) => speicher[k] ?? null, setItem: (k, v) => { speicher[k] = String(v); } };
  const online = { localStorage: ls, setTimeout, fetch: async () => ({ json: async () => ({ features: [{ id: 'tauschboerse', zustand: 'ruht' }, { id: 'social', zustand: 'an' }] }) }) };
  await vm.runInNewContext(code + ';ladeFeatures()', online);
  assert.equal(JSON.parse(speicher.apo_features).tauschboerse, 'ruht');
  const offline = { localStorage: ls, setTimeout, fetch: async () => { throw new TypeError('Failed to fetch'); } };
  await vm.runInNewContext(code + ';this.p = ladeFeatures().then(() => FEATURE_ZUSTAND)', offline);
  assert.equal((await offline.p).tauschboerse, 'ruht');
});

test('Melden ohne Netz: Hinweis statt Fehler, Ausgang (sonst Entwurf), automatisch senden, danach löschen', () => {
  const rk = abschnitt('function reportShortageCard(', '// Von der Startseite');
  // 11/2026: in den Ausgang (sendet auch bei geschlossener App); ohne IndexedDB wie bisher Entwurf + online.
  assert.match(rk, /if \(e && \(e\.code === 'network' \|\| e\.code === 'db_startet'\)\) \{[\s\S]*?await meldungInAusgang\(meldung\);[\s\S]*?sh_rep_ausgang[\s\S]*?catch \{[\s\S]*?sh_rep_wartet[\s\S]*?entwurfSichern\(\);[\s\S]*?addEventListener\('online'[\s\S]*?\{ once: true \}/);
  assert.match(rk, /const r = await api\('POST','\/api\/shortages\/report', meldung\);\n\s*entwurfLoeschen\(\);/);
  assert.match(rk, /form\.addEventListener\('input', entwurfSichern\)/);
  assert.match(rk, /Date\.now\(\) - \(ent\.ts \|\| 0\) < 3 \* 86400000/);
});

test('Abmelden löscht den Meldungs-Entwurf (geteiltes Gerät)', () => {
  assert.match(abschnitt('async function offlineSpeicherLeeren(', 'function updateOfflineBanner('), /removeItem\('apo_meldeentwurf'\)/);
});
