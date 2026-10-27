// Start-Tag: viele neue Konten gleichzeitig, und Missbrauch des Melde-Formulars.
// - Passwort-/Code-Hashes laufen im Hintergrund-Thread: Wer nur liest, wartet nicht,
//   während andere sich registrieren (vorher: 60 Registrierungen → bis zu 20 s Wartezeit).
// - Wiederherstellungscodes: leichterer Hash (zufällige Codes), alte Hashes gelten weiter.
// - Je Konto höchstens MAX_NEUE_MELDUNGEN_TAG neue Engpass-Meldungen am Tag.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword, verifyPassword, hashPasswordAsync, verifyPasswordAsync } from '../src/domain/password.js';
import { generateRecoveryCodes, generateRecoveryCodesAsync, matchRecoveryCode, normalizeCode } from '../src/domain/recoveryCodes.js';
import { MAX_NEUE_MELDUNGEN_TAG } from '../src/services/shortages.js';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'http', 'server.js');

test('Passwort: Hintergrund-Variante erzeugt dieselben Hashes wie bisher (beide Richtungen prüfbar)', async () => {
  const a = await hashPasswordAsync('Passwort123!');
  assert.match(a, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.ok(verifyPassword('Passwort123!', a));
  assert.ok(await verifyPasswordAsync('Passwort123!', hashPassword('Passwort123!')));
  assert.equal(await verifyPasswordAsync('falsch-falsch', a), false);
  assert.equal(await verifyPasswordAsync('x', 'kaputt'), false);
  await assert.rejects(() => hashPasswordAsync('kurz'), { code: 'pw_too_short' });
});

test('Wiederherstellungscodes: neuer Hash rc$…, alte scrypt$-Hashes bleiben gültig', async () => {
  const { codes, hashes } = generateRecoveryCodes();
  assert.equal(codes.length, 8);
  for (const h of hashes) assert.match(h, /^rc\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
  assert.equal(matchRecoveryCode(codes[5].toLowerCase().replace('-', ' '), hashes), 5);
  assert.equal(matchRecoveryCode('AAAAA-AAAAA', hashes), -1);
  const neu = await generateRecoveryCodesAsync();
  assert.equal(matchRecoveryCode(neu.codes[0], neu.hashes), 0);
  // Konten von vor der Umstellung: Hash mit vollen Passwort-Kosten.
  const alt = hashPassword(normalizeCode('ABCDE-23456'));
  assert.equal(matchRecoveryCode('abcde-23456', [neu.hashes[0], alt]), 1);
  // Kaputte Einträge stören nicht.
  assert.equal(matchRecoveryCode(neu.codes[1], ['rc$00$00', 'quatsch', null, neu.hashes[1]]), 3);
  // Der Code-Hash ist günstiger als der Passwort-Hash (sonst blockiert die Registrierung wieder).
  const t0 = process.hrtime.bigint(); for (let i = 0; i < 8; i++) generateRecoveryCodes(1); const codeZeit = Number(process.hrtime.bigint() - t0);
  const t1 = process.hrtime.bigint(); for (let i = 0; i < 8; i++) hashPassword('Passwort123!'); const pwZeit = Number(process.hrtime.bigint() - t1);
  assert.ok(codeZeit * 3 < pwZeit, `Code-Hash nicht deutlich günstiger: ${codeZeit} vs ${pwZeit} ns`);
});

test('HTTP: Ansturm von Registrierungen hält Lesende nicht auf; Meldungen je Konto und Tag begrenzt', { timeout: 120000 }, async () => {
  const kind = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'ansturm-test-' + crypto.randomBytes(4).toString('hex'), APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus',
      APOPULSE_ADMIN_EMAIL: 'red@ansturm.test', APOPULSE_ADMIN_PASSWORD: 'ansturm-PW-4711' },
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
    const H = (t) => ({ 'content-type': 'application/json', ...(t ? { authorization: 'Bearer ' + t } : {}) });
    const post = async (p, b, t) => { const r = await fetch(B + p, { method: 'POST', headers: H(t), body: JSON.stringify(b) }); return { status: r.status, json: await r.json().catch(() => ({})) }; };
    const konto = (name, email, country = 'NG') => post('/api/register', { name, email, password: 'Passwort123!', country, accountType: 'pharmacy' });

    // 1) Ansturm: 40 Registrierungen gleichzeitig, eine Leserin ruft dabei laufend die Liste ab.
    const leserin = (await konto('Leserin', 'leserin@ansturm.test')).json.token;
    const zeiten = []; let laeuft = true;
    const messen = (async () => {
      while (laeuft) { const t0 = Date.now(); await fetch(B + '/api/shortages?country=NG', { headers: H(leserin) }); zeiten.push(Date.now() - t0); await new Promise((r) => setTimeout(r, 20)); }
    })();
    await new Promise((r) => setTimeout(r, 60));
    const erg = await Promise.all(Array.from({ length: 40 }, (_, i) => konto('Apo ' + i, `apo${i}@ansturm.test`)));
    laeuft = false; await messen;
    assert.deepEqual([...new Set(erg.map((e) => e.status))], [200]);
    assert.ok(erg.every((e) => e.json.recovery_codes.length === 8));
    // Synchron gerechnet (vorher) stand der Server für 40 Konten ~20 s still; die Leserin wartete Sekunden.
    assert.ok(Math.max(...zeiten) < 2000, `Leserin wartete ${Math.max(...zeiten)} ms während des Ansturms`);

    // Dieselbe Adresse zweimal gleichzeitig (Doppelklick): genau ein Konto.
    const doppelt = await Promise.all([konto('Ama', 'ama@ansturm.test'), konto('Ama', 'ama@ansturm.test')]);
    assert.equal(doppelt.filter((d) => d.status === 200).length, 1, 'zwei Konten mit derselben Adresse');
    assert.equal(doppelt.find((d) => d.status !== 200).json.code, 'email_taken');

    // Zwei Personen wollen gleichzeitig denselben Handle: eine bekommt ihn, die andere eine klare
    // Meldung — und ihre Adresse bleibt frei (kein halbes Konto ohne Profil).
    const handle = await Promise.all(['kofi@ansturm.test', 'kwame@ansturm.test'].map((email) => post('/api/register', { name: 'K', email, password: 'Passwort123!', country: 'GH', accountType: 'pharmacy', handle: 'apotheke_accra' })));
    assert.equal(handle.filter((d) => d.status === 200).length, 1);
    const verlierer = handle.find((d) => d.status !== 200);
    assert.equal(verlierer.json.code, 'handle_taken');
    const zweiterVersuch = await post('/api/register', { name: 'K', email: handle[0].status === 200 ? 'kwame@ansturm.test' : 'kofi@ansturm.test', password: 'Passwort123!', country: 'GH', accountType: 'pharmacy' });
    assert.equal(zweiterVersuch.status, 200, 'Adresse nach gescheitertem Handle blockiert: ' + JSON.stringify(zweiterVersuch.json));

    // Anmelden (Hintergrund-Vergleich) und Code aus der Registrierung einlösen (neuer Code-Hash).
    assert.equal((await post('/api/login', { email: 'apo3@ansturm.test', password: 'Passwort123!' })).status, 200);
    assert.equal((await post('/api/login', { email: 'apo3@ansturm.test', password: 'falsch-falsch' })).status, 401);
    const reset = await post('/api/password/reset', { email: 'apo3@ansturm.test', code: erg[3].json.recovery_codes[2], newPassword: 'Neues-Passwort-1' });
    assert.equal(reset.status, 200, JSON.stringify(reset.json));
    assert.equal(reset.json.remaining_codes, 7);
    assert.equal((await post('/api/login', { email: 'apo3@ansturm.test', password: 'Neues-Passwort-1' })).status, 200);

    // 2) Melde-Spam: ein Konto, viele erfundene Wirkstoffe — nach MAX_NEUE_MELDUNGEN_TAG ist Schluss.
    const spam = erg[0].json.token;
    const WOERTER = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliett', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa', 'quebec', 'romeo', 'sierra', 'tango', 'uniform'];
    const name = (i) => 'Fake' + WOERTER[i];
    for (let i = 0; i < MAX_NEUE_MELDUNGEN_TAG; i++) assert.equal((await post('/api/shortages/report', { wirkstoff: name(i), status: 'kritisch' }, spam)).status, 200, 'Meldung ' + (i + 1));
    const zuviel = await post('/api/shortages/report', { wirkstoff: name(20), status: 'kritisch' }, spam);
    assert.equal(zuviel.status, 429);
    assert.equal(zuviel.json.code, 'meldungen_tageslimit');
    const liste = await (await fetch(B + '/api/shortages?country=NG', { headers: H(leserin) })).json();
    assert.equal(JSON.stringify(liste).match(/"wirkstoff":"Fake[a-z]+"/g).length >= MAX_NEUE_MELDUNGEN_TAG, true);
    assert.ok(!JSON.stringify(liste).includes(name(20)));
    // Bestätigen zählt nicht: Eine andere Apotheke meldet, das Spam-Konto kann weiter „Auch bei uns" sagen —
    // auch über das Formular (gleicher Wirkstoff → wird zur Bestätigung).
    assert.equal((await post('/api/shortages/report', { wirkstoff: 'Metformin', status: 'kritisch' }, erg[1].json.token)).status, 200);
    const best = await post('/api/shortages/report', { wirkstoff: 'Metformin', status: 'kritisch' }, spam);
    assert.equal(best.status, 200, JSON.stringify(best.json));
    assert.equal(best.json.zusammengefuehrt, true);
    // Andere Konten sind nicht betroffen.
    assert.equal((await post('/api/shortages/report', { wirkstoff: 'Amoxicillin', status: 'kritisch' }, erg[2].json.token)).status, 200);
    // Die Redaktion (Moderation) ist ausgenommen — sie trägt z. B. Behördenlisten von Hand nach.
    const red = (await post('/api/login', { email: 'red@ansturm.test', password: 'ansturm-PW-4711' })).json.token;
    for (let i = 0; i <= MAX_NEUE_MELDUNGEN_TAG; i++) {
      const r = await post('/api/shortages/report', { wirkstoff: 'Redaktion' + WOERTER[i], status: 'eingeschraenkt' }, red);
      assert.equal(r.status, 200, 'Redaktion gebremst: ' + JSON.stringify(r.json));
    }
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});

test('Oberfläche: verständliche Meldung in allen Sprachen; Eingabe bleibt gespeichert', async () => {
  const { readFileSync } = await import('node:fs');
  const i18n = readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8');
  assert.equal((i18n.match(/e_meldungen_tageslimit:/g) || []).length, 5);
  assert.equal((i18n.match(/e_sms_ausgelastet:/g) || []).length, 5);
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const senden = app.slice(app.indexOf("card.querySelector('[data-send]').onclick"), app.indexOf("card.querySelector('[data-send]').onclick") + 3000);
  // Nur nach Erfolg wird der Entwurf gelöscht — bei der Tagesgrenze bleibt er für morgen.
  assert.ok(senden.indexOf('entwurfLoeschen()') < senden.indexOf('catch(e)'));
  assert.ok(!senden.slice(senden.indexOf('catch(e)')).includes('entwurfLoeschen()'));
});
