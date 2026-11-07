// Leerzeichen/Zeilenumbruch am Rand einer Render-Variable (Kopierfehler) dürfen nichts kaputt machen.
// Fund 11/2026: APOPULSE_ADMIN_PASSWORD mit Leerzeichen oder Zeilenumbruch am Ende → die Redaktion kam nicht
// mehr hinein, ohne jeden Hinweis. Ebenso ungeprüft: Google-/Facebook-Zugang (der Zeilenumbruch landete in der
// client_id des Anmelde-Links), Stripe, PayPal, SMS-Benutzer, AIS-Schlüssel. Mail-Schlüssel, Wallets, VAPID
// wurden schon bereinigt — uneinheitlich. Jetzt: ein Baustein, der als ERSTES geladen wird, bereinigt die Ränder
// aller App-Variablen (innen bleibt alles, z. B. eine mehrzeilige Anschrift) und nennt nur die NAMEN im Protokoll.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { raenderBereinigen } from '../src/http/umgebung.js';

const HIER = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HIER, '..', 'src', 'http', 'server.js');

test('raenderBereinigen: nur App-Variablen, nur die Ränder, Namen statt Werte', () => {
  const env = { APOPULSE_ADMIN_PASSWORD: 'geheim-123\n', OAUTH_GOOGLE_CLIENT_ID: ' abc.apps ', DATABASE_URL: 'postgres://x\r\n',
    APOPULSE_FIRMA_ANSCHRIFT: 'Weg 1\n1010 Wien', PATH: ' /usr/bin ', STRIPE_SECRET_KEY: 'sk_ok', RESEND_X: ' y ' };
  const namen = raenderBereinigen(env);
  assert.deepEqual(namen.sort(), ['APOPULSE_ADMIN_PASSWORD', 'DATABASE_URL', 'OAUTH_GOOGLE_CLIENT_ID']);
  assert.equal(env.APOPULSE_ADMIN_PASSWORD, 'geheim-123');
  assert.equal(env.OAUTH_GOOGLE_CLIENT_ID, 'abc.apps');
  assert.equal(env.DATABASE_URL, 'postgres://x');
  assert.equal(env.APOPULSE_FIRMA_ANSCHRIFT, 'Weg 1\n1010 Wien', 'innen bleibt der Zeilenumbruch');
  assert.equal(env.PATH, ' /usr/bin ', 'fremde Variablen bleiben unangetastet');
});

test('Server: Bereinigung kommt direkt nach env-compat, vor allen anderen Bausteinen', () => {
  const src = readFileSync(SERVER, 'utf8');
  const importe = src.split('\n').filter((z) => z.startsWith('import '));
  assert.equal(importe[0], "import '../env-compat.js';", 'alte Namen zuerst spiegeln');
  assert.equal(importe[1], "import './umgebung.js'; // direkt danach: Ränder bereinigen, bevor ein Baustein die Werte liest");
});

test('Über HTTP: Admin-Passwort und Google-Zugang mit Zeilenumbruch funktionieren; Protokoll ohne Werte', { timeout: 60000 }, async () => {
  const kind = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'raender-1', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus', APOPULSE_EXTERN_AUS: '1',
      APOPULSE_ADMIN_EMAIL: 'red@rd.test', APOPULSE_ADMIN_PASSWORD: 'langes-passwort-1 \n',
      OAUTH_GOOGLE_CLIENT_ID: 'abc123.apps.googleusercontent.com\n', OAUTH_GOOGLE_CLIENT_SECRET: ' gsecret-wert ' },
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
    const r = await fetch(B + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'red@rd.test', password: 'langes-passwort-1' }) });
    assert.equal(r.status, 200, 'Redaktion kommt mit dem gemeinten Passwort nicht hinein');
    const pv = await (await fetch(B + '/api/auth/providers?redirect_uri=' + encodeURIComponent(B + '/'))).json();
    const g = pv.providers.find((p) => p.provider === 'google');
    assert.ok(g && g.authorize_url, 'Google fehlt');
    assert.equal(new URL(g.authorize_url).searchParams.get('client_id'), 'abc123.apps.googleusercontent.com');
    assert.match(log, /APOPULSE_ADMIN_PASSWORD/);
    assert.match(log, /OAUTH_GOOGLE_CLIENT_SECRET/);
    assert.ok(!log.includes('langes-passwort-1') && !log.includes('gsecret-wert'), 'Wert im Protokoll');
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});
