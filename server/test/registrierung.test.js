// Registrierung: erst prüfen, dann anlegen.
//
// Bis 10/2026 legte /api/register Organisation und Konto an und prüfte den
// @Handle erst danach. Ein zu kurzer oder schon vergebener Handle ließ ein
// Konto OHNE Profil zurück — und die E-Mail war fortan „bereits vergeben".
// Wer sich vertippte, kam nie wieder hinein. Das Formular verlangte den
// Handle als Pflichtfeld, Kollisionen („anna_huber") waren also absehbar.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleAusName, freierHandle, normalizeHandle, HANDLE_RE } from '../src/domain/handle.js';

test('Handle aus dem Namen: lesbar, Umlaute umschrieben, gültig', () => {
  assert.equal(handleAusName('Jürgen Müller'), 'juergen_mueller');
  assert.equal(handleAusName('Dr. Anna Huber'), 'dr_anna_huber');
  assert.equal(handleAusName('Maria da Conceição'), 'maria_da_conceicao');
  assert.equal(handleAusName('Straße & Söhne'), 'strasse_soehne');
  assert.equal(handleAusName('Li'), 'mitglied', 'zu kurz -> Ersatz statt ungültig');
  assert.equal(handleAusName('李明'), 'mitglied');
  for (const n of ['Jürgen Müller', 'A'.repeat(80), '  ---  ', 'Ångström Ørsted']) assert.match(handleAusName(n), HANDLE_RE, n);
  assert.equal(normalizeHandle(' @Anna_Huber '), 'anna_huber');
});

test('freier Handle: belegt -> _2, _3 …', () => {
  const belegt = new Set(['anna_huber', 'anna_huber_2']);
  assert.equal(freierHandle('Anna Huber', (h) => belegt.has(h)), 'anna_huber_3');
  assert.equal(freierHandle('Anna Huber', () => false), 'anna_huber');
  const lang = freierHandle('B'.repeat(80), (h) => h.length < 26);
  assert.match(lang, HANDLE_RE, 'mit Endung noch gültig (max. 30 Zeichen)');
});

// ── Über HTTP ────────────────────────────────────────────────────────────────
const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'http', 'server.js');
function starte(datei) {
  const kind = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'registrierung-test', APOPULSE_DATA_FILE: datei,
      APOPULSE_ADMIN_EMAIL: 'red@reg.test', APOPULSE_ADMIN_PASSWORD: 'registrierung-123', APOPULSE_PRESSE: 'aus' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  const bereit = new Promise((ok, fail) => {
    const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch. Log:\n' + log)), 20000);
    const lies = (d) => { log += d; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
    kind.stdout.on('data', lies); kind.stderr.on('data', lies);
    kind.on('exit', (code) => { clearTimeout(zeit); fail(new Error(`Server beendet (Code ${code}). Log:\n${log}`)); });
  });
  return { kind, bereit };
}
const stopp = (k) => new Promise((ok) => { if (k.exitCode !== null) return ok(); k.once('exit', ok); k.kill(); });

let dir, datei, srv, BASE;
before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'apopulse-reg-'));
  datei = join(dir, 'stand.json');
  srv = starte(datei);
  BASE = `http://localhost:${await srv.bereit}`;
});
after(async () => { await stopp(srv.kind); rmSync(dir, { recursive: true, force: true }); });

const registriere = async (body) => {
  const r = await fetch(BASE + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'Passwort123!', country: 'AT', ...body }) });
  return { status: r.status, d: await r.json() };
};

test('ungültiger Handle verbrennt die E-Mail nicht', async () => {
  const a = await registriere({ name: 'Anna Huber', email: 'anna@reg.test', handle: 'a' });
  assert.equal(a.status, 400);
  assert.equal(a.d.code, 'profile_handle_format');
  const b = await registriere({ name: 'Anna Huber', email: 'anna@reg.test' });
  assert.equal(b.status, 200, 'zweiter Versuch scheiterte: ' + JSON.stringify(b.d));
  assert.equal(b.d.profile.handle, 'anna_huber');
});

