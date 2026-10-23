// Anmelden mit Telefonnummer + SMS-Code (10/2026). Geprüft wird, was Geld oder
// Konten kostet: Nummern-Normalform (eine Nummer = ein Konto), Code nur einmal und
// nur kurz, Sperre nach Fehlversuchen, Bremsen gegen SMS-Kosten, keine Übernahme
// über die Platzhalter-Adresse — und der ganze Ablauf über HTTP mit einem lokalen
// Schein-Anbieter, der die SMS auffängt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalisiereTelefon, VORWAHL } from '../src/domain/telefon.js';
import { createSms } from '../src/services/sms.js';
import { createTelefonLogin, telefonAdresse, MAX_VERSUCHE, SMS_SPRACHEN } from '../src/services/telefonLogin.js';
import { COUNTRIES, SUPPORTED_LOCALES } from '../src/data/countries.js';

const HIER = dirname(fileURLToPath(import.meta.url));

test('Nummern: so wie sie auf der Visitenkarte stehen → eine Normalform', () => {
  assert.equal(normalisiereTelefon('0772 123 456', 'UG'), '+256772123456');
  assert.equal(normalisiereTelefon('77 123 45 67', 'SN'), '+221771234567');
  assert.equal(normalisiereTelefon('07 07 12 34 56', 'CI'), '+2250707123456', 'Côte d’Ivoire: 0 gehört seit 2021 zur Nummer');
  assert.equal(normalisiereTelefon('+254 712-345-678', 'UG'), '+254712345678', 'international schlägt Land');
  assert.equal(normalisiereTelefon('0049 151 1234567', 'AT'), '+491511234567');
  assert.equal(normalisiereTelefon('(0) 803 123 4567', 'NG'), '+2348031234567');
  for (const falsch of ['', 'abc', '123', '+0123456789', '1'.repeat(41)]) assert.equal(normalisiereTelefon(falsch, 'KE'), null, falsch);
  assert.equal(normalisiereTelefon('0772123456', 'XX'), null, 'unbekanntes Land ohne +');
  for (const cc of Object.keys(COUNTRIES)) assert.ok(VORWAHL[cc], `Vorwahl fehlt: ${cc}`);
});

test('SMS-Dienst: aus ohne Zugangsdaten; Africa\'s Talking und Twilio richtig angesprochen', async () => {
  assert.deepEqual([createSms({ env: {} }).aktiv, createSms({ env: {} }).grund], [false, 'kein_anbieter']);
  assert.equal(createSms({ env: { APOPULSE_SMS_PROVIDER: 'twilio', APOPULSE_SMS_USERNAME: 'AC1', APOPULSE_SMS_API_KEY: 'k' } }).grund, 'kein_absender');
  const aufrufe = [];
  const fake = (antwort) => async (url, o) => { aufrufe.push({ url, o }); return antwort; };
  const at = createSms({ env: { APOPULSE_SMS_PROVIDER: 'africastalking', APOPULSE_SMS_USERNAME: 'sandbox', APOPULSE_SMS_API_KEY: 'geheim' },
    fetchImpl: fake({ ok: true, status: 201, json: async () => ({ SMSMessageData: { Recipients: [{ statusCode: 101 }] } }) }) });
  assert.equal(await at.sende({ an: '+256772123456', text: 'Code 123456' }), true);
  assert.equal(aufrufe[0].url, 'https://api.sandbox.africastalking.com/version1/messaging');
  assert.equal(aufrufe[0].o.headers.apiKey, 'geheim');
  assert.equal(new URLSearchParams(aufrufe[0].o.body).get('to'), '+256772123456');
  const abgelehnt = createSms({ env: { APOPULSE_SMS_PROVIDER: 'africastalking', APOPULSE_SMS_USERNAME: 'app', APOPULSE_SMS_API_KEY: 'k' },
    fetchImpl: fake({ ok: true, status: 201, json: async () => ({ SMSMessageData: { Recipients: [{ statusCode: 403, status: 'InvalidPhoneNumber' }] } }) }) });
  await assert.rejects(() => abgelehnt.sende({ an: '+256772123456', text: 'x' }), /abgelehnt/);
  const tw = createSms({ env: { APOPULSE_SMS_PROVIDER: 'twilio', APOPULSE_SMS_USERNAME: 'AC9', APOPULSE_SMS_API_KEY: 'tok', APOPULSE_SMS_FROM: '+15550001' }, fetchImpl: fake({ ok: true, status: 201 }) });
  await tw.sende({ an: '+221771234567', text: 'x' });
  const z = aufrufe.at(-1);
  assert.equal(z.url, 'https://api.twilio.com/2010-04-01/Accounts/AC9/Messages.json');
  assert.equal(z.o.headers.authorization, 'Basic ' + Buffer.from('AC9:tok').toString('base64'));
  assert.equal(new URLSearchParams(z.o.body).get('From'), '+15550001');
  await assert.rejects(() => tw.sende({ an: '0772', text: 'x' }), /ungültige/);
});

