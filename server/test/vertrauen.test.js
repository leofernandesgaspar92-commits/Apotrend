// Vertrauensstufen von Apotheken-Meldungen: aus einem Hinweis wird ein von
// mehreren Apotheken bestätigter Engpass — sichtbar, gezählt, einmal gemeldet.
// In Ländern ohne amtliche Liste (große Teile Afrikas) ist das die beste
// verfügbare Aussage; sie bleibt als „nicht amtlich" gekennzeichnet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pushNachricht, PUSH_TYPEN } from '../src/services/webPush.js';
import { BESTAETIGT_AB_APOTHEKEN } from '../src/services/shortages.js';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'http', 'server.js');

test('Push-Text: Anzahl Apotheken, Land, „nicht amtlich"', () => {
  assert.equal(BESTAETIGT_AB_APOTHEKEN, 3);
  assert.ok(PUSH_TYPEN.has('shortage_bestaetigt'));
  const m = pushNachricht({ type: 'shortage_bestaetigt', refType: 'wirkstoff', refId: 'Salbutamol', label: 'Salbutamol · UG · 3' }, { sprache: 'en', landName: () => 'Uganda' });
  assert.equal(m.titel, 'Confirmed: Salbutamol');
  assert.equal(m.text, '3 pharmacies in Uganda report Salbutamol as short (not official).');
});

test('Über HTTP: Meldung -> 2 -> 3 Apotheken; Alarm genau einmal, nur im Land', { timeout: 60000 }, async () => {
  const kind = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'vertrauen-test', APOPULSE_BESTAETIGUNG_AB_STUNDEN: '0', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus', APOPULSE_REFERENCE_DATA: '' },
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
    const post = async (pfad, t, body) => { const r = await fetch(B + pfad, { method: 'POST', headers: H(t), body: JSON.stringify(body || {}) }); return { status: r.status, d: await r.json() }; };
    const get = async (pfad, t) => (await fetch(B + pfad, { headers: H(t) })).json();
    const reg = async (name, cc) => (await post('/api/register', '', { name, email: name.replace(/\W/g, '') + '@vt.test', password: 'Passwort123!', country: cc, accountType: 'pharmacy' })).d.token;
    const a = await reg('Apo A', 'UG'); const b = await reg('Apo B', 'UG'); const c = await reg('Apo C', 'UG');
    const beob = await reg('Beobachterin UG', 'UG'); const fern = await reg('Beobachter KE', 'KE');
    await post('/api/watchlist', beob, { wirkstoff: 'Salbutamol' });
    await post('/api/watchlist', fern, { wirkstoff: 'Salbutamol' });

    const m = await post('/api/shortages/report', a, { wirkstoff: 'Salbutamol', bezeichnung: 'Salbutamol Inhaler 100 µg', status: 'kritisch', country: 'UG' });
    assert.equal(m.status, 200, JSON.stringify(m.d));
    const id = m.d.id;
    const zeile = async (t) => (await get('/api/shortages?country=UG', t)).shortages.find((s) => s.id === id);
    let z = await zeile(beob);
    assert.deepEqual([z.apotheken, z.bestaetigt], [1, false]);

    assert.equal((await post(`/api/shortages/${id}/confirm`, b)).status, 200);
    z = await zeile(beob);
    assert.deepEqual([z.apotheken, z.bestaetigt], [2, false]);
    const zahl = async (t) => (await get('/api/notifications', t)).notifications.filter((n) => n.type === 'shortage_bestaetigt').length;
    assert.equal(await zahl(beob), 0, 'schon bei 2 Apotheken als bestätigt gemeldet');

    assert.equal((await post(`/api/shortages/${id}/confirm`, c)).status, 200);
    z = await zeile(beob);
    assert.deepEqual([z.apotheken, z.bestaetigt], [3, true]);
    assert.equal(await zahl(beob), 1, 'Beobachterin im Land nicht benachrichtigt');
    assert.equal(await zahl(a), 1, 'Meldende nicht benachrichtigt');
    assert.equal(await zahl(fern), 0, 'Beobachter in Kenia für eine ugandische Meldung benachrichtigt');
    const n = (await get('/api/notifications', beob)).notifications.find((x) => x.type === 'shortage_bestaetigt');
    assert.equal(n.label, 'Salbutamol · UG · 3');

    // Zurücknehmen und erneut bestätigen: kein zweiter Alarm.
    await post(`/api/shortages/${id}/unconfirm`, c);
    assert.equal((await zeile(beob)).bestaetigt, false);
    await post(`/api/shortages/${id}/confirm`, c);
    assert.equal(await zahl(beob), 1, 'Alarm doppelt');

    // Engpasslage Afrika zählt die bestätigte Meldung getrennt — weiter nicht als amtlich.
    const lage = await get('/api/lage/ebene?ebene=region', beob);
    const ug = lage.laender.find((l) => l.land === 'UG');
    assert.deepEqual([ug.amtlich, ug.apotheken, ug.apotheken_bestaetigt], [0, 1, 1]);
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});
