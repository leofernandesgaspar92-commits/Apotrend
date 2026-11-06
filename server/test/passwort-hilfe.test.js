// „Passwort vergessen" ohne E-Mail-Versand: Die Seite bot nur Wiederherstellungscodes an.
// Fund 11/2026: Wer die Codes verloren hatte (häufig — sie werden einmal angezeigt), sah keinen
// Ausweg und keinen Kontakt. Jetzt: Kasten „Keinen Code mehr?" mit der Kontakt-Adresse des
// Betreibers (dieselbe, die das Impressum öffentlich nennt), sonst ein Link zum Impressum.
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

async function mitServer(extraEnv, f) {
  const kind = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'pw-hilfe-test-1', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus',
      APOPULSE_KONTAKT_EMAIL: '', ...extraEnv },
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
    await f(`http://localhost:${port}`);
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
}

test('/api/auth/providers nennt die Kontakt-Adresse für die Hilfe — nur wenn eingetragen', { timeout: 60000 }, async () => {
  await mitServer({ APOPULSE_KONTAKT_EMAIL: 'hilfe@apopulse.test' }, async (B) => {
    const pv = await (await fetch(B + '/api/auth/providers')).json();
    assert.equal(pv.hilfe_email, 'hilfe@apopulse.test');
  });
  await mitServer({}, async (B) => {
    const pv = await (await fetch(B + '/api/auth/providers')).json();
    assert.equal(pv.hilfe_email, null);
  });
});

test('„Passwort vergessen" zeigt einen Ausweg, wenn kein Code mehr da ist', () => {
  const rs = APP.slice(APP.indexOf('async function resetScreen()'), APP.indexOf('function pwLinkScreen('));
  assert.match(rs, /hilfeEmail = pv\.hilfe_email/, 'Kontakt-Adresse wird nicht gelesen');
  assert.match(rs, /data-rshilfe/, 'kein Hilfe-Kasten');
  assert.match(rs, /\$\{hilfe\}\s*<button type="button" class="linklike small" id="rs_back"/, 'Hilfe-Kasten gebaut, aber nicht auf der Seite');
  assert.match(rs, /mailto:\$\{esc\(hilfeEmail\)\}\?subject=\$\{encodeURIComponent\(t\('rs_hilfe_betreff'\)\)\}/);
  assert.match(rs, /href="\/impressum\?sp=\$\{esc\(LOCALE\)\}"/, 'ohne Adresse: kein Weg zum Impressum');
  for (const sp of ['de', 'en', 'pt', 'fr', 'ar']) {
    const start = I18N.indexOf(`\n  ${sp}: {`);
    const blk = I18N.slice(start, I18N.indexOf('\n  },', start));
    for (const k of ['rs_hilfe_titel', 'rs_hilfe_mail', 'rs_hilfe_ohne', 'rs_hilfe_impressum', 'rs_hilfe_betreff']) assert.match(blk, new RegExp(`[\\s,]${k}:`), `${k} fehlt (${sp})`);
  }
});
