// Passwort vergessen → Link per E-Mail (services/passwortLink.js). Geprüft wird,
// was ein Angreifer ausnutzen würde: Verrät die Anfrage, ob es ein Konto gibt?
// Taugt ein Link zweimal, nach Ablauf, oder ein anderes Zweck-Token als Link?
// Zeigt der Link auf eine fremde Adresse? Und: Kommt man danach direkt hinein?
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SECRET = 'passwort-link-test-geheim-1';
process.env.APOPULSE_TOKEN_SECRET = SECRET; // vor dem Import: token.js liest es beim Laden
const { issueZweckToken, verifyZweckToken, issueToken } = await import('../src/http/token.js');
const { createPasswortLink, rendereLinkMail, MAIL_SPRACHEN, GUELTIG_MINUTEN } = await import('../src/services/passwortLink.js');
const { hashPassword, verifyPassword } = await import('../src/domain/password.js');
const { SUPPORTED_LOCALES } = await import('../src/data/countries.js');

const HIER = dirname(fileURLToPath(import.meta.url));

function aufbau({ aktiv = true, uhr = { t: 1_800_000_000_000 } } = {}) {
  const nutzer = { id: 'u1', email: 'mona@apotheke.eg', name: 'Mona <b>', status: 'active', password_hash: hashPassword('altes-passwort') };
  const repo = {
    getUserByEmail: (e) => (String(e).toLowerCase() === nutzer.email ? nutzer : null),
    getUserById: (id) => (id === nutzer.id ? nutzer : null),
    setUserPassword: (id, h) => { nutzer.password_hash = h; },
  };
  const post = [];
  const mailer = { aktiv, sende: async (m) => { post.push(m); return true; } };
  const pl = createPasswortLink({
    repo, mailer, hashPassword, jetzt: () => uhr.t, log: { warn() {} },
    ausstellen: (x) => issueZweckToken('pw_reset', x), pruefen: (x) => verifyZweckToken('pw_reset', x),
    basis: 'https://www.apopulse.com',
  });
  return { pl, post, nutzer, uhr };
}
const warte = () => new Promise((r) => setImmediate(r));
const tokenAus = (mail) => decodeURIComponent(mail.text.match(/\?pwlink=([^\s]+)/)[1]);

test('Anfrage verrät nichts: gleiche Antwort mit und ohne Konto, Mail nur ans echte Konto', async () => {
  const { pl, post } = aufbau();
  assert.deepEqual(pl.anfordern({ email: 'niemand@x.org', sprache: 'de' }), { ok: true });
  assert.deepEqual(pl.anfordern({ email: ' MONA@apotheke.eg ', sprache: 'ar' }), { ok: true });
  await warte();
  assert.equal(post.length, 1);
  assert.equal(post[0].an, 'mona@apotheke.eg');
  assert.match(post[0].text, /^https:\/\/www\.apopulse\.com\/\?pwlink=/m, 'feste Adresse, nie der Host-Kopf');
  assert.match(post[0].html, /dir="rtl"/);
  assert.match(post[0].html, /Mona &lt;b&gt;/, 'Name escaped');
  assert.doesNotMatch(post[0].html, /<b>/);
});

test('Link setzt das Passwort genau einmal; danach verbraucht', async () => {
  const { pl, post, nutzer } = aufbau();
  pl.anfordern({ email: nutzer.email, sprache: 'fr' }); await warte();
  const t = tokenAus(post[0]);
  assert.throws(() => pl.einloesen({ t, newPassword: 'kurz' }), { code: 'new_pw_short' });
  assert.deepEqual(pl.einloesen({ t, newPassword: 'neues-passwort-1' }), { userId: 'u1' });
  assert.ok(verifyPassword('neues-passwort-1', nutzer.password_hash));
  assert.throws(() => pl.einloesen({ t, newPassword: 'noch-ein-passwort' }), { code: 'pwlink_invalid' }, 'zweites Mal');
  assert.ok(verifyPassword('neues-passwort-1', nutzer.password_hash));
});

test(`Ablauf nach ${GUELTIG_MINUTEN} Minuten; fremde Token taugen nicht`, async () => {
  const { pl, post, nutzer, uhr } = aufbau();
  pl.anfordern({ email: nutzer.email }); await warte();
  const t = tokenAus(post[0]);
  uhr.t += GUELTIG_MINUTEN * 60_000 + 1;
  assert.throws(() => pl.einloesen({ t, newPassword: 'neues-passwort-1' }), { code: 'pwlink_expired' });
  const inhalt = t.split('.')[0];
  for (const fremd of [issueToken('u1'), issueZweckToken('wb_abmelden', Buffer.from(inhalt, 'base64url').toString()), '', 'x.y', t + 'x']) {
    assert.throws(() => pl.einloesen({ t: fremd, newPassword: 'neues-passwort-1' }), { code: 'pwlink_invalid' }, fremd);
  }
  assert.ok(verifyPassword('altes-passwort', nutzer.password_hash), 'nichts geändert');
});

test('Ohne E-Mail-Versand: ehrlich aus, kein stilles Nichts', () => {
  const { pl } = aufbau({ aktiv: false });
  assert.equal(pl.aktiv, false);
  assert.throws(() => pl.anfordern({ email: 'mona@apotheke.eg' }), { code: 'mail_aus', status: 503 });
});

