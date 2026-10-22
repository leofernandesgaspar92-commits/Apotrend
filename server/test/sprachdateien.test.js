// Nur EINE Sprache laden (http/sprachdateien.js): 35 statt 147 KB bei jedem
// ersten Besuch — auf Prepaid-Handys in Afrika spürbar. Geprüft wird, dass
// die geschnittene Datei genau die Texte aus public/i18n.js trägt, dass der
// Server sie komprimiert und mit 304 ausliefert, und dass die Seite nur noch
// eine Sprache anfordert.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import zlib from 'node:zlib';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSprachdateien } from '../src/http/sprachdateien.js';
import { SUPPORTED_LOCALES } from '../src/data/countries.js';

const HIER = dirname(fileURLToPath(import.meta.url));
const PUB = join(HIER, '..', 'public');
const QUELLE = join(PUB, 'i18n.js');
const alle = (() => { const c = {}; vm.runInNewContext(readFileSync(QUELLE, 'utf8') + ';this.I = I18N;', c); return c.I; })();

test('je Sprache eine Datei: genau die Texte aus i18n.js, ein Bruchteil der Größe', () => {
  const sd = createSprachdateien({ datei: QUELLE, sprachen: SUPPORTED_LOCALES });
  const gesamtBr = zlib.brotliCompressSync(readFileSync(QUELLE)).length;
  for (const sp of SUPPORTED_LOCALES) {
    const d = sd.holen(sp);
    const ctx = { self: {} };
    vm.runInNewContext(d.body.toString(), ctx);
    assert.deepEqual([...Object.keys(ctx.self.I18N)], [sp], `${sp}: nur diese Sprache`);
    assert.equal(JSON.stringify(ctx.self.I18N[sp]), JSON.stringify(alle[sp]), `${sp}: Texte identisch`);
    const br = sd.holen(sp, 'br').body.length;
    assert.ok(br < gesamtBr * 0.3, `${sp}: ${br} B statt ${gesamtBr} B`);
    assert.equal(zlib.brotliDecompressSync(sd.holen(sp, 'br').body).toString(), d.body.toString());
  }
  // Eine zweite Datei hängt sich an — Nachladen beim Sprachwechsel.
  const ctx = { self: {} };
  vm.runInNewContext(sd.holen('fr').body.toString() + sd.holen('ar').body.toString(), ctx);
  assert.deepEqual([...Object.keys(ctx.self.I18N)].sort(), ['ar', 'fr']);
  assert.equal(sd.holen('xx'), null);
});

test('Seite fordert nur eine Sprache an; Rückfall, Länderwahl-Titel und Offline-Speicher passen', () => {
  const index = readFileSync(join(PUB, 'index.html'), 'utf8');
  const app = readFileSync(join(PUB, 'app.js'), 'utf8');
  const sw = readFileSync(join(PUB, 'sw.js'), 'utf8');
  assert.doesNotMatch(index, /<script src="\/i18n\.js">/, 'nicht mehr alle Sprachen');
  const ok = (index.match(/var ok = (\[[^\]]+\])/) || [])[1];
  assert.deepEqual(JSON.parse(ok.replace(/'/g, '"')), SUPPORTED_LOCALES, 'Lader kennt dieselben Sprachen wie der Server');
  assert.ok(index.indexOf('/i18n/') < index.indexOf('<script src="/app.js">'), 'Sprache vor der Anwendung');
  // „Wähle dein Land" steht fest in app.js — gleich wie in i18n.js.
  const cs = JSON.parse((app.match(/const CS_TITEL = (\{[^}]+\});/) || [])[1].replace(/(\w+):/g, '"$1":').replace(/'/g, '"'));
  for (const sp of SUPPORTED_LOCALES) assert.equal(cs[sp], alle[sp].cs_title, sp);
  // t() ohne Deutsch: Rückfall auf eine geladene Sprache, nie ein Absturz.
  const zeile = app.match(/\nconst t = \(key\) => [^\n]+/)[0];
  const c = { I18N: { en: { a: 'A' } }, LOCALE: 'fr' };
  vm.runInNewContext(zeile + ';this.r = [t("a"), t("b")];', c);
  assert.deepEqual([...c.r], ['A', 'b']);
  assert.doesNotMatch(sw, /'\/i18n\.js'/, 'nicht alle Sprachen vorab speichern');
  assert.doesNotMatch(sw, /apopulse-shell-v3'/, 'neue Cache-Version, sonst bliebe die alte Hülle');
});

test('HTTP: /i18n/<sp>.js komprimiert, mit ETag/304; unbekannte Sprache 404', { timeout: 60000 }, async () => {
  const env = { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'sprachdateien-test-123', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus' };
  const kind = spawn(process.execPath, [join(HIER, '..', 'src', 'http', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const port = await new Promise((ok, fehler) => {
      let l = ''; const z = setTimeout(() => fehler(new Error('Server startet nicht')), 30000);
      kind.stdout.on('data', (d) => { l += d; const m = l.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(z); ok(m[1]); } });
    });
    const get = (pfad, kopf = {}) => new Promise((ok, fehler) => {
      http.get({ host: 'localhost', port, path: pfad, headers: kopf }, (res) => {
        const teile = []; res.on('data', (d) => teile.push(d)); res.on('end', () => ok({ status: res.statusCode, headers: res.headers, body: Buffer.concat(teile) }));
      }).on('error', fehler);
    });
    const r = await get('/i18n/fr.js', { 'accept-encoding': 'br' });
    assert.equal(r.status, 200);
    assert.equal(r.headers['content-encoding'], 'br');
    assert.match(r.headers['content-type'], /text\/javascript/);
    const ctx = { self: {} };
    vm.runInNewContext(zlib.brotliDecompressSync(r.body).toString(), ctx);
    assert.equal(ctx.self.I18N.fr.cs_title, 'Choisissez votre pays');
    const nochmal = await get('/i18n/fr.js', { 'if-none-match': r.headers.etag });
    assert.equal(nochmal.status, 304);
    assert.equal((await get('/i18n/xx.js')).status, 404);
    assert.notEqual((await get('/i18n/ar.js')).headers.etag, r.headers.etag);
  } finally { kind.kill(); }
});
