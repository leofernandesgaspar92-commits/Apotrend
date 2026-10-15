// Regionale Premium-Preise (domain/regionPreis.js). Wie viel günstiger,
// entscheidet der Betreiber mit EINER Einstellung (APOPULSE_PREISE_REGION).
// Geprüft wird, dass jeder Zahlweg denselben Betrag nimmt und dass niemand
// über die Ansicht eines anderen Landes günstiger kauft.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { regionFaktoren, preisCents } from '../src/domain/regionPreis.js';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'http', 'server.js');

test('Einstellung lesen: nur Ermäßigungen 1–100 %, bekannte Regionen, Ungültiges ignoriert', () => {
  assert.deepEqual([...regionFaktoren('AFRICA:30')], [['AFRICA', 30]]);
  assert.deepEqual([...regionFaktoren(' africa : 30 %, AMERICAS:80 ')], [['AFRICA', 30], ['AMERICAS', 80]]);
  for (const x of ['', 'AFRICA:0', 'AFRICA:150', 'MARS:30', 'AFRICA', 'AFRICA:-5']) assert.equal(regionFaktoren(x).size, 0, x);
  const f = regionFaktoren('AFRICA:30');
  assert.equal(preisCents({ feature: 'premium', amount_cents: 999 }, 'AFRICA', f), 300);
  assert.equal(preisCents({ feature: 'premium', amount_cents: 9900 }, 'AFRICA', f), 2970);
  assert.equal(preisCents({ feature: 'premium', amount_cents: 999 }, 'EUROPE', f), 999);
  assert.equal(preisCents({ feature: 'api', amount_cents: 9900 }, 'AFRICA', f), 9900, 'Business ermäßigt');
  assert.equal(preisCents({ feature: 'premium', amount_cents: 999 }, null, f), 999);
});

async function starte(extra) {
  const env = { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'region-preis-test-123', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus',
    APOPULSE_FIRMA_NAME: 'Prüfbetrieb GmbH', APOPULSE_FIRMA_ANSCHRIFT: 'Prüfweg 1, 1010 Wien', APOPULSE_BANK_IBAN: 'AT00 0000 0000 0000 0000', ...extra };
  if (!('APOPULSE_PREISE_REGION' in extra)) delete env.APOPULSE_PREISE_REGION;
  const kind = spawn(process.execPath, [SERVER], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  const port = await new Promise((ok, fail) => {
    const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
    const lies = (x) => { log += x; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
    kind.stdout.on('data', lies); kind.stderr.on('data', lies);
    kind.on('exit', (c) => { clearTimeout(zeit); fail(new Error(`Server beendet (${c}):\n${log}`)); });
  });
  const B = `http://localhost:${port}`;
  const H = (t) => ({ 'content-type': 'application/json', ...(t ? { authorization: 'Bearer ' + t } : {}) });
  const j = async (pfad, opt = {}) => (await fetch(B + pfad, opt)).json();
  const konto = async (land) => (await j('/api/register', { method: 'POST', headers: H(), body: JSON.stringify({ name: 'Apo ' + land, email: `${land}@rp.test`, password: 'Passwort123!', country: land, accountType: 'pharmacy' }) })).token;
  const ende = () => new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  return { j, H, konto, ende };
}

test('Über HTTP mit AFRICA:30: Uganda zahlt 3,00 € überall, Österreich 9,99 €, Ansicht eines anderen Landes zählt nicht', { timeout: 90000 }, async () => {
  const s = await starte({ APOPULSE_PREISE_REGION: 'AFRICA:30' });
  try {
    const ug = await s.konto('UG'); const at = await s.konto('AT');
    // Anzeige (Premium-Seite): eingeloggt zählt das Heimatland — auch mit ?country=UG für Österreich.
    assert.equal((await s.j('/api/payments/crypto?product=premium_monthly&country=UG', { headers: s.H(ug) })).amount, 3);
    assert.equal((await s.j('/api/payments/crypto?product=premium_monthly&country=UG', { headers: s.H(at) })).amount, 9.99, 'Ansicht Uganda macht Österreich günstiger');
    // Ohne Anmeldung: angefragtes Land (nur Anzeige — gezahlt wird angemeldet).
    assert.equal((await s.j('/api/payments/crypto?product=premium_monthly&country=UG')).amount, 3);
    // Laufzeit-Wahl (Ersparnis Jahr vs. Monat) mit denselben Preisen.
    const pr = (await s.j('/api/payments/products', { headers: s.H(ug) })).products;
    assert.deepEqual([pr.find((p) => p.id === 'premium_monthly').amount_cents, pr.find((p) => p.id === 'premium_yearly').amount_cents, pr.find((p) => p.id === 'business_monthly').amount_cents], [300, 2970, 9900]);
    // Krypto-Start: gespeicherter Betrag = angezeigter Betrag.
    const k = await s.j('/api/payments/crypto/start', { method: 'POST', headers: s.H(ug), body: JSON.stringify({ productId: 'premium_monthly', walletId: 'btc' }) });
    const meine = (await s.j('/api/payments/mine', { headers: s.H(ug) }));
    const z = (meine.payments || meine).find((p) => p.id === k.payment_id);
    assert.equal(z.amount_cents, 300);
    const kat = await s.j('/api/payments/crypto/start', { method: 'POST', headers: s.H(at), body: JSON.stringify({ productId: 'premium_monthly', walletId: 'btc' }) });
    const zat = ((await s.j('/api/payments/mine', { headers: s.H(at) })).payments || []).find((p) => p.id === kat.payment_id);
    assert.equal(zat.amount_cents, 999);
    // Überweisung + Rechnung mit demselben Betrag.
    await s.j('/api/rechnungen/angaben', { method: 'POST', headers: s.H(ug), body: JSON.stringify({ firma: 'Mukasa Pharmacy', strasse: 'Kampala Road 1', plz: '256', ort: 'Kampala', land: 'UG', email: 'buch@mukasa.test' }) });
    const r = (await s.j('/api/rechnungen/ueberweisung', { method: 'POST', headers: s.H(ug), body: JSON.stringify({ productId: 'premium_monthly' }) })).rechnung;
    assert.equal(r.betrag ? r.betrag.brutto_cents : r.brutto_cents, 300, 'Rechnung mit Listenpreis: ' + JSON.stringify(r).slice(0, 200));
  } finally { await s.ende(); }
});

test('Über HTTP ohne Einstellung: unverändert 9,99 € auch in Uganda', { timeout: 60000 }, async () => {
  const s = await starte({});
  try {
    const ug = await s.konto('UG');
    assert.equal((await s.j('/api/payments/crypto?product=premium_monthly', { headers: s.H(ug) })).amount, 9.99);
  } finally { await s.ende(); }
});
