// Anzeigen von Ende zu Ende über HTTP: Buchung -> Prüfung -> Zahlung (Rechnung
// und Krypto) -> Auslieferung -> Klick -> Statistik. Eigener Prozess, weil die
// Rechnungsangaben des Betreibers beim Start aus der Umgebung gelesen werden.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'http', 'server.js');

test('Anzeige: buchen, prüfen, bezahlen, ausliefern, zählen', { timeout: 60000 }, async () => {
  const kind = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'anzeigen-test', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus',
      APOPULSE_ADMIN_EMAIL: 'red@anz.test', APOPULSE_ADMIN_PASSWORD: 'anzeigen-test-123',
      APOPULSE_FIRMA_NAME: 'ApoPulse Test GmbH', APOPULSE_FIRMA_ANSCHRIFT: 'Ring 1, 1010 Wien', APOPULSE_BANK_IBAN: 'AT00 1234 5678 9012 3456', APOPULSE_UST_SATZ: '20' },
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
    const get = async (pfad, t) => { const r = await fetch(B + pfad, { headers: H(t) }); return { status: r.status, d: await r.json() }; };
    const reg = async (name, typ) => (await post('/api/register', '', { name, email: name + '@anz.test', password: 'Passwort123!', country: 'AT', accountType: typ })).d.token;
    const red = (await post('/api/login', '', { email: 'red@anz.test', password: 'anzeigen-test-123' })).d.token;
    const pharma = await reg('pharmaag', 'pharma');
    const apo = await reg('apotheke', 'pharmacy');
    const privat = await reg('privat', 'private');

    // Mediadaten: öffentlich, echte Zahlen, kleine Zahlen nicht genannt.
    const md = (await get('/api/werbung/mediadaten')).d;
    assert.deepEqual(md.plaetze.map((p) => p.id).sort(), ['feed', 'seite', 'start']);
    assert.equal(md.laender.length, 16);
    const at = md.laender.find((l) => l.land === 'AT');
    assert.deepEqual(at.konten, { anzahl: null, unter_10: true }, 'drei Konten dürfen nicht einzeln erkennbar sein');
    assert.equal(md.zahlung.rechnung, true);

    // Buchung.
    assert.equal((await post('/api/werbung/firma', privat, { firma: 'X' })).status, 403, 'Privatperson kann nicht werben');
    assert.equal((await post('/api/werbung/firma', pharma, { firma: 'Pharma AG', strasse: 'Weg 1', plz: '1010', ort: 'Wien', land: 'AT', email: 'rechnung@pharma.example' })).status, 200);
    const heute = new Date().toISOString().slice(0, 10);
    const anzeige = { titel: 'Neues Kühllager in Wien', text: 'Temperaturgeführte Lagerung und Zustellung für Apotheken.', link: 'https://example.com/kuehl',
      platz: 'start', laender: ['AT'], zielgruppen: ['pharmacy'], wochen: 1, start: heute };
    const k = (await post('/api/werbung/kampagnen', pharma, anzeige)).d.kampagne;
    assert.equal(k.preis_cents, 49000);
    await post(`/api/werbung/kampagnen/${k.id}/einreichen`, pharma);
    assert.equal((await get('/api/anzeigen/platz/start', apo)).d.anzeige, null, 'ungeprüft und unbezahlt: keine Auslieferung');
    assert.equal((await post(`/api/werbung/kampagnen/${k.id}/freigeben`, pharma)).status, 403, 'nur Redaktion gibt frei');
    assert.ok((await get('/api/werbung/pruefung', red)).d.offen.some((x) => x.id === k.id && x.firma.firma === 'Pharma AG'));
    await post(`/api/werbung/kampagnen/${k.id}/freigeben`, red);
    assert.equal((await get('/api/anzeigen/platz/start', apo)).d.anzeige, null, 'freigegeben, aber unbezahlt');

    // Zahlung per Rechnung, Redaktion verbucht den Eingang.
    const r = (await post(`/api/werbung/kampagnen/${k.id}/rechnung`, pharma)).d.rechnung;
    assert.deepEqual([r.netto_cents, r.ust_cents, r.brutto_cents, r.aussteller.firma], [49000, 9800, 58800, 'ApoPulse Test GmbH']);
    await post(`/api/werbung/kampagnen/${k.id}/ueberweisung-verbucht`, red);

    // Auslieferung: Apotheke ja, Privatperson nein (nicht gebucht).
    const ad = (await get('/api/anzeigen/platz/start', apo)).d.anzeige;
    assert.deepEqual([ad.id, ad.firma, ad.warum.zielgruppen], [k.id, 'Pharma AG', ['pharmacy']]);
    assert.equal((await get('/api/anzeigen/platz/start', privat)).d.anzeige, null);
    assert.equal((await get('/api/anzeigen/platz/feed', apo)).d.anzeige, null, 'anderer Platz');

    // Klick: Weiterleitung, einmal gezählt; gefälschtes Zeichen leitet weiter, zählt nicht.
    const k1 = await fetch(B + ad.klick, { redirect: 'manual' });
    assert.equal(k1.status, 302);
    assert.equal(k1.headers.get('location'), 'https://example.com/kuehl');
    await fetch(B + ad.klick, { redirect: 'manual' });
    const k3 = await fetch(B + `/api/anzeigen/${k.id}/klick?z=gefaelscht`, { redirect: 'manual' });
    assert.equal(k3.status, 302);
    const st = (await get(`/api/werbung/kampagnen/${k.id}/statistik`, pharma)).d;
    assert.deepEqual([st.tage[0].impressionen, st.tage[0].klicks], [1, 1]);
    assert.deepEqual(st.je_gruppe, { pharmacy: 1 });
    assert.equal((await get(`/api/werbung/kampagnen/${k.id}/statistik`, apo)).status, 404, 'fremde Statistik nicht lesbar');

    // Krypto-Weg: zweite Kampagne, Redaktion bestätigt die Zahlung -> läuft.
    const k2 = (await post('/api/werbung/kampagnen', pharma, { ...anzeige, platz: 'feed', titel: 'Großhandel Express' })).d.kampagne;
    await post(`/api/werbung/kampagnen/${k2.id}/einreichen`, pharma);
    await post(`/api/werbung/kampagnen/${k2.id}/freigeben`, red);
    const opt = (await get(`/api/werbung/kampagnen/${k2.id}/krypto`, pharma)).d;
    assert.equal(opt.amount_eur, 290);
    const btc = opt.coins.find((c) => c.coin === 'bitcoin');
    assert.ok(btc, 'BTC-Wallet fehlt: ' + JSON.stringify(opt.coins.map((c) => c.coin)));
    const start = (await post(`/api/werbung/kampagnen/${k2.id}/krypto/start`, pharma, { walletId: btc.id })).d;
    const tx = Array.from({ length: 64 }, (_, i) => '0123456789abcdef'[(i * 5 + 1) % 16]).join('');
    assert.equal((await post(`/api/payments/crypto/${start.payment_id}/claim`, pharma, { txRef: tx })).status, 200);
    const liste = (await get('/api/payments/pending', red)).d;
    const offen = (liste.payments || liste.items || liste).find((p) => p.id === start.payment_id);
    assert.match(offen.product_name, /Großhandel Express/, 'Prüfliste nennt die Anzeige');
    assert.equal((await post(`/api/payments/${start.payment_id}/confirm`, red)).status, 200);
    const meine = (await get('/api/werbung/kampagnen', pharma)).d.kampagnen;
    assert.equal(meine.find((x) => x.id === k2.id).zustand, 'laeuft', 'Krypto-Bestätigung startet die Kampagne');
    assert.ok((await get('/api/anzeigen/platz/feed', apo)).d.anzeige, 'Feed-Anzeige wird ausgeliefert');
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});
