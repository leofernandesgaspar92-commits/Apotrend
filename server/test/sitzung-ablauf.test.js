// Sitzungen laufen ab, wenn sie lange nicht benutzt werden — aktive Nutzerinnen merken nichts (gleitende Erneuerung).
// Fund 11/2026: Anmelde-Token liefen NIE ab. Ein vergessener Rechner in der Apotheke, ein verlorenes Handy oder ein
// kopiertes Token gab dauerhaft Zugang, bis jemand „Auf allen anderen Geräten abmelden" wählte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GEHEIM = 'sitzung-ablauf-geheim-1234';
process.env.APOPULSE_TOKEN_SECRET = GEHEIM;
const { issueToken, tokenDetails, sitzungAbgelaufen, sitzungErneuern, SITZUNG_MAX_TAGE } = await import('../src/http/token.js');
const HIER = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HIER, '..', 'src', 'http', 'server.js');
const APP = readFileSync(join(HIER, '..', 'public', 'app.js'), 'utf8');
const SW = readFileSync(join(HIER, '..', 'public', 'sw.js'), 'utf8');
const I18N = readFileSync(join(HIER, '..', 'public', 'i18n.js'), 'utf8');
const TAG = 864e5;

test('Regel: nach 60 Tagen ohne Nutzung abgelaufen; älter als ein Tag → erneuern; alte Token ohne Zeitpunkt erneuern', () => {
  assert.equal(SITZUNG_MAX_TAGE, 60);
  const jetzt = Date.now();
  assert.ok(sitzungAbgelaufen(tokenDetails(issueToken('u', jetzt - 61 * TAG)), jetzt));
  assert.ok(!sitzungAbgelaufen(tokenDetails(issueToken('u', jetzt - 59 * TAG)), jetzt));
  const alt = { userId: 'u', ausgestellt: null };
  assert.ok(!sitzungAbgelaufen(alt, jetzt), 'Token ohne Zeitpunkt: nicht sofort hinauswerfen');
  assert.ok(sitzungErneuern(alt, jetzt), '… sondern beim nächsten Aufruf erneuern');
  assert.ok(sitzungErneuern(tokenDetails(issueToken('u', jetzt - 2 * TAG)), jetzt));
  assert.ok(!sitzungErneuern(tokenDetails(issueToken('u', jetzt - 3600e3)), jetzt));
});

async function starte(env = {}) {
  const kind = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: GEHEIM, APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus', APOPULSE_EXTERN_AUS: '1', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  const port = await new Promise((ok, fail) => {
    const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
    const lies = (d) => { log += d; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
    kind.stdout.on('data', lies); kind.stderr.on('data', lies);
    kind.on('exit', (c) => { clearTimeout(zeit); fail(new Error(`Server beendet (${c}):\n${log}`)); });
  });
  const ende = () => new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  return { B: `http://localhost:${port}`, ende };
}

test('Über HTTP: abgelaufen → 401 „sitzung_abgelaufen"; älter als ein Tag → neues Token in X-Apo-Token; frisch → keins', { timeout: 60000 }, async () => {
  const s = await starte();
  try {
    const reg = await (await fetch(s.B + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Ablauf Test', email: 'ab@sa.test', password: 'Passwort123!', country: 'KE', accountType: 'pharmacy' }) })).json();
    const uid = reg.user.id;
    const me = (tok) => fetch(s.B + '/api/me', { headers: { authorization: 'Bearer ' + tok } });
    const frisch = await me(reg.token);
    assert.equal(frisch.status, 200); assert.equal(frisch.headers.get('x-apo-token'), null, 'frisches Token unnötig erneuert');
    const alt = await me(issueToken(uid, Date.now() - 61 * TAG));
    assert.equal(alt.status, 401);
    const d = await alt.json();
    assert.equal(d.code, 'not_authenticated'); assert.equal(d.grund, 'sitzung_abgelaufen');
    const zweiTage = await me(issueToken(uid, Date.now() - 2 * TAG));
    assert.equal(zweiTage.status, 200);
    const neu = zweiTage.headers.get('x-apo-token');
    assert.ok(neu, 'kein neues Token');
    const det = tokenDetails(neu);
    assert.equal(det.userId, uid); assert.ok(Date.now() - det.ausgestellt < 60e3, 'neues Token nicht frisch');
    assert.equal((await me(neu)).status, 200);
    // Gelöschtes/fremdes Konto bekommt nie ein Token.
    const fremd = await me(issueToken('gibt-es-nicht', Date.now() - 2 * TAG));
    assert.equal(fremd.status, 401); assert.equal(fremd.headers.get('x-apo-token'), null);
  } finally { await s.ende(); }
  // Dauer einstellbar (APOPULSE_SITZUNG_TAGE).
  const k = await starte({ APOPULSE_SITZUNG_TAGE: '10' });
  try {
    const reg = await (await fetch(k.B + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Kurz Test', email: 'k@sa.test', password: 'Passwort123!', country: 'KE', accountType: 'pharmacy' }) })).json();
    assert.equal((await fetch(k.B + '/api/me', { headers: { authorization: 'Bearer ' + issueToken(reg.user.id, Date.now() - 11 * TAG) } })).status, 401);
  } finally { await k.ende(); }
});

test('App: übernimmt das neue Token nur aus echter Antwort und nur angemeldet; eigener Hinweis bei Ablauf (5 Sprachen); Service Worker speichert kein Token', () => {
  assert.match(APP, /const neuesToken = r\.headers\.get\('x-apo-token'\);\n\s*if \(neuesToken && !r\.headers\.get\('x-apo-offline'\) && localStorage\.getItem\('apo_token'\) === tok\) localStorage\.setItem\('apo_token', neuesToken\);/);
  assert.match(APP, /data\.grund === 'sitzung_abgelaufen'/);
  assert.match(APP, /data-sitzungabgelaufen/);
  assert.match(SW, /kopf\.delete\('x-apo-token'\)/);
  for (const sp of ['de', 'en', 'pt', 'fr', 'ar']) {
    const start = I18N.indexOf(`\n  ${sp}: {`);
    const blk = I18N.slice(start, I18N.indexOf('\n  },', start));
    for (const k2 of ['sa_titel', 'sa_text']) assert.match(blk, new RegExp(`[\\s,]${k2}:'[^']{10,}'`), `${k2} (${sp})`);
  }
});