test('Mail in allen App-Sprachen, unbekannte Sprache → Englisch', () => {
  assert.deepEqual([...MAIL_SPRACHEN].sort(), [...SUPPORTED_LOCALES].sort());
  const texte = new Set(SUPPORTED_LOCALES.map((sp) => rendereLinkMail({ sprache: sp, name: 'A', link: 'https://x/?pwlink=1' }).betreff));
  assert.equal(texte.size, SUPPORTED_LOCALES.length);
  assert.equal(rendereLinkMail({ sprache: 'xx', name: '', link: 'l' }).betreff, rendereLinkMail({ sprache: 'en', name: '', link: 'l' }).betreff);
});

test('Oberfläche: Link zuerst (nur wenn aktiv), Code als zweiter Weg; ?pwlink= vor allem anderen und aus der Adresse entfernt', () => {
  const app = readFileSync(join(HIER, '..', 'public', 'app.js'), 'utf8');
  const rs = app.slice(app.indexOf('async function resetScreen('), app.indexOf('function pwLinkScreen('));
  assert.match(rs, /\.passwort_link/);
  assert.match(rs, /\$\{mitLink \? `<form id="rs_link_form"/);
  assert.match(rs, /<details[^>]*><summary[^>]*>\$\{esc\(t\('rs_code_toggle'\)\)\}<\/summary>\$\{codeForm\}<\/details>` : codeForm\}/);
  assert.match(rs, /'\/api\/password\/reset-link', \{ email: v\('rs_l_email'\), sprache: LOCALE \}/);
  const pl = app.slice(app.indexOf('function pwLinkScreen('), app.indexOf('function nimmPwLink('));
  assert.match(pl, /afterAuth\(await api\('POST', '\/api\/password\/reset-mit-link'/);
  assert.match(pl, /applyI18n\(\)/, 'direkt aus der E-Mail: Kopf sonst auf Deutsch');
  assert.match(app, /function nimmPwLink\(\) \{[\s\S]{0,200}history\.replaceState\(null, '', location\.pathname\)/);
  const start = app.slice(app.lastIndexOf('const _hasCountry'));
  assert.ok(start.indexOf('nimmPwLink()') > 0 && start.indexOf('nimmPwLink()') < start.indexOf("localStorage.getItem('apo_token')"), 'Link vor dem normalen Start');
});

test('HTTP: Schalter sichtbar, ohne Mail 503, falsche/abgelaufene Links abgelehnt, Sitzungs-Token taugt nicht', { timeout: 60000 }, async () => {
  const env = { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: SECRET, APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus', APOPULSE_MAIL_PROVIDER: '' };
  const kind = spawn(process.execPath, [join(HIER, '..', 'src', 'http', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const port = await new Promise((ok, fehler) => {
      let l = ''; const z = setTimeout(() => fehler(new Error('Server startet nicht')), 30000);
      kind.stdout.on('data', (d) => { l += d; const m = l.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(z); ok(m[1]); } });
    });
    const req = (method, pfad, body) => new Promise((ok, fehler) => {
      const r = http.request({ host: 'localhost', port, path: pfad, method, headers: { 'content-type': 'application/json' } }, (res) => {
        let b = ''; res.on('data', (d) => { b += d; }); res.on('end', () => ok({ status: res.statusCode, json: JSON.parse(b || '{}') }));
      });
      r.on('error', fehler); if (body) r.write(JSON.stringify(body)); r.end();
    });
    assert.equal((await req('GET', '/api/auth/providers')).json.passwort_link, false);
    const aus = await req('POST', '/api/password/reset-link', { email: 'a@b.cd' });
    assert.equal(aus.status, 503); assert.equal(aus.json.code, 'mail_aus');
    const reg = await req('POST', '/api/register', { name: 'Test Link', email: 'link@test.eg', password: 'altes-passwort', country: 'EG' });
    const uid = reg.json.user.id;
    const morgen = Date.now() + 3600_000;
    const falsch = await req('POST', '/api/password/reset-mit-link', { t: issueZweckToken('pw_reset', `${uid}|${morgen}|falscherFP000000`), newPassword: 'neues-passwort-1' });
    assert.equal(falsch.status, 400); assert.equal(falsch.json.code, 'pwlink_invalid');
    const alt = await req('POST', '/api/password/reset-mit-link', { t: issueZweckToken('pw_reset', `${uid}|${Date.now() - 1}|x`), newPassword: 'neues-passwort-1' });
    assert.equal(alt.json.code, 'pwlink_expired');
    // Gleiches Format, aber mit dem Schlüssel des Abmelde-Links signiert: Der Server darf die
    // Signatur nicht akzeptieren — sonst käme „abgelaufen" statt „ungültig".
    const fremd = await req('POST', '/api/password/reset-mit-link', { t: issueZweckToken('wb_abmelden', `${uid}|${Date.now() - 1}|x`), newPassword: 'neues-passwort-1' });
    assert.equal(fremd.json.code, 'pwlink_invalid');
    const sitzung = await req('POST', '/api/password/reset-mit-link', { t: reg.json.token, newPassword: 'neues-passwort-1' });
    assert.equal(sitzung.json.code, 'pwlink_invalid');
    const login = await req('POST', '/api/login', { email: 'link@test.eg', password: 'altes-passwort' });
    assert.equal(login.status, 200, 'altes Passwort gilt weiter');
  } finally { kind.kill(); }
});
