// Kompression (http/komprimierung.js): Brotli vor gzip, statische Dateien nur
// einmal je Version. Entscheidend ist, dass entpackt wieder GENAU die Datei
// herauskommt — eine kaputte app.js wäre schlimmer als eine große.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import zlib from 'node:zlib';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { kodierungWaehlen, createKompressionsSpeicher } from '../src/http/komprimierung.js';

const HIER = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HIER, '..', 'src', 'http', 'server.js');
const PUBLIC = join(HIER, '..', 'public');

test('Kodierung wählen: Brotli vor gzip, q=0 heißt nein, sonst unkomprimiert', () => {
  assert.equal(kodierungWaehlen('gzip, deflate, br'), 'br');
  assert.equal(kodierungWaehlen('gzip, deflate, br, zstd'), 'br');
  assert.equal(kodierungWaehlen('gzip'), 'gzip');
  assert.equal(kodierungWaehlen('br;q=0, gzip'), 'gzip');
  assert.equal(kodierungWaehlen('BR'), 'br');
  assert.equal(kodierungWaehlen('*'), 'br');
  assert.equal(kodierungWaehlen('*;q=0'), null);
  assert.equal(kodierungWaehlen('identity'), null);
  assert.equal(kodierungWaehlen(''), null);
  assert.equal(kodierungWaehlen(undefined), null);
});

test('Speicher: je Version einmal rechnen, neue Version -> neuer Inhalt', async () => {
  const dir = fs.mkdtempSync(join(os.tmpdir(), 'kompr-'));
  const datei = join(dir, 'a.js');
  try {
    fs.writeFileSync(datei, 'eins '.repeat(500));
    const sp = createKompressionsSpeicher({ maxDateien: 2 });
    const p1 = sp.holen(datei, 'v1', 'br');
    assert.equal(sp.holen(datei, 'v1', 'br'), p1, 'gleiche Version -> derselbe Auftrag');
    assert.equal(zlib.brotliDecompressSync(await p1).toString(), 'eins '.repeat(500));
    fs.writeFileSync(datei, 'zwei '.repeat(500));
    assert.equal(zlib.gunzipSync(await sp.holen(datei, 'v2', 'gzip')).toString(), 'zwei '.repeat(500));
    assert.equal(zlib.brotliDecompressSync(await sp.holen(datei, 'v2', 'br')).toString(), 'zwei '.repeat(500), 'alte Version nicht ausgeliefert');
    sp.holen(join(dir, 'b'), 'x', 'gzip').catch(() => {}); sp.holen(join(dir, 'c'), 'x', 'gzip').catch(() => {});
    assert.equal(sp.groesse(), 2, 'Speicher begrenzt');
    await assert.rejects(sp.holen(join(dir, 'fehlt.js'), 'x', 'br'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

function roh(port, pfad, headers = {}) {
  return new Promise((ok, fail) => {
    http.get({ host: 'localhost', port, path: pfad, headers }, (res) => {
      const teile = []; res.on('data', (c) => teile.push(c)); res.on('end', () => ok({ status: res.statusCode, headers: res.headers, body: Buffer.concat(teile) }));
    }).on('error', fail);
  });
}
const entpacken = (r) => (r.headers['content-encoding'] === 'br' ? zlib.brotliDecompressSync(r.body) : r.headers['content-encoding'] === 'gzip' ? zlib.gunzipSync(r.body) : r.body);

test('Über HTTP: app.js/i18n.js/app.css als Brotli, entpackt byte-genau, deutlich kleiner als gzip', { timeout: 90000 }, async () => {
  const env = { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'komprimierung-test-12', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus' };
  const kind = spawn(process.execPath, [SERVER], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  try {
    const port = await new Promise((ok, fail) => {
      const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
      const lies = (x) => { log += x; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
      kind.stdout.on('data', lies); kind.stderr.on('data', lies);
      kind.on('exit', (c) => { clearTimeout(zeit); fail(new Error(`Server beendet (${c}):\n${log}`)); });
    });
    const BROWSER = { 'accept-encoding': 'gzip, deflate, br, zstd' };
    for (const name of ['app.js', 'i18n.js', 'app.css', 'sw.js']) {
      const original = fs.readFileSync(join(PUBLIC, name));
      const br = await roh(port, '/' + name, BROWSER);
      assert.equal(br.status, 200);
      assert.equal(br.headers['content-encoding'], 'br', name);
      assert.equal(Number(br.headers['content-length']), br.body.length, name + ': Länge stimmt');
      assert.match(br.headers.vary || '', /Accept-Encoding/);
      assert.ok(entpacken(br).equals(original), name + ': Brotli entpackt = Datei');
      const gz = await roh(port, '/' + name, { 'accept-encoding': 'gzip' });
      assert.equal(gz.headers['content-encoding'], 'gzip');
      assert.ok(entpacken(gz).equals(original), name + ': gzip entpackt = Datei');
      const ohne = await roh(port, '/' + name);
      assert.equal(ohne.headers['content-encoding'], undefined);
      assert.ok(ohne.body.equals(original));
      assert.match(ohne.headers.vary || '', /Accept-Encoding/, 'Vary auch unkomprimiert (Zwischenspeicher)');
      assert.equal((await roh(port, '/' + name, { ...BROWSER, 'if-none-match': br.headers.etag })).status, 304);
      if (name === 'app.js' || name === 'i18n.js') assert.ok(br.body.length < gz.body.length * 0.85, `${name}: Brotli ${br.body.length} vs gzip ${gz.body.length}`);
      // Zweiter Abruf aus dem Speicher: dieselben Bytes.
      assert.ok((await roh(port, '/' + name, BROWSER)).body.equals(br.body));
    }
    // Startseite (je Sprache erzeugt) und JSON-Antworten ebenfalls.
    const start = await roh(port, '/', { ...BROWSER, 'accept-language': 'en-UG' });
    assert.equal(start.headers['content-encoding'], 'br');
    assert.match(entpacken(start).toString(), /<html lang="en">/);
    const api = await roh(port, '/api/countries', BROWSER);
    assert.equal(api.headers['content-encoding'], 'br');
    assert.ok(Array.isArray(JSON.parse(entpacken(api)).countries) || typeof JSON.parse(entpacken(api)) === 'object');
    assert.equal((await roh(port, '/api/countries', { 'accept-encoding': 'br;q=0, gzip' })).headers['content-encoding'], 'gzip');
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});
