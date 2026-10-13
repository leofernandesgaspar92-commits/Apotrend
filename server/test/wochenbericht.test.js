// Wochenbericht per E-Mail (services/wochenbericht.js, services/mailer.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChronik } from '../src/services/chronik.js';
import { createShortagesRepo } from '../src/repo/shortagesRepo.js';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createFruehwarnung } from '../src/services/fruehwarnung.js';
import { createWochenbericht, rendereWochenbericht, isoWoche, faellig } from '../src/services/wochenbericht.js';
import { createMailer } from '../src/services/mailer.js';
import { issueZweckToken, verifyZweckToken, issueToken, verifyToken } from '../src/http/token.js';
import { COUNTRIES } from '../src/data/countries.js';

const TAG = 86400000;
const z = (wirkstoff, country, o = {}) => ({ wirkstoff, bezeichnung: wirkstoff + ' 500 mg', status: 'kritisch', country, provenance: 'verified', quelle: country === 'US' ? 'FDA' : 'BASG', ...o });

function aufbau({ start = '2026-10-05T09:00:00Z', mailerOk = true } = {}) {
  let t = Date.parse(start);
  const jetzt = () => t;
  const chronik = createChronik({ jetzt, log: { warn() {} } });
  const sRepo = createShortagesRepo({ seed: false });
  const repo = createMemoryRepo();
  const profile = new Map();
  const social = { getProfile: (uid) => profile.get(uid) || null, pushNotification: () => null };
  const fw = createFruehwarnung({ chronik, shortagesRepo: sRepo, social, istPremium: () => true, heimatVon: (u) => profile.get(u)?.country });
  const post = [];
  const stoerung = { an: true };
  const mailer = { aktiv: mailerOk, grund: mailerOk ? null : 'kein_schluessel', sende: async (m) => { if (stoerung.an && m.an === 'kaputt@x.at') throw new Error('HTTP 500'); post.push(m); } };
  const premium = new Set();
  const wb = createWochenbericht({
    repo, social, chronik, fruehwarnung: fw, shortagesRepo: sRepo, mailer, laender: COUNTRIES,
    istPremium: (u) => premium.has(u), appUrl: 'https://www.apopulse.com', zweckToken: (u) => issueZweckToken('wb_abmelden', u), jetzt, log: { warn() {} },
  });
  const konto = (email, { land = 'AT', locale = 'de', name = 'Mag. Huber', prem = true } = {}) => {
    const u = repo.createUser({ email, name, passwordHash: 'x' });
    profile.set(u.id, { country: land, locale, display_name: name });
    if (prem) { repo.grantEntitlement(u.id, 'premium'); premium.add(u.id); }
    return u.id;
  };
  return { chronik, sRepo, repo, wb, post, konto, premium, stoerung, weiter: (d) => { t += d * TAG; }, setze: (iso) => { t = Date.parse(iso); } };
}

test('Kalenderwoche nach ISO 8601 und Fälligkeit ab Montag 05:00 UTC', () => {
  assert.equal(isoWoche(Date.parse('2026-10-12T12:00:00Z')).schluessel, '2026-W42');
  assert.equal(isoWoche(Date.parse('2027-01-03T12:00:00Z')).schluessel, '2026-W53', 'Sonntag gehört zur Woche seines Donnerstags');
  assert.equal(isoWoche(Date.parse('2027-01-04T12:00:00Z')).schluessel, '2027-W01');
  assert.equal(faellig(Date.parse('2026-10-12T04:59:00Z')), false);
  assert.equal(faellig(Date.parse('2026-10-12T05:00:00Z')), true);
  assert.equal(faellig(Date.parse('2026-10-15T01:00:00Z')), true, 'fiel der Montag aus, holt die Woche nach');
});

