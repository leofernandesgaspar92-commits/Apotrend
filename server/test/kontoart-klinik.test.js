// Kontoart „Arztpraxis / Klinik / Krankenhaus": Ärzt:innen gehören zur Zielgruppe, hatten aber
// keine Kontoart (mussten sich als Apotheke oder Privat ausgeben). Dazu: Begrüßung ohne Titel,
// Organisationsname ohne automatisches „Apotheke".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listAccountTypes, normalizeAccountType } from '../src/data/accountTypes.js';
import { verificationStatusFor } from '../src/domain/jurisdiction.js';
import { ZIELGRUPPEN } from '../src/data/werbeplaetze.js';

const HIER = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(join(HIER, '..', 'public', 'app.js'), 'utf8');
const I18N = readFileSync(join(HIER, '..', 'public', 'i18n.js'), 'utf8');

test('Register: Klinik direkt nach Apotheke; jede Kontoart in allen 5 Sprachen benannt; als Werbe-Zielgruppe wählbar', () => {
  const keys = listAccountTypes().map((a) => a.key);
  assert.deepEqual(keys.slice(0, 2), ['pharmacy', 'clinic']);
  assert.equal(normalizeAccountType('CLINIC'), 'clinic');
  for (const k of keys) {
    assert.equal((I18N.match(new RegExp(`[\\s,{]at_${k}:`, 'g')) || []).length, 5, `at_${k} fehlt in einer Sprache`);
    assert.match(APP, new RegExp(`${k}:'at_${k}'`), `ACCT_I18N ohne ${k}`);
  }
  assert.deepEqual([...ZIELGRUPPEN].sort(), [...keys].sort(), 'Werbe-Zielgruppen ≠ Kontoarten');
  const wb = APP.match(/const WB_GRUPPEN = (\[[^\]]+\])/)[1];
  assert.deepEqual(JSON.parse(wb.replace(/'/g, '"')), ZIELGRUPPEN);
});

test('Rx-Angebote: Klinik bleibt auch bestätigt ohne Freigabe (fail closed), bis die Rechtslage geklärt ist', () => {
  assert.equal(verificationStatusFor({ accountType: 'clinic', verified: true }), 'UNVERIFIED');
  assert.equal(verificationStatusFor({ accountType: 'pharmacy', verified: true }), 'VERIFIED_PHARMACY');
});

test('Begrüßung überspringt Titel und Anreden (mit und ohne Punkt), aber keine echten Vornamen', () => {
  const re = APP.match(/const ANREDE_RE = (\/.*\/i);/)[1];
  const c = {}; vm.runInNewContext(`const ANREDE_RE = ${re}; this.v = (hello) => hello.split(/\\s+/).find(w => !/\\.$/.test(w) && !ANREDE_RE.test(w)) || hello;`, c);
  assert.deepEqual(['Dr Ada Okafor', 'Prof. Dr. Jürgen Müller', 'Chief Emeka Obi', 'Alhaji Musa Bello', 'Drew Barry', 'Mrs Akua Mensah', 'Ama'].map(c.v),
    ['Ada', 'Jürgen', 'Emeka', 'Musa', 'Drew', 'Akua', 'Ama']);
  assert.match(APP, /\.find\(w => !\/\\\.\$\/\.test\(w\) && !ANREDE_RE\.test\(w\)\)/, 'Begrüßung nutzt ANREDE_RE');
});

test('Organisationsname: neue Konten ohne „Apotheke"-Zusatz; alte Zusätze werden nicht angezeigt', () => {
  const srv = readFileSync(join(HIER, '..', 'src', 'http', 'server.js'), 'utf8');
  assert.ok(!/\$\{name \|\| 'Meine'\} Apotheke/.test(srv), 'automatisches „<Name> Apotheke" wieder da');
  const f = APP.slice(APP.indexOf('function orgAnzeige('), APP.indexOf('const ANREDE_RE'));
  const c = { me: { display_name: 'Dr Ada Okafor' } }; vm.runInNewContext(f + ';this.o = orgAnzeige;', c);
  assert.equal(c.o('Dr Ada Okafor Apotheke'), 'Dr Ada Okafor');
  assert.equal(c.o('Meine Apotheke'), 'Dr Ada Okafor');
  assert.equal(c.o('Linden-Apotheke Wien'), 'Linden-Apotheke Wien', 'echter Apothekenname bleibt');
  assert.equal(c.o(null), '');
});

test('HTTP: Ärztin registriert sich als Klinik, meldet und bestätigt (Fachkreis), Privatperson weiterhin nicht', { timeout: 30000 }, async () => {
  const kind = spawn(process.execPath, [join(HIER, '..', 'src', 'http', 'server.js')], { env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'klinik-test-1', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  try {
    const port = await new Promise((ok, fail) => {
      const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
      const lies = (d) => { log += d; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
      kind.stdout.on('data', lies); kind.stderr.on('data', lies);
    });
    const B = `http://localhost:${port}`;
    const post = async (p, b, t) => { const r = await fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(t ? { authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(b) }); return { status: r.status, json: await r.json() }; };
    const apo = (await post('/api/register', { name: 'Chidi', email: 'chidi@k.test', password: 'Passwort123!', country: 'NG', accountType: 'pharmacy' })).json;
    const ada = (await post('/api/register', { name: 'Dr Ada Okafor', email: 'ada@k.test', password: 'Passwort123!', country: 'NG', accountType: 'clinic' })).json;
    const privat = (await post('/api/register', { name: 'Bola', email: 'bola@k.test', password: 'Passwort123!', country: 'NG', accountType: 'private' })).json;
    assert.equal(ada.profile.account_type, 'clinic');
    const m = await post('/api/shortages/report', { wirkstoff: 'Ceftriaxone', status: 'kritisch' }, apo.token);
    assert.equal((await post(`/api/shortages/${m.json.id}/confirm`, {}, ada.token)).status, 200, 'Klinik darf bestätigen');
    assert.equal((await post('/api/shortages/report', { wirkstoff: 'Oxytocin', status: 'kritisch' }, ada.token)).status, 200, 'Klinik darf melden');
    assert.equal((await post(`/api/shortages/${m.json.id}/confirm`, {}, privat.token)).status, 403, 'Privat weiterhin nicht');
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});
