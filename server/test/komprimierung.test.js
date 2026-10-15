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
import { kodierungWaehlen, createKompressionsSpeicher, createVersionsKennung } from '../src/http/komprimierung.js';
import { schlankJs, schlankSicher } from '../src/http/schlank.js';
import vm from 'node:vm';
import { createRequire } from 'node:module';

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

test('Versionskennung aus dem Inhalt: neue Änderungszeit (Deploy) ändert nichts, neuer Inhalt schon', () => {
  const dir = fs.mkdtempSync(join(os.tmpdir(), 'etag-'));
  const datei = join(dir, 'app.js');
  try {
    const etag = createVersionsKennung();
    fs.writeFileSync(datei, 'console.log(1)');
    const e1 = etag(datei, fs.statSync(datei));
    assert.match(e1, /^W\/"[A-Za-z0-9_-]{22}"$/);
    // Wie ein frischer Git-Klon: gleicher Inhalt, andere Änderungszeit.
    fs.utimesSync(datei, new Date('2030-01-01'), new Date('2030-01-01'));
    assert.equal(etag(datei, fs.statSync(datei)), e1, 'Deploy ohne Änderung -> gleiche Kennung');
    assert.equal(createVersionsKennung()(datei, fs.statSync(datei)), e1, 'auch in einem neuen Prozess');
    assert.equal(etag(datei, fs.statSync(datei), 'en'), e1.slice(0, -1) + '-en"', 'Sprache als Zusatz');
    fs.writeFileSync(datei, 'console.log(2)'); // gleiche Größe, anderer Inhalt
    fs.utimesSync(datei, new Date('2031-01-01'), new Date('2031-01-01'));
    assert.notEqual(etag(datei, fs.statSync(datei)), e1, 'neuer Inhalt -> neue Kennung');
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

test('Über HTTP: app.js/i18n.js/app.css als Brotli, entpackt byte-genau (Skripte schlank), deutlich kleiner als gzip', { timeout: 90000 }, async () => {
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
      // Skripte gehen schlank hinaus (ohne Kommentare/Einrückung), alles andere unverändert.
      const original = name.endsWith('.js') ? Buffer.from(schlankJs(fs.readFileSync(join(PUBLIC, name), 'utf8'))) : fs.readFileSync(join(PUBLIC, name));
      const br = await roh(port, '/' + name, BROWSER);
      assert.equal(br.status, 200);
      assert.equal(br.headers['content-encoding'], 'br', name);
      assert.equal(Number(br.headers['content-length']), br.body.length, name + ': Länge stimmt');
      assert.match(br.headers.vary || '', /Accept-Encoding/);
      assert.ok(entpacken(br).equals(original), name + ': Brotli entpackt = (schlanke) Datei');
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
    // Deploy-Fall über HTTP: app.css bekommt eine neue Änderungszeit, Inhalt gleich -> 304.
    const css = join(PUBLIC, 'app.css'); const vorher = fs.statSync(css);
    const alt = (await roh(port, '/app.css', BROWSER)).headers.etag;
    try {
      fs.utimesSync(css, vorher.atime, new Date(vorher.mtimeMs + 86400000));
      assert.equal((await roh(port, '/app.css', { ...BROWSER, 'if-none-match': alt })).status, 304, 'nach Deploy ohne Änderung kein Neu-Download');
    } finally { fs.utimesSync(css, vorher.atime, vorher.mtime); }
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

// ── Schlanke Skripte (http/schlank.js) ───────────────────────────────────────
const ausfuehren = (code) => JSON.stringify(vm.runInNewContext(code + '\n;ergebnis'));

test('Schlank: Kommentarzeichen in Texten, Vorlagen und regulären Ausdrücken bleiben, Ergebnis gleich', () => {
  const quelle = fs.readFileSync(join(HIER, 'fixtures', 'schlank-beispiel.js'), 'utf8');
  const schlank = schlankJs(quelle);
  assert.equal(ausfuehren(schlank), ausfuehren(quelle));
  assert.ok(!/Kommentar am Anfang|Block-Kommentar/.test(schlank), 'Kommentare entfernt');
  assert.match(schlank, /\/\/ bleibt\n        eingerückt bleibt/, 'Vorlagentext unverändert, samt Einrückung');
  assert.match(schlank, /let w = z\n\+\+z/, 'Zeilenumbruch bleibt (Semikolon-Regel)');
  assert.ok(!/^[ \t]+\S/m.test(schlank.replace(/`[^`]*`/g, '')), 'keine Einrückung außerhalb von Vorlagen');
});

test('Schlank sicher: Unübersetzbares geht unverändert hinaus', () => {
  const kaputt = Buffer.from('const a = `offen');
  assert.ok(schlankSicher(kaputt, { name: 'kaputt.js' }).equals(kaputt));
  const ok = Buffer.from('// x\nconst a = 1;\n');
  assert.equal(schlankSicher(ok).toString(), 'const a = 1;\n');
});

test('Schlank: app.js, i18n.js, sw.js Token für Token gleich (Abgleich mit einem echten Parser)', (t) => {
  let acorn;
  try { acorn = createRequire('/opt/node-tools/')('acorn'); } catch { return t.skip('acorn nicht vorhanden'); }
  const tokens = (s) => { const out = []; for (const x of acorn.tokenizer(s, { ecmaVersion: 'latest' })) out.push(x.type.label + '\u0000' + (x.value === undefined ? '' : String(x.value))); return out; };
  // Zeilen je Token: Wo im Original ein Zeilenumbruch zwischen zwei Tokens stand, muss einer bleiben.
  const umbrueche = (s) => { const out = []; let vor = null; for (const x of acorn.tokenizer(s, { ecmaVersion: 'latest', locations: true })) { if (vor) out.push(x.loc.start.line > vor.loc.end.line); vor = x; } return out; };
  for (const name of ['app.js', 'i18n.js', 'sw.js']) {
    const roh = fs.readFileSync(join(PUBLIC, name), 'utf8');
    const schlank = schlankJs(roh);
    const a = tokens(roh); const b = tokens(schlank);
    assert.equal(b.length, a.length, name + ': Anzahl Tokens');
    const erste = a.findIndex((x, k) => x !== b[k]);
    assert.equal(erste, -1, `${name}: Abweichung bei Token ${erste}: ${a[erste]} / ${b[erste]}`);
    // Erste Abweichung statt deepEqual: ein Unterschiedsbericht über 100 000 Einträge sprengt den Speicher.
    const ua = umbrueche(roh); const ub = umbrueche(schlank);
    const ersteU = ua.findIndex((x, k) => x !== ub[k]);
    assert.equal(ersteU, -1, `${name}: Zeilenumbruch zwischen Token ${ersteU} und ${ersteU + 1} ${ua[ersteU] ? 'verloren' : 'hinzugekommen'} (${a[ersteU + 1]})`);
    if (name === 'app.js') assert.ok(schlank.length < roh.length * 0.9, 'app.js spürbar kleiner');
  }
});

