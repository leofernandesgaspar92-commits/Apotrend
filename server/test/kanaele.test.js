// Herkunft messen (services/kanaele.js): ?k=tiktok → Besuche und neue Konten je Kanal.
// Nur Summen je Tag und Kanal — kein Konto trägt seinen Kanal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { createKanaele, normalisiereKanal, istVorschauAbruf, MAX_KANAELE, AUFBEWAHREN_TAGE } from '../src/services/kanaele.js';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'http', 'server.js');

test('Kanalnamen: klein, 2–20 Zeichen a–z 0–9 -; alles andere zählt nicht', () => {
  assert.equal(normalisiereKanal(' TikTok '), 'tiktok');
  assert.equal(normalisiereKanal('flyer-dakar'), 'flyer-dakar');
  for (const x of ['', 'a', '-x', 'tik tok', '<script>', 'x'.repeat(21), null, undefined]) assert.equal(normalisiereKanal(x), null, String(x));
});

test('Vorschau-Abrufer (WhatsApp, TikTok, Facebook, Bots) sind keine Besuche', () => {
  for (const ua of ['WhatsApp/2.23', 'facebookexternalhit/1.1', 'TelegramBot', 'Mozilla/5.0 (compatible; Googlebot/2.1)', 'Bytespider', 'HeadlessChrome']) assert.ok(istVorschauAbruf(ua), ua);
  assert.ok(!istVorschauAbruf('Mozilla/5.0 (Linux; Android 13; TECNO) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'));
});

test('Zählen und Bericht: Summen je Kanal, meiste Konten zuerst, nur der Zeitraum', () => {
  let jetzt = new Date('2026-11-01T10:00:00Z');
  const k = createKanaele({ jetzt: () => jetzt });
  for (let i = 0; i < 5; i++) k.zaehle('tiktok', 'besuche');
  k.zaehle('tiktok', 'konten');
  for (let i = 0; i < 9; i++) k.zaehle('whatsapp', 'besuche');
  k.zaehle('whatsapp', 'konten'); k.zaehle('whatsapp', 'konten');
  assert.equal(k.zaehle('tiktok', 'irgendwas'), null);
  assert.deepEqual(k.bericht(30), [{ kanal: 'whatsapp', besuche: 9, konten: 2 }, { kanal: 'tiktok', besuche: 5, konten: 1 }]);
  jetzt = new Date('2026-12-15T10:00:00Z');
  k.zaehle('tiktok', 'konten');
  assert.deepEqual(k.bericht(30), [{ kanal: 'tiktok', besuche: 0, konten: 1 }], 'Tage außerhalb der 30 zählen nicht');
  assert.equal(k.bericht(60).find((x) => x.kanal === 'tiktok').besuche, 5);
});

test('Wer zufällige Namen aufruft, flutet die Liste nicht; alte Tage fallen weg', () => {
  let jetzt = new Date('2026-11-01T10:00:00Z');
  const k = createKanaele({ jetzt: () => jetzt });
  for (let i = 0; i < MAX_KANAELE + 50; i++) k.zaehle('kanal-' + i, 'besuche');
  const b = k.bericht(30);
  assert.equal(b.length, MAX_KANAELE + 1, 'höchstens MAX_KANAELE Namen + „andere"');
  assert.equal(b.find((x) => x.kanal === 'andere').besuche, 50);
  jetzt = new Date(jetzt.getTime() + (AUFBEWAHREN_TAGE + 2) * 86400000);
  k.zaehle('tiktok', 'besuche');
  assert.equal(k.__dump().length, 1, 'Tage älter als die Aufbewahrung sind gelöscht');
});

test('Speichern und Laden: gleiche Summen; Unsinn im Speicher wird verworfen', () => {
  const jetzt = () => new Date('2026-11-02T08:00:00Z');
  const a = createKanaele({ jetzt });
  a.zaehle('tiktok', 'besuche'); a.zaehle('tiktok', 'konten');
  const b = createKanaele({ jetzt });
  b.__load(JSON.parse(JSON.stringify(a.__dump())));
  assert.deepEqual(b.bericht(30), a.bericht(30));
  const c = createKanaele({ jetzt });
  c.__load([['2026-11-02', [['<b>', { besuche: 3 }], ['ok-name', { besuche: -4, konten: 'x' }]]], ['kein-datum', []], 'quatsch']);
  assert.deepEqual(c.bericht(30), [{ kanal: 'ok-name', besuche: 0, konten: 0 }]);
});

test('Browser: Kanal aus dem Link gemerkt (erster zählt), bei jeder Anmeldeart mitgeschickt, danach gelöscht', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const merk = app.slice(app.indexOf('function merkeLinkAbsicht('), app.indexOf('function leseAbsicht('));
  assert.match(merk, /!localStorage\.getItem\('apo_kanal'\)\) localStorage\.setItem\('apo_kanal', k\)/);
  assert.match(merk, /q\.get\('src'\) === 'twa' \? 'play'/);
  assert.equal((app.match(/kanal: leseKanal\(\)/g) || []).length, 3, 'Registrierung, Telefon, Google/Facebook');
  assert.match(app.slice(app.indexOf('function afterAuth('), app.indexOf('function afterAuth(') + 200), /removeItem\('apo_kanal'\)/);
});

test('Über HTTP: Besuch ?k=tiktok → Konto → Cockpit; Vorschau zählt nicht; Konto trägt keinen Kanal', { timeout: 30000 }, async () => {
  const kind = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'kanaele-test-geheim-123', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus',
      APOPULSE_ADMIN_EMAIL: 'red@kanal.test', APOPULSE_ADMIN_PASSWORD: 'kanal-PW-98765' },
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
    const handy = { 'user-agent': 'Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile' };
    assert.equal((await fetch(B + '/?k=tiktok', { headers: handy })).status, 200);
    await fetch(B + '/?k=TikTok', { headers: handy });
    await fetch(B + '/?k=tiktok', { headers: { 'user-agent': 'WhatsApp/2.23.20' } });
    await fetch(B + '/?src=twa', { headers: handy });
    await fetch(B + '/app.js?k=tiktok', { headers: handy });
    const reg = await (await fetch(B + '/api/register', { method: 'POST', headers: H(''), body: JSON.stringify({ name: 'Ama', email: 'ama@kanal.test', password: 'Passwort123!', country: 'GH', accountType: 'pharmacy', kanal: 'tiktok' }) })).json();
    assert.ok(reg.token);
    await fetch(B + '/api/register', { method: 'POST', headers: H(''), body: JSON.stringify({ name: 'Kofi', email: 'kofi@kanal.test', password: 'Passwort123!', country: 'GH', accountType: 'pharmacy' }) });
    const meText = await (await fetch(B + '/api/me', { headers: H(reg.token) })).text();
    assert.ok(!/tiktok/i.test(meText), 'Konto trägt den Kanal');
    assert.equal((await fetch(B + '/api/betrieb', { headers: H(reg.token) })).status, 403);
    const red = (await (await fetch(B + '/api/login', { method: 'POST', headers: H(''), body: JSON.stringify({ email: 'red@kanal.test', password: 'kanal-PW-98765' }) })).json()).token;
    const b = await (await fetch(B + '/api/betrieb', { headers: H(red) })).json();
    assert.deepEqual(b.kanaele, [{ kanal: 'tiktok', besuche: 2, konten: 1 }, { kanal: 'play', besuche: 1, konten: 0 }]);
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});
