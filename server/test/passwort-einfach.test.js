// Zu leicht zu erratende Passwörter werden abgelehnt — bei Registrierung, Passwortwechsel und beiden Zurücksetz-Wegen.
// Fund 11/2026: Geprüft wurde nur „mindestens 8 Zeichen". 12345678, password, 00000000, apotheke, pharmacie wurden
// angenommen — genau die Passwörter, die beim massenhaften Durchprobieren zuerst versucht werden (und die IP-Sperren
// sind hinter Render evtl. umgehbar, siehe client-ip.test.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { passwortZuEinfach } from '../src/domain/password.js';

const HIER = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HIER, '..', 'src', 'http', 'server.js');
const I18N = readFileSync(join(HIER, '..', 'public', 'i18n.js'), 'utf8');

test('Regel: häufige Passwörter, Wiederholungen, Folgen, Tastaturreihen, eigene E-Mail — gute bleiben erlaubt', () => {
  for (const pw of ['12345678', '123456789', 'password', 'Password1', 'passwort1', 'motdepasse1', 'apotheke', 'Pharmacie', 'farmacia', 'qwertyuiop', 'azertyui',
    '00000000', 'aaaaaaaa', '12121212', 'abcabcabc', 'abcdefgh', '98765432', 'iloveyou']) assert.ok(passwortZuEinfach(pw), `angenommen: ${pw}`);
  assert.ok(passwortZuEinfach('wanjiru123', { email: 'wanjiru@apo.ke' }), 'E-Mail-Name + Ziffern');
  assert.ok(passwortZuEinfach('Kamau2026', { name: 'Peter Kamau' }), 'Name + Jahr');
  for (const pw of ['Kaffee-Regen-Tisch-7', 'Mombasa Hafen 1987', 'Passwort123!', 'geheim123', 'neues-passwort-1', 'x9#Lq2!vRt'])
    assert.ok(!passwortZuEinfach(pw, { email: 'leo@apo.at', name: 'Leo Gaspar' }), `abgelehnt: ${pw}`);
});

test('Über HTTP: Registrierung, Passwortwechsel und Zurücksetzen lehnen ab (übersetzter Code), gute werden angenommen', { timeout: 60000 }, async () => {
  const kind = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'pw-einfach-1', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus', APOPULSE_EXTERN_AUS: '1' },
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
    const post = async (p, body, tok) => { const r = await fetch(B + p, { method: 'POST', headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: JSON.stringify(body) }); return { s: r.status, d: await r.json() }; };
    const reg = (pw, email) => post('/api/register', { name: 'Amina Okafor', email, password: pw, country: 'NG', accountType: 'pharmacy' });
    const schwach = await reg('12345678', 'amina@pe.test');
    assert.equal(schwach.s, 400); assert.equal(schwach.d.code, 'pw_zu_einfach');
    assert.equal((await reg('aminaokafor1', 'amina@pe.test')).d.code, 'pw_zu_einfach', 'Name im Passwort');
    const gut = await reg('Lagos-Regen-Tisch-7', 'amina@pe.test');
    assert.equal(gut.s, 200);
    const wechsel = await post('/api/me/password', { oldPassword: 'Lagos-Regen-Tisch-7', newPassword: 'password1' }, gut.d.token);
    assert.equal(wechsel.s, 400); assert.equal(wechsel.d.code, 'pw_zu_einfach');
    // Zurücksetzen per Code: Prüfung vor der Kontosuche — gleiche Antwort für bekannte und unbekannte Adresse.
    const code = gut.d.recovery_codes[0];
    const r1 = await post('/api/password/reset', { email: 'amina@pe.test', code, newPassword: 'qwertyuiop' });
    const r2 = await post('/api/password/reset', { email: 'gibtsnicht@pe.test', code, newPassword: 'qwertyuiop' });
    assert.deepEqual([r1.s, r1.d.code], [400, 'pw_zu_einfach']); assert.deepEqual([r2.s, r2.d.code], [400, 'pw_zu_einfach']);
    assert.equal((await post('/api/password/reset', { email: 'amina@pe.test', code, newPassword: 'Abuja-Sonne-Brot-4' })).s, 200, 'Code nach Ablehnung noch gültig');
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});

test('Fehlertext in 5 Sprachen, mit Beispiel für ein gutes Passwort', () => {
  for (const sp of ['de', 'en', 'pt', 'fr', 'ar']) {
    const start = I18N.indexOf(`\n  ${sp}: {`);
    const blk = I18N.slice(start, I18N.indexOf('\n  },', start));
    assert.match(blk, /[\s,]e_pw_zu_einfach:'[^']{40,}'/, `e_pw_zu_einfach (${sp})`);
  }
});
