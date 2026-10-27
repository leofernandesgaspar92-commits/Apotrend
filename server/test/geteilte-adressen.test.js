// Start-Tag in Afrika: Viele Handy-Kund:innen eines Netzes teilen sich EINE öffentliche
// IP (Carrier-NAT). Bremsen nur je IP würden dort echte Apotheker:innen aussperren.
// Der Schutz hängt an Nummer/Konto und an der SMS-Gesamtgrenze — die gelten weiter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'http', 'server.js');
const NETZ = '102.89.34.7'; // eine IP für alle — wie hinter dem NAT eines Mobilfunkanbieters

test('Geteilte IP: Nachbarn sperren sich nicht gegenseitig; Nummer, Konto und SMS-Gesamtgrenze bremsen weiter', { timeout: 90000 }, async () => {
  const empfangen = [];
  const anbieter = http.createServer((req, res) => {
    let b = ''; req.on('data', (d) => { b += d; }); req.on('end', () => {
      empfangen.push(new URLSearchParams(b));
      res.writeHead(201, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ SMSMessageData: { Recipients: [{ statusCode: 101 }] } }));
    });
  });
  await new Promise((ok) => anbieter.listen(0, ok));
  const kind = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'nat-test-geheim-1', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus',
      APOPULSE_SMS_PROVIDER: 'africastalking', APOPULSE_SMS_USERNAME: 'sandbox', APOPULSE_SMS_API_KEY: 'test-schluessel',
      APOPULSE_SMS_URL: `http://localhost:${anbieter.address().port}/version1/messaging`, APOPULSE_SMS_MAX_STUNDE: '28' },
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
    const post = async (pfad, body) => {
      const r = await fetch(`http://localhost:${port}${pfad}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': NETZ }, body: JSON.stringify(body) });
      return { status: r.status, json: await r.json().catch(() => ({})) };
    };
    const nr = (i) => '0803 100 ' + String(1000 + i); // Nigeria, MTN-Vorwahl 0803

    // 1) 25 verschiedene Apotheker:innen im selben Netz fordern einen SMS-Code an — alle bekommen ihn.
    for (let i = 0; i < 25; i++) {
      const r = await post('/api/telefon/code', { telefon: nr(i), land: 'NG', sprache: 'en' });
      assert.equal(r.status, 200, `Person ${i + 1} im selben Netz ausgesperrt: ${JSON.stringify(r.json)}`);
    }
    // Je Nummer bleibt es bei 3 pro Stunde (auch anders geschrieben: dieselbe Nummer).
    assert.equal((await post('/api/telefon/code', { telefon: '+234 803 100 1000', land: 'NG' })).status, 200);
    assert.equal((await post('/api/telefon/code', { telefon: '08031001000', land: 'NG' })).status, 200);
    const vierte = await post('/api/telefon/code', { telefon: nr(0), land: 'NG' });
    assert.equal(vierte.status, 429); assert.equal(vierte.json.code, 'too_many_attempts');
    assert.equal(empfangen.length, 27);

    // 2) Code-Prüfung: 21 Nachbarn vertippen sich je einmal — der 22. kommt trotzdem rein.
    for (let i = 1; i <= 21; i++) {
      const r = await post('/api/telefon/pruefen', { telefon: nr(i), land: 'NG', code: '000000' === codeVon(empfangen, i) ? '111111' : '000000' });
      assert.equal(r.json.code, 'tel_code_falsch', `Vertipper ${i}: ${JSON.stringify(r.json)}`);
    }
    const rein = await post('/api/telefon/pruefen', { telefon: nr(22), land: 'NG', code: codeVon(empfangen, 22) });
    assert.equal(rein.status, 200, 'Nachbarn haben die Code-Prüfung für alle gesperrt: ' + JSON.stringify(rein.json));
    assert.equal(rein.json.neu, true);
    // Raten an EINER Nummer bleibt gebremst — auch wenn sie jedes Mal anders geschrieben wird.
    const schreibweisen = ['0803 100 1023', '+2348031001023', '08031001023'];
    let letzte;
    for (let i = 0; i < 21; i++) letzte = await post('/api/telefon/pruefen', { telefon: schreibweisen[i % 3], land: 'NG', code: String(100000 + i) });
    assert.equal(letzte.status, 429, 'Code-Raten an einer Nummer nicht gebremst: ' + JSON.stringify(letzte.json));

    // 3) SMS-Gesamtgrenze (hier 28/Stunde) erreicht: ehrliche Meldung statt „zu viele Versuche".
    assert.equal((await post('/api/telefon/code', { telefon: nr(40), land: 'NG' })).status, 200);
    const voll = await post('/api/telefon/code', { telefon: nr(41), land: 'NG' });
    assert.equal(voll.status, 429);
    assert.equal(voll.json.code, 'sms_ausgelastet');
    assert.equal(empfangen.length, 28, 'mehr SMS als die Gesamtgrenze verschickt');

    // 4) Passwort-Link: 10 Personen im selben Netz — keine wird ausgesperrt; je Adresse bleibt es bei 3/Stunde.
    for (let i = 0; i < 10; i++) {
      const r = await post('/api/password/reset-link', { email: `apo${i}@lagos.test`, sprache: 'en' });
      assert.notEqual(r.status, 429, `Link-Anfrage ${i + 1} im selben Netz gesperrt`);
    }
    for (let i = 0; i < 2; i++) await post('/api/password/reset-link', { email: 'apo0@lagos.test' });
    assert.equal((await post('/api/password/reset-link', { email: 'apo0@lagos.test' })).status, 429, 'je Adresse ungebremst');

    // 5) Link einlösen: 10 kaputte Links aus dem Netz sperren den 11. Versuch nicht.
    for (let i = 0; i < 10; i++) {
      const r = await post('/api/password/reset-mit-link', { t: 'kaputt.' + i, newPassword: 'Passwort123!' });
      assert.notEqual(r.status, 429, `Link-Einlösung ${i + 1} gesperrt`);
    }
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
    anbieter.close();
  }
});

// Der Code der i-ten Nummer aus den verschickten SMS (Nummer +23480310010xx).
function codeVon(empfangen, i) {
  const an = '+2348031001' + String(i).padStart(3, '0');
  const sms = empfangen.filter((f) => f.get('to') === an).at(-1);
  return sms ? (sms.get('message').match(/\d{6}/) || [])[0] : undefined;
}
