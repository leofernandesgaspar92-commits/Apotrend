// Datenschutzerklärung in fünf Sprachen. Bis 10/2026 nur Deutsch: Wer in Senegal auf „Confidentialité"
// tippte, bekam eine deutsche Seite. Deutsch bleibt maßgeblich, die Übersetzungen sagen das.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { datenschutzMitAngaben, betreiberAngaben, datenschutzDatei, DATENSCHUTZ_SPRACHEN } from '../src/http/impressum.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const lies = (sp) => readFileSync(join(ROOT, 'public', datenschutzDatei(sp)), 'utf8');
const zaehle = (s, rx) => (s.match(rx) || []).length;

test('Alle fünf Fassungen: gleicher Aufbau (Abschnitte, Tabellenzeilen, Platzhalter), richtige Sprache und Richtung', () => {
  assert.deepEqual(DATENSCHUTZ_SPRACHEN, ['de', 'en', 'fr', 'pt', 'ar']);
  const de = lies('de');
  for (const sp of DATENSCHUTZ_SPRACHEN) {
    const s = lies(sp);
    assert.match(s, new RegExp(`<html lang="${sp}"${sp === 'ar' ? ' dir="rtl"' : ''}>`), sp + ': lang/dir');
    assert.equal(zaehle(s, /<h2>/g), zaehle(de, /<h2>/g), sp + ': Abschnitte');
    assert.equal(zaehle(s, /<tr>/g), zaehle(de, /<tr>/g), sp + ': Tabellenzeilen');
    for (const l of ['verantwortlich', 'sms', 'zahlung', 'kontakt']) assert.equal(zaehle(s, new RegExp(`data-luecke="${l}"`, 'g')), 1, `${sp}: Platzhalter ${l}`);
    assert.equal(zaehle(s, /<!--sprachen-->/g), 1, sp + ': Platz für die Sprachwahl');
    assert.match(s, /class="entwurf"/, sp + ': Entwurfs-Hinweis');
    assert.match(s, /Frankfurt|Francfort|فرانكفورت/, sp + ': Speicherort');
    assert.match(s, /scrypt/, sp + ': Passwort-Prüfwert');
    assert.match(s, /\b30\b/, sp + ': Fehlerberichte 30 Tage');
  }
  // Übersetzungen nennen die maßgebliche Fassung.
  assert.match(lies('en'), /German version prevails/);
  assert.match(lies('fr'), /la version allemande fait foi/);
  assert.match(lies('pt'), /prevalece a versão alemã/);
  assert.match(lies('ar'), /تُعتمد النسخة الألمانية/);
  // Kontoarten vollständig (Klinik, Logistik, privat kamen später dazu).
  assert.match(de, /Arztpraxis\/Klinik, Großhandel, Logistik, Pharma, Behörde oder privat/);
  // Kein Deutsch in den Übersetzungen außer Eigennamen.
  for (const sp of ['en', 'fr', 'pt', 'ar']) {
    const text = lies(sp).replace(/<style>[\s\S]*?<\/style>/, '').replace(/Datenschutzbehörde|Frankfurt am Main/g, '');
    assert.ok(!/\b(und|nicht|werden|Daten|einzutragen)\b/.test(text), sp + ': deutscher Text in der Übersetzung');
  }
});

