// Abgemeldet, weil das Passwort geändert oder „auf allen anderen Geräten abmelden" gedrückt wurde:
// Fund 11/2026 (Rundgang fr-SN, 360 px): Das hinausgeworfene Gerät stand kommentarlos vor der
// Anmeldung. Dabei ist das ein Sicherheitssignal — „Waren Sie das nicht? Passwort zurücksetzen."
// Der Server sagt jetzt WARUM (grund: 'sitzung_beendet', Code bleibt not_authenticated für alte
// App-Versionen); die App erklärt es auf der Anmeldeseite und beendet Push im Browser dieses Geräts
// (sonst übernähme die nächste Person am Tresen das alte Abo beim Start).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HIER, '..', 'src', 'http', 'server.js');
const APP = readFileSync(join(HIER, '..', 'public', 'app.js'), 'utf8');
const I18N = readFileSync(join(HIER, '..', 'public', 'i18n.js'), 'utf8');

test('401 nennt den Grund „Sitzung beendet" — nur dann', { timeout: 60000 }, async () => {
  const kind = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'sitzung-grund-1', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  try {
    const port = await new Promise((ok, fail) => {
      const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
      const lies = (d) => { log += d; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
      kind.stdout.on('data', lies); kind.stderr.on('data', lies);
      kind.on('exit', (c) => { clearTimeout(zeit); fail(new Error(`Server beendet (${c}):\n${log}`)); });
    });
    const B = `http://localhost:${port}`;
    const post = async (pfad, tok, body) => { const r = await fetch(B + pfad, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: JSON.stringify(body || {}) }); return { status: r.status, d: await r.json() }; };
    const me = async (tok) => { const r = await fetch(B + '/api/me', { headers: { authorization: 'Bearer ' + tok } }); return { status: r.status, d: await r.json() }; };
    const tresen = (await post('/api/register', '', { name: 'Tresen', email: 'tresen@apo.sn', password: 'Passwort-Alt-1', country: 'SN', accountType: 'pharmacy' })).d.token;
    const handy = (await post('/api/login', '', { email: 'tresen@apo.sn', password: 'Passwort-Alt-1' })).d.token;
    await new Promise((ok) => setTimeout(ok, 5));
    await post('/api/me/sitzungen/beenden', handy);
    const r = await me(tresen);
    assert.equal(r.status, 401);
    assert.equal(r.d.code, 'not_authenticated', 'alte App-Versionen erkennen das weiter');
    assert.equal(r.d.grund, 'sitzung_beendet');
    // Kaputter/fremder Schlüssel: kein Grund (nichts über Konten verraten).
    const kaputt = await me('abc.def');
    assert.equal(kaputt.status, 401); assert.equal(kaputt.d.grund, undefined);
    // Konto gelöscht: kein „Sitzung beendet".
    const weg = (await post('/api/register', '', { name: 'Weg', email: 'weg@apo.sn', password: 'Passwort-Weg-1', country: 'SN', accountType: 'pharmacy' })).d.token;
    assert.equal((await post('/api/me/delete', weg, { password: 'Passwort-Weg-1' })).status, 200);
    const geloescht = await me(weg);
    assert.equal(geloescht.status, 401); assert.equal(geloescht.d.grund, undefined);
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});

test('App: Hinweis auf der Anmeldeseite, Reiter „Anmelden", Push im Browser beendet', () => {
  assert.match(APP, /if \(data\.grund === 'sitzung_beendet'\) \{ try \{ sessionStorage\.setItem\('apo_sitzung_beendet', '1'\); \} catch/);
  assert.match(APP, /pushLokalBeenden\(\);/, 'Push-Abo des hinausgeworfenen Geräts bleibt im Browser');
  assert.match(APP, /async function pushLokalBeenden\(\) \{[\s\S]{0,200}abo\.unsubscribe\(\)/);
  const as = APP.slice(APP.indexOf('function authScreen()'), APP.indexOf('\nfunction afterAuth('));
  assert.match(as, /zeigeAuth\(kontoBekannt \|\| oauthFehler \|\| sitzungBeendet \? 'login' : 'register'\)/);
  assert.match(as, /data-sitzungbeendet/);
  // Zitierte Knöpfe aus denselben Texten wie die Knöpfe selbst (en/pt/fr wichen ab).
  assert.match(as, /ti\('sb_text', \{ abmelden: t\('ac_sess_btn'\), vergessen: t\('au_forgot'\) \}\)/);
  for (const sp of ['de', 'en', 'pt', 'fr', 'ar']) {
    const start = I18N.indexOf(`\n  ${sp}: {`);
    const blk = I18N.slice(start, I18N.indexOf('\n  },', start));
    for (const k of ['sb_titel', 'sb_text']) assert.match(blk, new RegExp(`[\\s,]${k}:`), `${k} fehlt (${sp})`);
    assert.match(blk, /sb_text:'[^']*\{abmelden\}[^']*\{vergessen\}/, `Platzhalter fehlen (${sp})`);
  }
});
