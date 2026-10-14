// Startklar-Check (services/startklar.js): was der Betreiber noch einrichten
// muss — wichtigstes zuerst, und NIE ein geheimer Wert in der Antwort.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startklar } from '../src/services/startklar.js';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'http', 'server.js');
const stufe = (r, id) => (r.punkte.find((p) => p.id === id) || {}).stufe;

test('Nichts eingerichtet: das Gefährliche steht oben und heißt „fehlt"', () => {
  const r = startklar({});
  assert.deepEqual(r.punkte.slice(0, 4).map((p) => p.stufe), ['fehlt', 'fehlt', 'fehlt', 'fehlt']);
  for (const id of ['daten', 'anmeldung', 'quellen', 'krypto']) assert.equal(stufe(r, id), 'fehlt', id);
  assert.equal(r.erledigt, 0);
  assert.ok(r.punkte.every((p) => p.stufe === 'ok' || p.tun), 'offener Punkt ohne Anleitung');
  assert.equal(stufe(r, 'ust'), undefined, 'Umsatzsteuer gefragt, obwohl es noch gar keine Rechnungen gibt');
});

test('Alles eingerichtet: alles erledigt, keine Anleitungen mehr', () => {
  const env = { APOPULSE_TOKEN_SECRET: 'x', APOPULSE_PUBLIC_URL: 'https://a.example', APOPULSE_FIRMA_NAME: 'A', APOPULSE_FIRMA_ANSCHRIFT: 'B', APOPULSE_BANK_IBAN: 'AT00', APOPULSE_UST_SATZ: '20' };
  const r = startklar({ env, dauerhaft: { level: 'sicher' }, quellen: { gesamt: 3, liefern: 3, fehler: 0 }, mail: { aktiv: true }, vapidFest: true, wallets: [{ id: 'btc' }, { id: 'tron' }], zahlwege: ['stripe'] });
  assert.equal(r.erledigt, r.gesamt);
  assert.ok(r.punkte.every((p) => p.stufe === 'ok' && p.tun === null));
  assert.match(r.punkte.find((p) => p.id === 'ust').warum, /20 %/);
});

test('Teilweise: Quellen mit Fehlern, Datei statt Datenbank (= fehlt), kein USDT', () => {
  const r = startklar({ dauerhaft: { level: 'unvollständig' }, quellen: { gesamt: 3, liefern: 2, fehler: 1 }, wallets: [{ id: 'btc' }] });
  assert.equal(stufe(r, 'daten'), 'fehlt', 'nur Datei: auf Render nach dem Deploy weg');
  assert.match(r.punkte.find((p) => p.id === 'daten').warum, /nur in einer Datei/);
  assert.equal(stufe(r, 'quellen'), 'warnung');
  assert.match(r.punkte.find((p) => p.id === 'quellen').warum, /2 von 3 .* 1 melden Fehler/);
  assert.equal(stufe(r, 'krypto'), 'warnung');
  assert.match(r.punkte.find((p) => p.id === 'krypto').tun, /APOPULSE_WALLET_TRON/);
});

test('Kein Geheimnis in der Antwort', () => {
  const env = { APOPULSE_TOKEN_SECRET: 'GEHEIM-token-123', APOPULSE_BANK_IBAN: 'AT61 1904 3002 3457 3201', APOPULSE_MAIL_API_KEY: 'GEHEIM-mail', APOPULSE_VAPID_PRIVATE_KEY: 'GEHEIM-vapid', APOPULSE_FIRMA_NAME: 'A', APOPULSE_FIRMA_ANSCHRIFT: 'B', DATABASE_URL: 'postgres://u:GEHEIM@h/db' };
  const text = JSON.stringify(startklar({ env }));
  for (const v of ['GEHEIM', '1904 3002']) assert.ok(!text.includes(v), v);
});

test('Über HTTP: nur Redaktion, ohne Geheimnisse', { timeout: 30000 }, async () => {
  const geheim = 'startklar-GEHEIM-schluessel-9876';
  const kind = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: geheim, APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus', APOPULSE_PUBLIC_URL: '',
      APOPULSE_ADMIN_EMAIL: 'red@sk.test', APOPULSE_ADMIN_PASSWORD: 'startklar-PW-4321', APOPULSE_WALLET_TRON: '' },
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
    const red = (await (await fetch(B + '/api/login', { method: 'POST', headers: H(''), body: JSON.stringify({ email: 'red@sk.test', password: 'startklar-PW-4321' }) })).json()).token;
    const apo = (await (await fetch(B + '/api/register', { method: 'POST', headers: H(''), body: JSON.stringify({ name: 'Apo', email: 'apo@sk.test', password: 'Passwort123!', country: 'AT', accountType: 'pharmacy' }) })).json()).token;
    assert.equal((await fetch(B + '/api/startklar', { headers: H(apo) })).status, 403);
    assert.equal((await fetch(B + '/api/startklar')).status, 401);
    const r = await fetch(B + '/api/startklar', { headers: H(red) });
    assert.equal(r.status, 200);
    const text = await r.text();
    const d = JSON.parse(text);
    assert.equal(stufe(d, 'daten'), 'fehlt', 'ohne Datenbank und Datei nicht als Problem erkannt');
    assert.equal(stufe(d, 'anmeldung'), 'ok');
    assert.equal(stufe(d, 'adresse'), 'warnung');
    assert.equal(stufe(d, 'krypto'), 'warnung', 'fehlendes USDT (Tron) nicht erkannt');
    assert.ok(!text.includes(geheim) && !text.includes('startklar-PW-4321'), 'Geheimnis in der Antwort');
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});
