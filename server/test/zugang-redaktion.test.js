// Ausgesperrt ohne Code und ohne E-Mail-Versand: Die Hilfe-Seite sagt „schreiben Sie uns, wir helfen".
// Fund 11/2026: Die Redaktion hatte dafür KEIN Werkzeug — das Versprechen war leer.
// Jetzt: Redaktion erstellt einen Einmal-Link (24 h) für die E-Mail-Adresse des Kontos. Grenzen:
// nur Redaktion; nie für Redaktionskonten (sonst Übernahme eines Redaktionskontos durch eine
// andere Redaktionsperson); die Kontoinhaberin wird in der Glocke informiert; Link nur einmal.
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

test('Redaktion stellt einen Einmal-Link für ein ausgesperrtes Konto aus', { timeout: 60000 }, async () => {
  const kind = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'zugang-test-1', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus',
      APOPULSE_ADMIN_EMAIL: 'red@zugang.test', APOPULSE_ADMIN_PASSWORD: 'zugang-test-PW-1', APOPULSE_PUBLIC_URL: 'https://www.apopulse.com',
      RESEND_API_KEY: '', POSTMARK_API_TOKEN: '' },
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
    const get = async (pfad, tok) => (await fetch(B + pfad, { headers: { authorization: 'Bearer ' + tok } })).json();
    const red = (await post('/api/login', '', { email: 'red@zugang.test', password: 'zugang-test-PW-1' })).d.token;
    const mona = (await post('/api/register', '', { name: 'Mona', email: 'Mona@Apo.KE', password: 'altes-Passwort-1', country: 'KE', accountType: 'pharmacy' })).d.token;
    const awa = (await post('/api/register', '', { name: 'Awa', email: 'awa@pharma.sn', password: 'Passwort-Awa-1', country: 'SN', locale: 'fr', accountType: 'pharmacy' })).d.token;
    assert.ok(awa);
    assert.ok(red && mona);

    // Nur Redaktion.
    assert.equal((await post('/api/mod/zugang-link', mona, { email: 'red@zugang.test' })).status, 403);
    assert.equal((await post('/api/mod/zugang-link', '', { email: 'mona@apo.ke' })).status, 401);
    // Nie für Redaktionskonten.
    const r0 = await post('/api/mod/zugang-link', red, { email: 'red@zugang.test' });
    assert.equal(r0.status, 403); assert.equal(r0.d.code, 'zugang_redaktion');
    // Unbekannte Adresse: klar gesagt (nur die Redaktion sieht das).
    assert.equal((await post('/api/mod/zugang-link', red, { email: 'niemand@apo.ke' })).d.code, 'konto_unbekannt');

    const t0 = Date.now();
    const r = await post('/api/mod/zugang-link', red, { email: ' mona@apo.ke ' });
    assert.equal(r.status, 200, JSON.stringify(r.d));
    assert.equal(r.d.email, 'mona@apo.ke', 'Link geht an die Adresse DES KONTOS');
    assert.match(r.d.link, /^https:\/\/www\.apopulse\.com\/\?pwlink=[^&\s]+$/, 'feste Adresse, nicht der Host-Kopf');
    const stunden = (Date.parse(r.d.gueltig_bis) - t0) / 3_600_000;
    assert.ok(stunden > 23.9 && stunden < 24.1, `gültig ${stunden} h`);

    // Mail-Vorlage in der Sprache DES KONTOS, nicht der Redaktion (Rundgang: Awa aus Senegal bekam Deutsch).
    const fr = (await post('/api/mod/zugang-link', red, { email: 'awa@pharma.sn' })).d;
    assert.equal(fr.sprache, 'fr');
    assert.match(fr.mail.betreff, /mot de passe/);
    assert.match(fr.mail.text, /24 heures/); assert.ok(fr.mail.text.includes(fr.link), 'Link fehlt in der Mail');
    assert.doesNotMatch(fr.mail.text, /60 minutes|Passwort/);
    // Kontoinhaberin erfährt es (auch wenn sie es nicht war).
    const glocke = (await get('/api/notifications', mona)).notifications;
    assert.ok(glocke.some((n) => n.type === 'zugang_link'), 'Kontoinhaberin nicht informiert');

    // Einlösen: neues Passwort, angemeldet; zweites Mal ungültig; altes Passwort tot.
    const tok = new URL(r.d.link).searchParams.get('pwlink');
    const ein = await post('/api/password/reset-mit-link', '', { t: tok, newPassword: 'neues-Passwort-2' });
    assert.equal(ein.status, 200, JSON.stringify(ein.d)); assert.ok(ein.d.token);
    assert.equal((await post('/api/password/reset-mit-link', '', { t: tok, newPassword: 'drittes-Passwort-3' })).d.code, 'pwlink_invalid');
    assert.equal((await post('/api/login', '', { email: 'mona@apo.ke', password: 'altes-Passwort-1' })).status, 401);
    assert.equal((await post('/api/login', '', { email: 'mona@apo.ke', password: 'neues-Passwort-2' })).status, 200);
    assert.ok(!/pwlink=/.test(log), 'Link landet im Server-Log');
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});

test('Prüfliste: Karte „Zugang wiederherstellen", Link nur an die Konto-Adresse, 5 Sprachen', () => {
  assert.match(APP, /zugangKarte\(ueberblick\)/, 'Karte fehlt in der Prüfliste');
  const f = APP.slice(APP.indexOf('function zugangKarte('), APP.indexOf('function zugangKarte(') + 4000);
  assert.match(f, /api\('POST', '\/api\/mod\/zugang-link'/);
  assert.match(f, /mailto:\$\{encodeURIComponent\(r\.email\)\}\?subject=\$\{encodeURIComponent\(r\.mail\.betreff\)\}&body=\$\{encodeURIComponent\(r\.mail\.text\)\}/, 'Mail nicht an die Konto-Adresse / nicht in der Sprache des Kontos');
  assert.match(APP, /n\.type === 'zugang_link'/, 'Glocke: Systemmeldung ohne „Jemand"');
  for (const sp of ['de', 'en', 'pt', 'fr', 'ar']) {
    const start = I18N.indexOf(`\n  ${sp}: {`);
    const blk = I18N.slice(start, I18N.indexOf('\n  },', start));
    for (const k of ['zl_titel', 'zl_text', 'zl_email', 'zl_knopf', 'zl_hinweis', 'zl_gueltig', 'nv_zugang_link']) assert.match(blk, new RegExp(`[\\s,]${k}:`), `${k} fehlt (${sp})`);
  }
});