test('Inhalt: beobachtet, Frühwarnung, neu im Land — mit Quelle und Grundlage', () => {
  const a = aufbau();
  const uid = a.konto('huber@apo.at');
  a.sRepo.addWatch(uid, 'Amoxicillin');
  a.sRepo.addWatch(uid, 'Salbutamol');
  a.chronik.beobachte({ zeilen: [z('Rest', 'AT'), z('Rest', 'US')], laender: ['AT', 'US'] }); // erster Lauf
  a.weiter(2);
  a.chronik.beobachte({ zeilen: [z('Rest', 'AT'), z('Amoxicillin', 'AT'), z('Rest', 'US'), z('Albuterol Sulfate', 'US')], laender: ['AT', 'US'] });
  a.weiter(3);
  const v = a.wb.vorschau(uid);
  assert.match(v.betreff, /Wochenbericht Österreich · KW \d+: 1 neu, 1 Frühwarnung/);
  assert.match(v.text, /Amoxicillin: knapp seit 3 Tagen \(kritisch, BASG\)/);
  assert.match(v.text, /Salbutamol: derzeit nicht auf der Engpassliste · im Ausland knapp: Vereinigte Staaten \(3 Tage, FDA\)/, 'Ländername in der Sprache des Berichts');
  assert.match(v.text, /FRÜHWARNUNG AUS DEM AUSLAND/);
  assert.match(v.text, /keine Prognose/);
  assert.match(v.text, /Aufzeichnung seit 05\.10\.2026/);
  assert.match(v.text, /wb_abmelden=/);
  assert.ok(!/Rest/.test(v.text.split('NEU AUF DER ENGPASSLISTE')[1].split('Derzeit')[0]), 'Altfall vom ersten Lauf als „neu" gezählt');
});

test('ohne Behördendaten fürs Land: sagt es, statt „ruhig" zu melden', () => {
  const a = aufbau();
  const uid = a.konto('pt@apo.pt', { land: 'PT', locale: 'pt', name: 'Dra. Silva' });
  const v = a.wb.vorschau(uid);
  assert.match(v.text, /Ainda não há dados da autoridade para Portugal/);
  assert.match(v.betreff, /relatório semanal/);
  assert.ok(!/Sem novas entradas/.test(v.text), 'eine leere Woche ohne Daten sah aus wie eine ruhige');
});

