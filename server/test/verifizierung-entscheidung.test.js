// Betriebs-Bestätigung: Ablehnung mit Grund + Benachrichtigung (bis 10/2026 erfuhr die Person
// nichts), Freigabe mit Rx-Einblick nur nach Rückfrage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(join(HIER, '..', 'public', 'app.js'), 'utf8');
const I18N = readFileSync(join(HIER, '..', 'public', 'i18n.js'), 'utf8');

test('HTTP: Ablehnung mit Grund → Benachrichtigung + Grund im eigenen Antrag; Freigabe ohne Grund; nur Moderation', { timeout: 30000 }, async () => {
  const kind = spawn(process.execPath, [join(HIER, '..', 'src', 'http', 'server.js')], { env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'vf-test-1', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus',
    APOPULSE_ADMIN_EMAIL: 'red@vft.test', APOPULSE_ADMIN_PASSWORD: 'red-PW-98765' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  try {
    const port = await new Promise((ok, fail) => {
      const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
      const lies = (d) => { log += d; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
      kind.stdout.on('data', lies); kind.stderr.on('data', lies);
    });
    const B = `http://localhost:${port}`;
    const call = async (p, b, t) => { const r = await fetch(B + p, { method: b ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(t ? { authorization: 'Bearer ' + t } : {}) }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, json: await r.json() }; };
    const tunde = (await call('/api/register', { name: 'Tunde', email: 't@vft.test', password: 'Passwort123!', country: 'NG', accountType: 'logistics' })).json;
    const ama = (await call('/api/register', { name: 'Ama', email: 'a@vft.test', password: 'Passwort123!', country: 'GH', accountType: 'pharmacy' })).json;
    const red = (await call('/api/login', { email: 'red@vft.test', password: 'red-PW-98765' })).json.token;
    await call('/api/verify/request', { licenseNumber: 'RC-1', note: 'ColdLink' }, tunde.token);
    await call('/api/verify/request', { licenseNumber: 'PC-2', note: 'Ama Pharmacy' }, ama.token);
    assert.equal((await call(`/api/verify/${tunde.user.id}/resolve`, { approve: false, grund: '#x' }, ama.token)).status, 403, 'nur Moderation');
    assert.equal((await call(`/api/verify/${tunde.user.id}/resolve`, { approve: false, grund: '#nicht_gefunden: PCN Lagos' }, red)).status, 200);
    const me = (await call('/api/verify/me', null, tunde.token)).json;
    assert.equal(me.status, 'abgelehnt'); assert.equal(me.grund, '#nicht_gefunden: PCN Lagos');
    const n = (await call('/api/notifications', null, tunde.token)).json.notifications;
    assert.deepEqual(n.map((x) => [x.type, x.label]), [['verify_rejected', '#nicht_gefunden: PCN Lagos']]);
    // Neuer Antrag: wieder offen, kein alter Grund mehr sichtbar.
    await call('/api/verify/request', { licenseNumber: 'RC-1845532', note: 'ColdLink Logistics Lagos' }, tunde.token);
    const neu = (await call('/api/verify/me', null, tunde.token)).json;
    assert.equal(neu.status, 'offen'); assert.equal(neu.grund, null);
    // Freigabe: Benachrichtigung „verified", kein Grund.
    assert.equal((await call(`/api/verify/${ama.user.id}/resolve`, { approve: true, grund: 'egal' }, red)).status, 200);
    assert.equal((await call('/api/verify/me', null, ama.token)).json.status, 'verifiziert');
    assert.ok((await call('/api/notifications', null, ama.token)).json.notifications.some((x) => x.type === 'verified'));
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});

test('App: Standardgründe in allen Sprachen, Grund in der Sprache der Leserin, Rückfrage vor Rx-Freigabe, Ablehnen nur mit Grund', () => {
  const gruende = JSON.parse(APP.match(/const VF_GRUENDE = (\[[^\]]+\])/)[1].replace(/'/g, '"'));
  for (const k of [...gruende.map((g) => 'vg_' + g), 'vg_rx_frage', 'vg_grund_fehlt', 'nv_verify_rejected', 'vg_senden']) {
    assert.equal((I18N.match(new RegExp(`[\\s,{]${k}:`, 'g')) || []).length, 5, k);
  }
  const f = APP.slice(APP.indexOf('function vfGrund('), APP.indexOf('const ABLEHN_GRUENDE'));
  const c = { t: (k) => ({ vg_nicht_gefunden: 'Not found in the official register.' }[k] || k) };
  vm.runInNewContext(`const VF_GRUENDE = ${JSON.stringify(gruende)};` + f + ';this.g = vfGrund;', c);
  assert.equal(c.g('#nicht_gefunden: PCN Lagos'), 'Not found in the official register. — PCN Lagos');
  assert.equal(c.g('Freitext der Redaktion'), 'Freitext der Redaktion');
  assert.match(APP, /if \(rq\.would_allow_rx && !confirm\(ti\('vg_rx_frage'/);
  assert.match(APP, /if \(!code && !zusatz\) \{ card\.querySelector\('\[data-vferr\]'\)\.textContent = t\('vg_grund_fehlt'\); return; \}/);
  assert.match(APP, /n\.type==='verify_rejected'\?vfGrund\(n\.label\)/);
});

test('Push: Ergebnis der Bestätigung in 5 Sprachen, ohne Freitext der Redaktion; „abgelehnt" öffnet den Antrag', async () => {
  const { pushNachricht, PUSH_TYPEN } = await import('../src/services/webPush.js');
  assert.ok(PUSH_TYPEN.has('verified') && PUSH_TYPEN.has('verify_rejected'));
  for (const sprache of ['de', 'en', 'pt', 'fr', 'ar']) {
    const nein = pushNachricht({ type: 'verify_rejected', label: '#nicht_gefunden: geheimer Zusatz der Redaktion' }, { sprache });
    const ja = pushNachricht({ type: 'verified' }, { sprache });
    assert.ok(nein.titel && nein.text && ja.titel && ja.text, sprache);
    assert.ok(!/geheimer|#nicht_gefunden/.test(nein.text + nein.titel), 'Freitext im Push');
    assert.equal(nein.url, '/?bestaetigung=1'); assert.equal(ja.url, '/');
  }
  assert.notEqual(pushNachricht({ type: 'verified' }, { sprache: 'fr' }).titel, pushNachricht({ type: 'verified' }, { sprache: 'en' }).titel);
  assert.match(APP, /if \(params\.get\('bestaetigung'\) === '1'\) \{ history\.replaceState\(null, '', location\.pathname\); zurVerifizierung\(\); return; \}/);
});
