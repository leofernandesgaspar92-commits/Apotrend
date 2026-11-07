// Fremde Daten: Konto B darf mit den IDs von Konto A nichts lesen oder ändern.
// Abklopfen 11/2026 (alle live genutzten Bereiche mit Eigentümer: Kampagnen, Zahlungen, Rechnungen,
// Beschaffungsanfragen, Beiträge, Kommentare, Engpass-Meldungen, Logistik, Nachrichten): alles abgewehrt —
// dieser Test hält das fest, damit eine künftige Änderung keine Eigentümer-Prüfung still entfernt.
// Dabei vereinheitlicht: Zahlungen antworteten Nicht-Redakteur:innen mit 400 statt 403, fremde Zahlungen
// mit 400 statt 404.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'http', 'server.js');

test('Konto B auf Daten von Konto A: überall 403/404, Daten von A unverändert', { timeout: 90000 }, async () => {
  const kind = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'zugriff-fremd-1', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus',
      APOPULSE_ADMIN_EMAIL: 'red@zf.test', APOPULSE_ADMIN_PASSWORD: 'zugriff-PW-1', APOPULSE_BESTAETIGUNG_AB_STUNDEN: '0',
      APOPULSE_FIRMA_NAME: 'Prüf GmbH', APOPULSE_FIRMA_ANSCHRIFT: 'Weg 1, 1010 Wien', APOPULSE_BANK_IBAN: 'AT00 1234 5678 9012 3456' },
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
    const req = async (m, p, tok, body) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: m === 'GET' ? undefined : JSON.stringify(body || {}) }); let d = {}; try { d = await r.json(); } catch { /* leer */ } return { s: r.status, d }; };
    const reg = async (n) => (await req('POST', '/api/register', '', { name: n, email: n + '@zf.test', password: 'Passwort123!', country: 'AT', accountType: 'pharma' })).d;
    const A = await reg('alice'); const Bk = await reg('bob');
    const red = (await req('POST', '/api/login', '', { email: 'red@zf.test', password: 'zugriff-PW-1' })).d.token;
    const a = A.token; const b = Bk.token;
    for (const k of [A, Bk]) { await req('POST', '/api/verify/request', k.token, { note: 'Betrieb', licenseNumber: 'AT-1' }); await req('POST', `/api/verify/${k.user.id}/resolve`, red, { approve: true }); }

    // Daten von A
    const ids = {};
    await req('POST', '/api/werbung/firma', a, { firma: 'Alice AG', strasse: 'W 1', plz: '1010', ort: 'Wien', land: 'AT', email: 'r@a.example' });
    ids.k = (await req('POST', '/api/werbung/kampagnen', a, { titel: 'Alice Anzeige', text: 'Text der Anzeige für Apotheken.', link: 'https://example.com', platz: 'start', laender: ['AT'], zielgruppen: ['pharmacy'], wochen: 1, start: new Date().toISOString().slice(0, 10) })).d.kampagne.id;
    await req('POST', `/api/werbung/kampagnen/${ids.k}/einreichen`, a);
    ids.pay = (await req('POST', '/api/payments/crypto/start', a, { productId: 'premium_monthly', walletId: 'btc' })).d.payment_id;
    await req('POST', '/api/rechnungen/angaben', a, { firma: 'Alice AG', strasse: 'W 1', plz: '1010', ort: 'Wien', land: 'AT', email: 'r@a.example' });
    ids.rg = (await req('POST', '/api/rechnungen/ueberweisung', a, { productId: 'premium_monthly' })).d.rechnung.payment_id;
    ids.sf = (await req('POST', '/api/sourcing/anfrage', a, { produkt: 'Amoxicillin', menge: '10', herkunft: 'IN', ziel: 'KE' })).d.id;
    ids.post = (await req('POST', '/api/posts', a, { body: 'Alice Beitrag', visibility: 'public' })).d.id;
    ids.com = (await req('POST', `/api/posts/${ids.post}/comments`, a, { body: 'Alice Kommentar' })).d.id;
    const sh = (await req('POST', '/api/shortages/report', a, { wirkstoff: 'Salbutamol', bezeichnung: 'Salbutamol Inhaler', status: 'kritisch', country: 'AT' })).d;
    ids.sh = sh.id || (sh.shortage && sh.shortage.id);
    ids.lg = (await req('POST', '/api/logistik', a, { art: 'kuehlkette', titel: 'Kühlkette Wien unterbrochen', beschreibung: 'Test', region: 'Wien', dringlichkeit: 'hinweis' })).d.id;
    for (const [k, v] of Object.entries(ids)) assert.ok(v, `${k} nicht angelegt`);

    const versuche = [
      ['POST', `/api/werbung/kampagnen/${ids.k}`, { titel: 'GEHACKT' }], ['POST', `/api/werbung/kampagnen/${ids.k}/einreichen`], ['POST', `/api/werbung/kampagnen/${ids.k}/pause`],
      ['GET', `/api/werbung/kampagnen/${ids.k}/statistik`], ['GET', `/api/werbung/kampagnen/${ids.k}/krypto`], ['POST', `/api/werbung/kampagnen/${ids.k}/krypto/start`, { walletId: 'btc' }],
      ['POST', `/api/werbung/kampagnen/${ids.k}/rechnung`], ['GET', `/api/werbung/kampagnen/${ids.k}/rechnung`],
      ['POST', `/api/werbung/kampagnen/${ids.k}/freigeben`], ['POST', `/api/werbung/kampagnen/${ids.k}/ablehnen`, { grund: 'x' }], ['POST', `/api/werbung/kampagnen/${ids.k}/ueberweisung-verbucht`],
      ['POST', `/api/payments/crypto/${ids.pay}/claim`, { txRef: 'a'.repeat(64) }], ['POST', `/api/payments/${ids.pay}/confirm`], ['POST', `/api/payments/${ids.pay}/reject`, { grund: 'x' }],
      ['POST', `/api/rechnungen/zahlung/${ids.rg}`],
      ['POST', `/api/sourcing/anfragen/${ids.sf}/zurueckziehen`], ['POST', `/api/sourcing/anfragen/${ids.sf}/status`, { status: 'beantwortet', antwort: 'x' }],
      ['POST', `/api/posts/${ids.post}/edit`, { body: 'GEHACKT' }], ['POST', `/api/posts/${ids.post}/delete`],
      ['POST', `/api/comments/${ids.com}/edit`, { body: 'GEHACKT' }], ['POST', `/api/comments/${ids.com}/delete`],
      ['POST', `/api/shortages/${ids.sh}/status`, { status: 'verfuegbar' }], ['POST', `/api/shortages/${ids.sh}/resolve`], ['POST', `/api/shortages/${ids.sh}/expected`, { voraussichtlichBis: '2027-01-01' }],
      ['POST', `/api/shortages/${ids.sh}/report-update`, { status: 'eingeschraenkt' }],
      ['POST', `/api/logistik/${ids.lg}/behoben`], ['POST', `/api/logistik/${ids.lg}/delete`],
      ['GET', `/api/dm/${A.user.id}`],
    ];
    const durch = [];
    for (const [m, p, body] of versuche) { const r = await req(m, p, b, body); if (![403, 404].includes(r.s)) durch.push(`${r.s} ${m} ${p}`); }
    assert.deepEqual(durch, [], 'Konto B kam durch (oder falscher Status statt 403/404)');

    // Daten von A unverändert
    const meine = (await req('GET', '/api/werbung/kampagnen', a)).d.kampagnen.find((x) => x.id === ids.k);
    assert.equal(meine.titel, 'Alice Anzeige');
    const zahl = (await req('GET', '/api/payments/mine', a)).d.payments;
    assert.ok(zahl.find((x) => x.id === ids.pay && x.status === 'pending'), 'Krypto-Zahlung von A verändert');
    const pd = (await req('GET', `/api/posts/${ids.post}`, a)).d;
    assert.equal((pd.post || pd).body, 'Alice Beitrag');
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});
