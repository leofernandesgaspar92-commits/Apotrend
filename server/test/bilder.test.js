// Bilder per Adresse statt eingebettet (domain/bilder.js): Der Feed darf
// keine data:image-URLs mehr enthalten — das Profilbild stand vorher in
// JEDEM Beitrag der Person. In Mobilnetzen mit teuren Daten (Afrika) war das
// bei jedem Öffnen ein Vielfaches der eigentlichen Inhalte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bildAdresse, bildAusAdresse, bildHolen, BILD_PFAD } from '../src/domain/bilder.js';
import { cleanImage } from '../src/domain/media.js';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'http', 'server.js');
// Ein „Foto" von ~60 KB (Inhalt egal, Format zählt).
const bild = (fuell) => 'data:image/png;base64,' + Buffer.alloc(45000, fuell).toString('base64');

test('Adresse: gleich bei gleichem Inhalt, liefert die Bytes, löst sich beim Zurückschicken auf', () => {
  const a = bild(1);
  const adr = bildAdresse(a);
  assert.match(adr, /^\/api\/bild\/[0-9a-f]{64}$/);
  assert.equal(bildAdresse(a), adr);
  assert.notEqual(bildAdresse(bild(2)), adr);
  const b = bildHolen(adr.slice(BILD_PFAD.length));
  assert.equal(b.typ, 'image/png');
  assert.deepEqual(b.daten, Buffer.alloc(45000, 1));
  assert.equal(bildAusAdresse(adr), a);
  assert.equal(cleanImage(adr), a, 'Bearbeiten mit unverändertem Bild scheitert');
  // Nur, was der Server selbst kennt — keine fremden Adressen, keine Umwege.
  assert.throws(() => cleanImage('/api/bild/' + 'f'.repeat(64)), (e) => e.code === 'image_invalid');
  for (const x of ['/api/bild/../../etc/passwd', 'https://boese.example/x.png', adr + '?x', adr.toUpperCase()])
    assert.throws(() => cleanImage(x), (e) => e.code === 'image_invalid', x);
});

test('Über HTTP: Feed ohne eingebettete Bilder, Bild einmal laden und behalten, Export mit Bildern', { timeout: 60000 }, async () => {
  const env = { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'bild-test', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus' };
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
    const H = (t) => ({ 'content-type': 'application/json', authorization: 'Bearer ' + t });
    const tok = (await (await fetch(B + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Kampala Apo', email: 'ug@bild.test', password: 'Passwort123!', country: 'UG', accountType: 'pharmacy' }) })).json()).token;
    const avatar = bild(7); const foto = bild(9);
    assert.equal((await fetch(B + '/api/profile', { method: 'POST', headers: H(tok), body: JSON.stringify({ avatarUrl: avatar }) })).status, 200);
    for (let i = 0; i < 10; i++) {
      const r = await fetch(B + '/api/posts', { method: 'POST', headers: H(tok), body: JSON.stringify({ body: `Beitrag ${i}`, visibility: 'public', ...(i === 0 ? { image: foto } : {}) }) });
      assert.equal(r.status, 200, await r.text());
    }
    const roh = await (await fetch(B + '/api/feed/public', { headers: H(tok) })).text();
    assert.ok(!roh.includes('data:image'), 'Feed enthält eingebettete Bilder');
    assert.ok(roh.length < 30000, `Feed zu groß: ${roh.length} Zeichen (eingebettet wären es > 600 000)`);
    const feed = JSON.parse(roh).posts;
    assert.equal(feed.length, 10);
    const avAdr = feed[0].author.avatar_url;
    assert.match(avAdr, /^\/api\/bild\/[0-9a-f]{64}$/);
    assert.match(feed.find((p) => p.image).image, /^\/api\/bild\/[0-9a-f]{64}$/);

    const r = await fetch(B + avAdr);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'image/png');
    assert.match(r.headers.get('cache-control'), /private.*immutable/);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(Buffer.from(await r.arrayBuffer()), Buffer.alloc(45000, 7));
    assert.equal((await fetch(B + avAdr, { headers: { 'if-none-match': r.headers.get('etag') } })).status, 304);
    assert.equal((await fetch(B + '/api/bild/' + '0'.repeat(64))).status, 404);

    // Profil speichern mit unverändertem Bild (Adresse zurück): Bild bleibt dasselbe.
    assert.equal((await fetch(B + '/api/profile', { method: 'POST', headers: H(tok), body: JSON.stringify({ avatarUrl: avAdr }) })).status, 200);
    const me = await (await fetch(B + '/api/me', { headers: H(tok) })).json();
    assert.equal(me.profile.avatar_url, avAdr);

    // Datenexport: die eigenen Bilder selbst, keine Verweise auf diesen Server.
    const exp = await (await fetch(B + '/api/me/export', { headers: H(tok) })).text();
    assert.ok(exp.includes(avatar.slice(0, 200)), 'Export ohne Profilbild');
    assert.ok(!exp.includes('/api/bild/'), 'Export mit Server-Verweisen');
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});