test('vergebener Handle verbrennt die E-Mail nicht', async () => {
  const a = await registriere({ name: 'Ben', email: 'ben@reg.test', handle: 'anna_huber' });
  assert.equal(a.status, 400);
  assert.equal(a.d.code, 'handle_taken');
  const b = await registriere({ name: 'Ben', email: 'ben@reg.test', handle: 'ben_m' });
  assert.equal(b.status, 200, JSON.stringify(b.d));
});

test('ohne Handle: aus dem Namen, bei Gleichnamigen mit Zählung', async () => {
  const a = await registriere({ name: 'Anna Huber', email: 'anna2@reg.test' });
  assert.equal(a.status, 200);
  assert.equal(a.d.profile.handle, 'anna_huber_2');
  const c = await registriere({ name: 'Jürgen Müller', email: 'j@reg.test', handle: '@Juergen_M' });
  assert.equal(c.d.profile.handle, 'juergen_m', 'Wunsch-Handle mit @ und Großbuchstaben normalisiert');
});

test('E-Mail doppelt / Passwort zu kurz / ohne Name: Fehler mit Code, nichts angelegt', async () => {
  await new Promise((ok) => setTimeout(ok, 700)); // gedrosseltes Schreiben der vorigen Tests abwarten
  const vorher = JSON.parse(readFileSync(datei, 'utf8')).foundation.organizations.length;
  const d = await registriere({ name: 'X', email: 'ANNA@reg.test' });
  assert.equal(d.status, 400); assert.equal(d.d.code, 'email_taken');
  const p = await registriere({ name: 'Y', email: 'y@reg.test', password: 'kurz' });
  assert.equal(p.status, 400); assert.equal(p.d.code, 'pw_too_short');
  const n = await registriere({ name: '  ', email: 'n@reg.test' });
  assert.equal(n.status, 400); assert.equal(n.d.code, 'display_name_required');
  await new Promise((ok) => setTimeout(ok, 700)); // gedrosseltes Schreiben
  const nachher = JSON.parse(readFileSync(datei, 'utf8')).foundation.organizations.length;
  assert.equal(nachher, vorher, 'fehlgeschlagene Registrierungen hinterließen Organisationen');
});

test('Konto ohne Profil (Altbestand) wird beim Start der App repariert', { timeout: 60000 }, async () => {
  // Altbestand nachstellen: Konto mit Organisation, aber ohne Profil — so blieb
  // es bis 10/2026 nach einem gescheiterten Handle zurück.
  const ok = await registriere({ name: 'Carla Alt', email: 'carla@reg.test' });
  assert.equal(ok.status, 200);
  await new Promise((r) => setTimeout(r, 700));
  await stopp(srv.kind);
  const stand = JSON.parse(readFileSync(datei, 'utf8'));
  const uid = ok.d.user.id;
  stand.social.profiles = stand.social.profiles.filter(([id]) => id !== uid);
  stand.social.profilesByHandle = stand.social.profilesByHandle.filter(([, id]) => id !== uid);
  writeFileSync(datei, JSON.stringify(stand));
  srv = starte(datei);
  BASE = `http://localhost:${await srv.bereit}`;

  const tok = (await (await fetch(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'carla@reg.test', password: 'Passwort123!' }) })).json()).token;
  const H = { 'content-type': 'application/json', authorization: 'Bearer ' + tok };
  assert.equal((await (await fetch(BASE + '/api/me', { headers: H })).json()).profile, null, 'Altbestand nicht nachgestellt');
  const r1 = await (await fetch(BASE + '/api/profil/nachholen', { method: 'POST', headers: H, body: JSON.stringify({ country: 'DE', locale: 'de' }) })).json();
  assert.equal(r1.angelegt, true);
  assert.equal(r1.profile.handle, 'carla_alt');
  assert.equal(r1.profile.country, 'DE');
  const r2 = await (await fetch(BASE + '/api/profil/nachholen', { method: 'POST', headers: H, body: JSON.stringify({ country: 'AT' }) })).json();
  assert.equal(r2.angelegt, false, 'zweiter Aufruf darf nichts ändern');
  assert.equal(r2.profile.country, 'DE');
  const ohne = await fetch(BASE + '/api/profil/nachholen', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(ohne.status, 401, 'ohne Anmeldung darf niemand Profile anlegen');
});
