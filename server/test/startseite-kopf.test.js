// Startseite: Vorschau (WhatsApp & Co.) in der Sprache des Browsers. Vorher immer
// deutsch: „Behördenlisten aus Europa" — auch für den Start in Afrika.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kopfSprache } from '../src/http/startseiteKopf.js';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'http', 'server.js');

test('Sprache: bevorzugte unterstützte, sonst Englisch', () => {
  assert.equal(kopfSprache('de-AT,de;q=0.9,en;q=0.8'), 'de');
  assert.equal(kopfSprache('en-UG,en;q=0.9'), 'en');
  assert.equal(kopfSprache('pt-AO'), 'pt');
  assert.equal(kopfSprache('sw-TZ,sw;q=0.9,en;q=0.5'), 'en');
  assert.equal(kopfSprache(''), 'en');
  assert.equal(kopfSprache('fr-SN,fr;q=0.9'), 'fr', 'Französisch seit 10/2026');
  assert.equal(kopfSprache('es-GQ'), 'en');
});

test('Über HTTP: Kopf je Sprache, absolutes Vorschaubild, eigener ETag, App-Inhalt unverändert', { timeout: 60000 }, async () => {
  const env = { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'startseite-kopf-test', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus', APOPULSE_PUBLIC_URL: 'https://apopulse.example' };
  const kind = spawn(process.execPath, [SERVER], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  try {
    const port = await new Promise((ok, fail) => {
      const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
      const lies = (x) => { log += x; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
      kind.stdout.on('data', lies); kind.stderr.on('data', lies);
      kind.on('exit', (c) => { clearTimeout(zeit); fail(new Error(`Server beendet (${c}):\n${log}`)); });
    });
    const B = `http://localhost:${port}`;
    const hol = async (al) => { const r = await fetch(B + '/', { headers: al ? { 'accept-language': al } : {} }); return { r, t: await r.text() }; };
    const en = await hol('en-UG,en;q=0.9');
    assert.match(en.t, /<meta property="og:title" content="ApoPulse — medicine shortages with sources" \/>/);
    assert.ok(!/aus Europa/.test(en.t), 'englische Vorschau mit „aus Europa"');
    assert.match(en.t, /<meta property="og:image" content="https:\/\/apopulse\.example\/og-bild-en\.png" \/>/);
    // Vorschaubild in der Sprache: französisch für Senegal/Côte d'Ivoire, arabisch für Ägypten.
    assert.match((await hol('fr-SN,fr;q=0.9')).t, /<meta property="og:image" content="https:\/\/apopulse\.example\/og-bild-fr\.png" \/>/);
    assert.match((await hol('ar-EG')).t, /og-bild-ar\.png/);
    for (const sp of ['de', 'en', 'fr', 'pt', 'ar', '']) {
      const bild = await fetch(B + '/og-bild' + (sp ? '-' + sp : '') + '.png');
      assert.equal(bild.status, 200, sp); assert.equal(bild.headers.get('content-type'), 'image/png');
      assert.ok((await bild.arrayBuffer()).byteLength > 20000, 'Bild leer: ' + sp);
    }
    assert.match(en.r.headers.get('vary') || '', /Accept-Language/);
    const de = await hol('de-AT,de;q=0.9');
    assert.match(de.t, /og:title" content="ApoPulse — Lieferengpässe mit Quelle"/);
    assert.notEqual(de.r.headers.get('etag'), en.r.headers.get('etag'), 'gleicher ETag für verschiedene Sprachen');
    assert.match((await hol('pt-AO')).t, /ruturas de medicamentos com fonte/);
    assert.match((await hol(null)).t, /medicine shortages with sources/);
    // Der Rest der Seite ist unverändert (App-Skripte da).
    for (const t of [en.t, de.t]) assert.match(t, /<script src="\/app\.js/);
    assert.equal((await fetch(B + '/', { headers: { 'accept-language': 'en', 'if-none-match': en.r.headers.get('etag') } })).status, 304);
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});

test('Manifest: Name und Schnellzugriffe in der Sprache des Browsers, kein Schnellzugriff ins Leere', async () => {
  const { manifestSprache } = await import('../src/http/startseiteKopf.js');
  const { readFileSync } = await import('node:fs');
  const roh = readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8');
  const en = JSON.parse(manifestSprache(roh, 'en'));
  assert.equal(en.lang, 'en');
  assert.match(en.name, /medicine shortages/);
  assert.deepEqual(en.shortcuts.map((s) => s.name), ['Shortages', 'For you', 'News']);
  assert.ok(!en.shortcuts.some((s) => /tab=prices/.test(s.url)), 'Schnellzugriff „Preise" ohne Preisdaten');
  assert.ok(en.screenshots.every((b) => !/preise/.test(b.src) && !/[äöü]/.test(b.label)));
  assert.equal(JSON.parse(manifestSprache(roh, 'pt')).shortcuts[0].name, 'Ruturas');
  assert.equal(manifestSprache('kein json', 'en'), 'kein json');
});

test('Vorschaubilder: alle Sprachen vorhanden, 1200×630 (Format für WhatsApp/Facebook), og-bild.png = Englisch', async () => {
  const { readFileSync } = await import('node:fs');
  const ordner = new URL('../public/', import.meta.url);
  for (const sp of ['de', 'en', 'fr', 'pt', 'ar']) {
    const b = readFileSync(new URL(`og-bild-${sp}.png`, ordner));
    assert.equal(b.toString('ascii', 12, 16), 'IHDR', sp);
    assert.deepEqual([b.readUInt32BE(16), b.readUInt32BE(20)], [1200, 630], sp);
  }
  assert.ok(readFileSync(new URL('og-bild.png', ordner)).equals(readFileSync(new URL('og-bild-en.png', ordner))), 'Rückfallbild ist nicht das englische');
  const { vorschaubild } = await import('../src/domain/vorschaubild.js');
  assert.deepEqual(['fr', 'ar', 'sw', undefined, '../x'].map(vorschaubild), ['/og-bild-fr.png', '/og-bild-ar.png', '/og-bild-en.png', '/og-bild-en.png', '/og-bild-en.png']);
});
