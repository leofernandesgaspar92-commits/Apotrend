// „App installieren" (10/2026): ein Symbol auf dem Startbildschirm, ohne App-Store.
// Der Browser-Audit spielt den Ablauf mit nachgestelltem beforeinstallprompt durch;
// hier die Regeln, die beim Umbauen leicht verloren gehen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));

test('Ereignis wird abgefangen (sonst zeigt Chrome sein eigenes Mini-Banner zur falschen Zeit)', () => {
  assert.match(app, /addEventListener\('beforeinstallprompt', \(e\) => \{\n {2}e\.preventDefault\(\);\n {2}installEreignis = e;/);
  assert.match(app, /addEventListener\('appinstalled'/);
});

test('Karte: nie in der installierten App, „Später" 30 Tage, iPhone ohne toten Knopf', () => {
  const k = app.slice(app.indexOf('function installKarte()'), app.indexOf('// Nach der Registrierung: Codes als Karte'));
  assert.match(k, /if \(istInstalliert\(\)\) return null;/);
  assert.match(k, /Date\.now\(\) \+ 30 \* 86400000/);
  assert.match(k, /\$\{iphone \? '' : `<button data-install/);
  assert.match(k, /e\.prompt\(\);/);
  assert.match(app, /\{ const ik = installKarte\(\); if \(ik\) feed\.appendChild\(ik\); \}/, 'auf der Übersicht');
});

test('Installierbar: Manifest mit Symbolen 192/512 und eigenständiger Anzeige', () => {
  assert.equal(manifest.display, 'standalone');
  const g = manifest.icons.map((i) => i.sizes);
  assert.ok(g.includes('192x192') && g.includes('512x512'));
});