function aufbau({ smsAktiv = true, smsFehler = false } = {}) {
  const uhr = { t: 1_800_000_000_000 };
  const gesendet = [];
  const sms = { aktiv: smsAktiv, sende: async (m) => { if (smsFehler) throw new Error('netz'); gesendet.push(m); return true; } };
  const konten = new Map();
  const repo = { getUserByEmail: (e) => konten.get(e) || null };
  const tickets = new Map(); let n = 0;
  const tl = createTelefonLogin({ sms, repo, jetzt: () => uhr.t, zufall: () => 4242,
    ausstellen: (x) => { const k = 'T' + (++n); tickets.set(k, x); return k; }, pruefen: (k) => tickets.get(k) || null });
  return { tl, gesendet, konten, uhr };
}

test('Code: 6 Ziffern, nur einmal, 10 Minuten, nach 5 Fehlversuchen verbrannt', async () => {
  const { tl, gesendet, konten, uhr } = aufbau();
  const r = await tl.anfordern({ telefon: '0772 123 456', land: 'UG', sprache: 'fr' });
  assert.deepEqual(r, { ok: true, nummer: '+256772123456' });
  assert.match(gesendet[0].text, /^Code ApoPulse : 004242\./);
  for (let i = 1; i < MAX_VERSUCHE; i++) assert.throws(() => tl.pruefen({ telefon: '+256772123456', code: '000000' }), { code: 'tel_code_falsch' });
  assert.throws(() => tl.pruefen({ telefon: '+256772123456', code: '000000' }), { code: 'tel_code_gesperrt' });
  assert.throws(() => tl.pruefen({ telefon: '+256772123456', code: '004242' }), { code: 'tel_code_abgelaufen' }, 'nach Sperre auch der richtige Code nicht mehr');
  await tl.anfordern({ telefon: '+256772123456', sprache: 'en' });
  const neu = tl.pruefen({ telefon: '0772123456', land: 'UG', code: '004 242' });
  assert.equal(neu.neu, true);
  assert.equal(tl.ticketNummer(neu.ticket), '+256772123456');
  assert.throws(() => tl.pruefen({ telefon: '+256772123456', code: '004242' }), { code: 'tel_code_abgelaufen' }, 'nur einmal');
  konten.set(telefonAdresse('+256772123456'), { id: 'u7', status: 'active' });
  await tl.anfordern({ telefon: '+256772123456' });
  assert.deepEqual(tl.pruefen({ telefon: '+256772123456', code: '004242' }), { userId: 'u7' });
  await tl.anfordern({ telefon: '+256772123456' });
  uhr.t += 10 * 60_000 + 1;
  assert.throws(() => tl.pruefen({ telefon: '+256772123456', code: '004242' }), { code: 'tel_code_abgelaufen' });
  uhr.t += 6 * 60_000;
  assert.throws(() => tl.ticketNummer(neu.ticket), { code: 'tel_ticket' }, 'Ticket nach 15 Minuten ungültig');
});