test('Platzhalter je Sprache gefüllt; Sprachwahl oben', () => {
  const a = betreiberAngaben({ APOPULSE_FIRMA_ANSCHRIFT: 'Hauptplatz 1, 4020 Linz', APOPULSE_KONTAKT_EMAIL: 'd@apopulse.example' });
  const erwart = {
    de: ["Anbieter: Africa's Talking", 'Kartenzahlung über Stripe', 'E-Mail:'],
    en: ["Provider: Africa's Talking", 'Card payment via Stripe', 'Email:'],
    fr: ["Prestataire : Africa's Talking", 'Paiement par carte via Stripe', 'E-mail:'],
    pt: ["Prestador: Africa's Talking", 'Pagamento com cartão via Stripe', 'E-mail:'],
    ar: ["المزوّد: Africa's Talking", 'الدفع بالبطاقة عبر Stripe', 'البريد الإلكتروني:'],
  };
  for (const sp of DATENSCHUTZ_SPRACHEN) {
    const s = datenschutzMitAngaben(lies(sp), a, { sms: 'africastalking', zahlwege: ['stripe'], krypto: true });
    assert.ok(!/class="luecke" data-luecke/.test(s), sp + ': Platzhalter übrig');
    for (const w of erwart[sp]) assert.ok(s.replace(/&#39;/g, "'").includes(w), `${sp}: „${w}" fehlt`);
    assert.match(s, /Hauptplatz 1, 4020 Linz/);
    // Sprachwahl: eigene Sprache fett, die anderen verlinkt.
    assert.match(s, new RegExp(`<nav aria-label="Language"[^>]*>.*<b lang="${sp}">`));
    assert.equal(zaehle(s, /<a href="\/datenschutz\.html\?sp=[a-z]{2}" hreflang=/g), 4, sp + ': Links zu den anderen Sprachen');
    // Ohne Angaben: ehrlich „nicht eingeschaltet" in der Sprache der Seite.
    const leer = datenschutzMitAngaben(lies(sp), betreiberAngaben({}), {});
    assert.ok(!/data-luecke="sms"|data-luecke="zahlung"/.test(leer), sp);
    assert.match(leer, /data-luecke="verantwortlich"/, sp + ': fehlende Anschrift wurde erfunden');
  }
});

test('Server wählt die Sprache: ?sp= vor Browser, sonst Englisch; App-Links tragen die App-Sprache', { timeout: 60000 }, async () => {
  const app = readFileSync(join(ROOT, 'public', 'app.js'), 'utf8');
  const i18n = app.slice(app.indexOf('function applyI18n(root)'), app.indexOf('\n}\n', app.indexOf('function applyI18n(root)')) + 3);
  const links = [{ h: '/impressum' }, { h: '/datenschutz.html?sp=de' }];
  const knoten = links.map((l) => ({ getAttribute: () => l.h, setAttribute: (k, v) => { l.h = v; } }));
  const ctx = { document: { querySelectorAll: (sel) => (/impressum/.test(sel) ? knoten : []) }, LOCALE: 'fr', tc: (k) => k, t: (k) => k, navTabLabel: () => {} };
  vm.runInNewContext(i18n + 'applyI18n();', ctx);
  assert.deepEqual(links.map((l) => l.h), ['/impressum?sp=fr', '/datenschutz.html?sp=fr']);

  const kind = spawn(process.execPath, [join(ROOT, 'src', 'http', 'server.js')], { env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'ds-sp-1', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  try {
    const port = await new Promise((ok, fail) => {
      const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
      const l = (d) => { log += d; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
      kind.stdout.on('data', l); kind.stderr.on('data', l);
    });
    const lang = async (pfad, al) => ((await (await fetch(`http://localhost:${port}${pfad}`, { headers: al ? { 'accept-language': al } : {} })).text()).match(/<html lang="([a-z]{2})"/) || [])[1];
    assert.equal(await lang('/datenschutz.html?sp=fr', 'en-GH'), 'fr', '?sp= vor Browser');
    assert.equal(await lang('/datenschutz.html', 'pt-AO,pt;q=0.9'), 'pt');
    assert.equal(await lang('/datenschutz.html', 'ar-EG'), 'ar');
    assert.equal(await lang('/datenschutz.html', 'de-AT'), 'de');
    assert.equal(await lang('/datenschutz.html', ''), 'en', 'ohne Angabe (z. B. Play-Prüfung): Englisch');
    assert.equal(await lang('/datenschutz.html?sp=../../etc', 'fr-SN'), 'fr', 'ungültiges ?sp= → Browser');
    assert.equal(await lang('/impressum?sp=de', 'en'), 'de');
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});