test('HTML: Fremdinhalt aus Behördendaten wird escaped', () => {
  const html = rendereWochenbericht({
    locale: 'de', name: '<b>Eve</b>', landName: 'Österreich', kw: 42, appUrl: 'https://www.apopulse.com', abmeldeUrl: 'https://www.apopulse.com/?wb_abmelden=x"y',
    beobachtet: [{ wirkstoff: '<img src=x onerror=alert(1)>', hier: { tage: 2, status: 'kritisch', quelle: '<script>' }, ausland: [] }],
    bilanz: { aufzeichnung_seit: '2026-10-01', offen: 1, neu: [{ wirkstoff: '"><svg onload=1>', schwerster_status: 'kritisch', quelle: 'BASG' }], beendet: [] },
  }).html;
  assert.ok(!/<img|<script|<svg|<b>Eve/.test(html), html);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.ok(!/x"y/.test(html), 'Anführungszeichen im Link nicht escaped');
});

test('Versand: einmal je Woche, nur Premium, Abbestellung zählt, Fehler wird nicht als gesendet gemerkt', async () => {
  const a = aufbau({ start: '2026-10-12T06:00:00Z' }); // Montag
  const p1 = a.konto('eins@apo.at');
  a.konto('frei@apo.at', { prem: false });
  const p3 = a.konto('drei@apo.at');
  a.konto('kaputt@x.at');
  a.wb.abbestellen(p3);
  let r = await a.wb.lauf();
  assert.deepEqual(a.post.map((m) => m.an), ['eins@apo.at']);
  assert.equal(r.fehler, 1);
  r = await a.wb.lauf();
  assert.equal(a.post.length, 1, 'zweiter Lauf derselben Woche verschickte erneut');
  // Störung behoben: Der fehlgeschlagene Bericht kommt noch in derselben Woche.
  a.stoerung.an = false;
  await a.wb.lauf();
  assert.deepEqual(a.post.map((m) => m.an), ['eins@apo.at', 'kaputt@x.at'], 'Fehlversuch wurde als gesendet gemerkt');
  a.post.splice(1);
  // Neustart: Stand gesichert und geladen — trotzdem kein zweiter Versand.
  const gesichert = JSON.parse(JSON.stringify(a.wb.__dump()));
  a.wb.__load(gesichert);
  await a.wb.lauf();
  assert.equal(a.post.length, 1, 'nach Neustart doppelt verschickt');
  a.weiter(7);
  await a.wb.lauf();
  assert.equal(a.post.filter((m) => m.an === 'eins@apo.at').length, 2, 'neue Woche, neuer Bericht');
  a.wb.bestellen(p3);
  await a.wb.lauf();
  assert.ok(a.post.some((m) => m.an === 'drei@apo.at'));
  assert.ok(p1);
});

test('Versand aus: sagt warum, schickt nichts', async () => {
  const a = aufbau({ mailerOk: false, start: '2026-10-12T06:00:00Z' });
  a.konto('eins@apo.at');
  assert.deepEqual(await a.wb.lauf(), { aus: 'kein_schluessel' });
  assert.equal(a.post.length, 0);
});

test('Abmelde-Link taugt nie als Anmeldung — und umgekehrt', () => {
  const tok = issueZweckToken('wb_abmelden', 'u-123');
  assert.equal(verifyZweckToken('wb_abmelden', tok), 'u-123');
  assert.equal(verifyToken(tok), null, 'der Link aus der Mail wäre eine Sitzung gewesen');
  assert.equal(verifyZweckToken('wb_abmelden', issueToken('u-123')), null);
  assert.equal(verifyZweckToken('anderer_zweck', tok), null);
  assert.equal(verifyZweckToken('wb_abmelden', tok.slice(0, -2) + 'xx'), null);
});

test('Mailer: Resend und Postmark, aus ohne Schlüssel', async () => {
  const gesehen = [];
  const fetchImpl = async (url, o) => { gesehen.push({ url, headers: o.headers, body: JSON.parse(o.body) }); return { ok: true }; };
  const m1 = createMailer({ env: { APOPULSE_MAIL_PROVIDER: 'resend', APOPULSE_MAIL_API_KEY: 're_x', APOPULSE_MAIL_FROM: 'ApoPulse <b@apopulse.com>' }, fetchImpl });
  await m1.sende({ an: 'a@b.at', betreff: 'S', text: 'T', html: '<p>H</p>' });
  assert.equal(gesehen[0].url, 'https://api.resend.com/emails');
  assert.equal(gesehen[0].headers.authorization, 'Bearer re_x');
  assert.deepEqual(gesehen[0].body.to, ['a@b.at']);
  const m2 = createMailer({ env: { APOPULSE_MAIL_PROVIDER: 'postmark', APOPULSE_MAIL_API_KEY: 'pm', APOPULSE_MAIL_FROM: 'b@apopulse.com' }, fetchImpl });
  await m2.sende({ an: 'a@b.at', betreff: 'S', text: 'T', html: 'H' });
  assert.equal(gesehen[1].headers['x-postmark-server-token'], 'pm');
  assert.equal(gesehen[1].body.To, 'a@b.at');
  for (const [env, grund] of [[{}, 'kein_anbieter'], [{ APOPULSE_MAIL_PROVIDER: 'xyz' }, 'anbieter_unbekannt'], [{ APOPULSE_MAIL_PROVIDER: 'resend' }, 'kein_schluessel'], [{ APOPULSE_MAIL_PROVIDER: 'resend', APOPULSE_MAIL_API_KEY: 'k' }, 'kein_absender']]) {
    const m = createMailer({ env, fetchImpl });
    assert.deepEqual([m.aktiv, m.grund], [false, grund]);
  }
  await assert.rejects(() => m1.sende({ an: 'kein-mail', betreff: 'S', text: 'T', html: 'H' }), /ungültige/);
  const kaputt = createMailer({ env: { APOPULSE_MAIL_PROVIDER: 'resend', APOPULSE_MAIL_API_KEY: 'geheim123', APOPULSE_MAIL_FROM: 'b@a.com' }, fetchImpl: async () => ({ ok: false, status: 401 }) });
  await assert.rejects(() => kaputt.sende({ an: 'a@b.at', betreff: 'S', text: 'T', html: 'H' }), (e) => /HTTP 401/.test(e.message) && !/geheim123/.test(e.message));
});