test('Ohne Anbieter aus; scheiternde SMS legt keinen Code an; SMS-Text in allen App-Sprachen', async () => {
  await assert.rejects(() => aufbau({ smsAktiv: false }).tl.anfordern({ telefon: '+256772123456' }), { code: 'sms_aus', status: 503 });
  const f = aufbau({ smsFehler: true });
  await assert.rejects(() => f.tl.anfordern({ telefon: '+256772123456' }), { code: 'sms_fehler' });
  assert.throws(() => f.tl.pruefen({ telefon: '+256772123456', code: '004242' }), { code: 'tel_code_abgelaufen' });
  await assert.rejects(() => aufbau().tl.anfordern({ telefon: '12', land: 'UG' }), { code: 'tel_ungueltig' });
  assert.deepEqual([...SMS_SPRACHEN].sort(), [...SUPPORTED_LOCALES].sort());
});

test('Oberfläche: Knopf nur mit SMS-Anbieter, Code-Feld mit Autofill aus der SMS', () => {
  const app = readFileSync(join(HIER, '..', 'public', 'app.js'), 'utf8');
  const knopf = app.slice(app.indexOf('async function renderOAuthButtons('), app.indexOf('// OAuth-Rückleitung verarbeiten'));
  assert.match(knopf, /if \(d\.telefon\) \{[\s\S]*telefonScreen\(d\.vorwahlen \|\| \{\}\)/);
  const tel = app.slice(app.indexOf('function telefonScreen('), app.indexOf('// Einheitliches Redirect-Ziel für OAuth'));
  assert.match(tel, /autocomplete="one-time-code"/);
  assert.match(tel, /type="tel" inputmode="tel"/);
  assert.match(tel, /'\/api\/telefon\/code'[\s\S]*'\/api\/telefon\/pruefen'[\s\S]*'\/api\/telefon\/konto'/);
  assert.match(tel, /sessionStorage\.setItem\('apo_rc_neu'/, 'Codes-Karte wie bei der E-Mail-Registrierung');
});

test('HTTP: ganzer Ablauf mit Schein-Anbieter; Platzhalter-Adresse gesperrt; Bremse je Nummer', { timeout: 90000 }, async () => {
  const empfangen = [];
  const anbieter = http.createServer((req, res) => {
    let b = ''; req.on('data', (d) => { b += d; }); req.on('end', () => {
      empfangen.push({ kopf: req.headers, form: new URLSearchParams(b) });
      res.writeHead(201, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ SMSMessageData: { Recipients: [{ statusCode: 101 }] } }));
    });
  });
  await new Promise((ok) => anbieter.listen(0, ok));
  const env = { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'telefon-login-test-1', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus',
    APOPULSE_SMS_PROVIDER: 'africastalking', APOPULSE_SMS_USERNAME: 'sandbox', APOPULSE_SMS_API_KEY: 'test-schluessel',
    APOPULSE_SMS_URL: `http://localhost:${anbieter.address().port}/version1/messaging` };
  const kind = spawn(process.execPath, [join(HIER, '..', 'src', 'http', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const port = await new Promise((ok, fehler) => {
      let l = ''; const z = setTimeout(() => fehler(new Error('Server startet nicht')), 30000);
      kind.stdout.on('data', (d) => { l += d; const m = l.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(z); ok(m[1]); } });
    });
    const req = (method, pfad, body, token) => new Promise((ok, fehler) => {
      const r = http.request({ host: 'localhost', port, path: pfad, method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) } }, (res) => {
        let b = ''; res.on('data', (d) => { b += d; }); res.on('end', () => ok({ status: res.statusCode, json: JSON.parse(b || '{}') }));
      });
      r.on('error', fehler); if (body) r.write(JSON.stringify(body)); r.end();
    });
    const p = (await req('GET', '/api/auth/providers')).json;
    assert.equal(p.telefon, true); assert.equal(p.vorwahlen.SN, '221');
    const code = async (telefon, land = 'SN') => {
      const r = await req('POST', '/api/telefon/code', { telefon, land, sprache: 'fr' });
      assert.equal(r.status, 200, JSON.stringify(r.json));
      return (empfangen.at(-1).form.get('message').match(/\d{6}/) || [])[0];
    };
    const c1 = await code('77 123 45 67');
    assert.equal(empfangen[0].form.get('to'), '+221771234567');
    assert.equal(empfangen[0].kopf.apikey, 'test-schluessel');
    const falsch = await req('POST', '/api/telefon/pruefen', { telefon: '+221771234567', code: c1 === '000000' ? '111111' : '000000' });
    assert.equal(falsch.json.code, 'tel_code_falsch');
    const neu = (await req('POST', '/api/telefon/pruefen', { telefon: '+221771234567', code: c1 })).json;
    assert.equal(neu.neu, true);
    const konto = await req('POST', '/api/telefon/konto', { ticket: neu.ticket, name: 'Awa Diop', accountType: 'pharmacy', country: 'SN', locale: 'fr' });
    assert.equal(konto.status, 200, JSON.stringify(konto.json));
    assert.equal(konto.json.recovery_codes.length, 8);
    assert.equal(konto.json.profile.country, 'SN');
    assert.equal((await req('GET', '/api/me', null, konto.json.token)).status, 200);
    // Zweites Mal: dieselbe Nummer → dasselbe Konto, kein neues.
    const c2 = await code('+221 77 123 45 67');
    const wieder = (await req('POST', '/api/telefon/pruefen', { telefon: '0771234567', land: 'SN', code: c2 })).json;
    assert.equal(wieder.user.id, konto.json.user.id);
    assert.equal(wieder.user.password_hash, undefined, 'kein Hash in der Antwort');
    // Platzhalter-Adresse über das E-Mail-Formular besetzen: verboten.
    const besetzen = await req('POST', '/api/register', { name: 'X', email: telefonAdresse('+221770000000'), password: 'geheim1234' });
    assert.equal(besetzen.json.code, 'email_reserviert');
    // Bremse: dritte Anfrage für dieselbe Nummer in dieser Stunde ging noch (2 bisher) — die vierte nicht.
    await code('771234567');
    const zuviel = await req('POST', '/api/telefon/code', { telefon: '771234567', land: 'SN' });
    assert.equal(zuviel.status, 429);
    assert.equal(empfangen.length, 3, 'keine vierte SMS verschickt');
  } finally { kind.kill(); anbieter.close(); }
});

test('Platzhalter-Adressen: nie Post dorthin, angezeigt wird die Nummer', async () => {
  const { istPlatzhalterAdresse } = await import('../src/domain/adresse.js');
  const { createMailer } = await import('../src/services/mailer.js');
  assert.ok(istPlatzhalterAdresse(telefonAdresse('+221771234567')) && istPlatzhalterAdresse('google_1@oauth.local'));
  assert.ok(!istPlatzhalterAdresse('awa@pharmacie.sn'));
  let aufgerufen = false;
  const mailer = createMailer({ env: { APOPULSE_MAIL_PROVIDER: 'resend', APOPULSE_MAIL_API_KEY: 'k', APOPULSE_MAIL_FROM: 'A <a@b.cd>' }, fetchImpl: async () => { aufgerufen = true; return { ok: true }; } });
  await assert.rejects(() => mailer.sende({ an: telefonAdresse('+221771234567'), betreff: 'x', text: 'x' }), { code: 'keine_echte_adresse' });
  assert.equal(aufgerufen, false);
  const wb = readFileSync(join(HIER, '..', 'src', 'services', 'wochenbericht.js'), 'utf8');
  assert.match(wb, /if \(!u \|\| !u\.email \|\| istPlatzhalterAdresse\(u\.email\)\) \{ r\.uebersprungen\+\+; continue; \}/);
  const app = readFileSync(join(HIER, '..', 'public', 'app.js'), 'utf8');
  const f = app.slice(app.indexOf('function kontoAdresse('), app.indexOf('function nlabel('));
  const c = {}; vm.runInNewContext(f + ';this.k = kontoAdresse;', c);
  assert.deepEqual([c.k('tel_221771234567@telefon.local'), c.k('facebook_9@oauth.local'), c.k('a@b.cd')], ['+221771234567', '', 'a@b.cd']);
  assert.match(app, /\$\{esc\(kontoAdresse\(m\.email\)\)\}/, 'Team-Liste');
});
