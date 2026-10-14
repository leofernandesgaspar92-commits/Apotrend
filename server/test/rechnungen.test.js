// Rechnungen für Tarife (services/rechnungen.js) und die gemeinsame
// Rechnungsnummern-Reihe mit den Anzeigen (services/rechnungsnummern.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRechnungen } from '../src/services/rechnungen.js';
import { createRechnungsnummern } from '../src/services/rechnungsnummern.js';
import { createAnzeigen } from '../src/services/anzeigen.js';
import { getProduct } from '../src/data/products.js';

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'http', 'server.js');
const JAHR = new Date().getUTCFullYear();
const BETREIBER = { firma: 'ApoPulse Test GmbH', anschrift: 'Ring 1, 1010 Wien', iban: 'AT00 1234', ust_satz: 20 };
const ANGABEN = { firma: 'Großhandel Nord GmbH', strasse: 'Hafen 2', plz: '20457', ort: 'Hamburg', land: 'de', email: 'rechnung@gh.example' };

function zahlungen() {
  const liste = new Map(); let n = 0;
  return {
    neu(p) { const id = 'p' + (++n); liste.set(id, { id, currency: 'EUR', paid_at: null, ...p }); return id; },
    zahlung: (id) => (liste.has(id) ? { ...liste.get(id) } : null),
    zahlungenVon: (uid) => [...liste.values()].filter((p) => p.user_id === uid),
    ueberweisungAnlegen(uid, productId) { const id = this.neu({ user_id: uid, product_id: productId, amount_cents: getProduct(productId).amount_cents, method: 'invoice', status: 'pending_review' }); return this.zahlung(id); },
    ueberweisungVermerken() {},
    bezahlt(id) { Object.assign(liste.get(id), { status: 'paid', paid_at: '2026-10-14T09:00:00.000Z' }); },
  };
}

test('Gemeinsame Reihe: Anzeigen und Tarife ziehen fortlaufend aus EINEM Zähler', () => {
  const nummern = createRechnungsnummern();
  const anz = createAnzeigen({ nummern, plaetze: {} });
  // Sicherung aus der Zeit vor der gemeinsamen Reihe: Anzeigen standen bei 7.
  anz.__load({ zaehler: 0, rechnungsNr: 7, kampagnen: [], kunden: [], ausgeblendet: [] });
  assert.equal(nummern.naechste(), `AP-${JAHR}-0008`, 'Nummer doppelt vergeben');
  const z = zahlungen();
  const rg = createRechnungen({ betreiber: BETREIBER, nummern, payments: z, produkt: getProduct });
  rg.angabenSetzen('u1', ANGABEN);
  assert.equal(rg.perRechnungBestellen('u1', 'premium_yearly').nummer, `AP-${JAHR}-0009`);
});

test('Beträge, Festschreibung, Grenzen', () => {
  const z = zahlungen();
  const rg = createRechnungen({ betreiber: BETREIBER, nummern: createRechnungsnummern(), payments: z, produkt: getProduct });
  assert.throws(() => rg.perRechnungBestellen('u1', 'business_yearly'), (e) => e.code === 'rechnung_angaben_fehlen');
  assert.throws(() => rg.angabenSetzen('u1', { ...ANGABEN, email: 'kaputt' }), (e) => e.code === 'rechnung_email');
  assert.equal(rg.angabenSetzen('u1', ANGABEN).land, 'DE');
  const r = rg.perRechnungBestellen('u1', 'business_yearly');
  // Tarifpreis ist der Endpreis; die Rechnung weist die enthaltene USt aus.
  assert.deepEqual([r.brutto_cents, r.ust_cents, r.netto_cents, r.ust_satz], [99000, 16500, 82500, 20]);
  assert.equal(r.bezahlt, false);
  assert.equal(r.zahlart.art, 'ueberweisung');
  // Zweimal bestellt: dieselbe offene Rechnung, kein Stapel.
  assert.equal(rg.perRechnungBestellen('u1', 'business_yearly').nummer, r.nummer);
  // Angaben ändern: ausgestellte Rechnung bleibt, wie sie war.
  rg.angabenSetzen('u1', { ...ANGABEN, firma: 'Umbenannt AG' });
  assert.equal(rg.rechnung('u1', r.nummer).empfaenger.firma, 'Großhandel Nord GmbH');
  assert.throws(() => rg.rechnung('u2', r.nummer), (e) => e.status === 404, 'fremde Rechnung lesbar');
  // Beleg nur für bezahlte, eigene Zahlungen.
  const offen = z.neu({ user_id: 'u1', product_id: 'premium_monthly', amount_cents: 999, method: 'crypto_direct', coin: 'bitcoin', status: 'pending_review' });
  assert.throws(() => rg.fuerZahlung('u1', offen), (e) => e.code === 'rechnung_unbezahlt');
  z.bezahlt(offen);
  assert.throws(() => rg.fuerZahlung('u2', offen), (e) => e.status === 404);
  assert.equal(rg.meine('u1').ohne_rechnung.length, 1);
  const beleg = rg.fuerZahlung('u1', offen);
  assert.deepEqual([beleg.bezahlt, beleg.zahlart.art, beleg.zahlart.coin, beleg.brutto_cents, beleg.ust_cents], [true, 'krypto', 'bitcoin', 999, 167]);
  assert.equal(rg.fuerZahlung('u1', offen).nummer, beleg.nummer, 'zweiter Abruf stellt eine zweite Rechnung aus');
  assert.equal(rg.meine('u1').ohne_rechnung.length, 0);
  // Konto gelöscht: Angaben weg, Rechnungen bleiben (Aufbewahrungspflicht).
  rg.nutzerEntfernen('u1');
  assert.equal(rg.angaben('u1'), null);
  assert.equal(JSON.parse(JSON.stringify(rg.__dump())).rechnungen.length, 2);
});

test('Ohne Rechnungssteller keine Rechnung, ohne IBAN keine Überweisung', () => {
  const z = zahlungen();
  const ohneIban = createRechnungen({ betreiber: { firma: 'A', anschrift: 'B' }, nummern: createRechnungsnummern(), payments: z, produkt: getProduct });
  ohneIban.angabenSetzen('u1', ANGABEN);
  assert.equal(ohneIban.rechnungMoeglich(), true);
  assert.throws(() => ohneIban.perRechnungBestellen('u1', 'premium_yearly'), (e) => e.code === 'ueberweisung_aus');
  const nichts = createRechnungen({ betreiber: {}, nummern: createRechnungsnummern(), payments: z, produkt: getProduct });
  nichts.angabenSetzen('u1', ANGABEN);
  const id = z.neu({ user_id: 'u1', product_id: 'premium_monthly', amount_cents: 999, method: 'crypto_direct', status: 'paid' });
  assert.throws(() => nichts.fuerZahlung('u1', id), (e) => e.code === 'rechnung_aus');
});

async function starte(env) {
  const kind = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'rechnung-test', APOPULSE_PRESSE: 'aus',
      APOPULSE_ADMIN_EMAIL: 'red@rg.test', APOPULSE_ADMIN_PASSWORD: 'rechnung-test-123',
      APOPULSE_FIRMA_NAME: BETREIBER.firma, APOPULSE_FIRMA_ANSCHRIFT: BETREIBER.anschrift, APOPULSE_BANK_IBAN: BETREIBER.iban, APOPULSE_UST_SATZ: '20', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  const port = await new Promise((ok, fail) => {
    const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
    const lies = (d) => { log += d; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
    kind.stdout.on('data', lies); kind.stderr.on('data', lies);
    kind.on('exit', (c) => { clearTimeout(zeit); fail(new Error(`Server beendet (${c}):\n${log}`)); });
  });
  const B = `http://localhost:${port}`;
  const H = (t) => ({ 'content-type': 'application/json', ...(t ? { authorization: 'Bearer ' + t } : {}) });
  const req = async (m, pfad, t, body) => { const r = await fetch(B + pfad, { method: m, headers: H(t), body: body ? JSON.stringify(body) : undefined }); return { status: r.status, d: await r.json() }; };
  const stopp = () => new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  return { req, stopp };
}

test('Über HTTP: per Rechnung kaufen, Beleg nach Krypto, Anzeige in derselben Reihe, Neustart', { timeout: 90000 }, async () => {
  const ordner = mkdtempSync(join(tmpdir(), 'rg-'));
  const datei = join(ordner, 'stand.json');
  let s = await starte({ APOPULSE_DATA_FILE: datei });
  try {
    let { req } = s;
    const red = (await req('POST', '/api/login', '', { email: 'red@rg.test', password: 'rechnung-test-123' })).d.token;
    const gh = (await req('POST', '/api/register', '', { name: 'Grosshandel Nord', email: 'gh@rg.test', password: 'Passwort123!', country: 'DE', accountType: 'wholesale' })).d.token;
    const fremd = (await req('POST', '/api/register', '', { name: 'Fremd', email: 'fremd@rg.test', password: 'Passwort123!', country: 'DE', accountType: 'pharmacy' })).d.token;

    let st = (await req('GET', '/api/rechnungen', gh)).d;
    assert.deepEqual([st.moeglich, st.ueberweisung, st.angaben], [true, true, null]);
    assert.equal((await req('POST', '/api/rechnungen/ueberweisung', gh, { productId: 'business_yearly' })).status, 409);
    assert.equal((await req('POST', '/api/rechnungen/angaben', gh, ANGABEN)).status, 200);

    // 1) Per Rechnung: Rechnung sofort, Tarif erst nach Zahlungseingang.
    const r1 = (await req('POST', '/api/rechnungen/ueberweisung', gh, { productId: 'business_yearly' })).d.rechnung;
    assert.equal(r1.nummer, `AP-${JAHR}-0001`);
    assert.deepEqual([r1.brutto_cents, r1.ust_cents, r1.bezahlt, r1.aussteller.iban], [99000, 16500, false, BETREIBER.iban]);
    assert.equal((await req('GET', '/api/me/premium', gh)).d.premium, false, 'Tarif vor Zahlungseingang frei');
    const offen = (await req('GET', '/api/payments/pending', red)).d.payments.find((p) => p.method === 'invoice');
    assert.equal(offen.bezeichnung, `Rechnung ${r1.nummer}`);
    assert.equal((await req('POST', `/api/payments/${offen.id}/confirm`, red)).status, 200);
    assert.equal((await req('GET', '/api/me/premium', gh)).d.premium, true);
    assert.equal((await req('GET', '/api/daten-api/schluessel', gh)).d.berechtigt, true, 'Business nach Überweisung nicht frei');
    const r1b = (await req('GET', `/api/rechnungen/${r1.nummer}`, gh)).d.rechnung;
    assert.deepEqual([r1b.bezahlt, r1b.zahlart.art], [true, 'ueberweisung']);
    assert.equal((await req('GET', `/api/rechnungen/${r1.nummer}`, fremd)).status, 404);

    // 2) Krypto bezahlt -> Beleg auf Knopfdruck.
    const opt = (await req('GET', '/api/payments/crypto?product=premium_monthly')).d;
    const btc = opt.coins.find((c) => c.coin === 'bitcoin');
    const start = (await req('POST', '/api/payments/crypto/start', gh, { productId: 'premium_monthly', walletId: btc.id })).d;
    const tx = Array.from({ length: 64 }, (_, i) => '0123456789abcdef'[(i * 3 + 5) % 16]).join('');
    await req('POST', `/api/payments/crypto/${start.payment_id}/claim`, gh, { txRef: tx });
    await req('POST', `/api/payments/${start.payment_id}/confirm`, red);
    st = (await req('GET', '/api/rechnungen', gh)).d;
    assert.deepEqual(st.ohne_rechnung.map((p) => p.payment_id), [start.payment_id]);
    const r2 = (await req('POST', `/api/rechnungen/zahlung/${start.payment_id}`, gh)).d.rechnung;
    assert.deepEqual([r2.nummer, r2.zahlart.art, r2.zahlart.coin, r2.bezahlt], [`AP-${JAHR}-0002`, 'krypto', 'bitcoin', true]);
    assert.equal((await req('POST', `/api/rechnungen/zahlung/${start.payment_id}`, fremd)).status, 404);

    // 3) Anzeigen-Rechnung zieht aus DERSELBEN Reihe.
    await req('POST', '/api/werbung/firma', gh, { firma: 'Großhandel Nord GmbH', strasse: 'Hafen 2', plz: '20457', ort: 'Hamburg', land: 'DE', email: 'rechnung@gh.example' });
    const k = (await req('POST', '/api/werbung/kampagnen', gh, { titel: 'Express-Zustellung', text: 'Noch am selben Tag.', link: 'https://example.com', platz: 'feed', laender: ['DE'], zielgruppen: ['pharmacy'], wochen: 1, start: new Date().toISOString().slice(0, 10) })).d.kampagne;
    await req('POST', `/api/werbung/kampagnen/${k.id}/einreichen`, gh);
    await req('POST', `/api/werbung/kampagnen/${k.id}/freigeben`, red);
    const ra = (await req('POST', `/api/werbung/kampagnen/${k.id}/rechnung`, gh)).d.rechnung;
    assert.equal(ra.nummer, `AP-${JAHR}-0003`, 'Anzeige und Tarif mit derselben Nummer');

    // 4) Neustart: Rechnungen da, Reihe läuft weiter (Sicherung wird verzögert geschrieben).
    await new Promise((ok) => setTimeout(ok, 1500));
    await s.stopp();
    s = await starte({ APOPULSE_DATA_FILE: datei });
    req = s.req;
    const gh2 = (await req('POST', '/api/login', '', { email: 'gh@rg.test', password: 'Passwort123!' })).d.token;
    assert.equal((await req('GET', `/api/rechnungen/${r1.nummer}`, gh2)).d.rechnung.empfaenger.firma, 'Großhandel Nord GmbH');
    const r4 = (await req('POST', '/api/rechnungen/ueberweisung', gh2, { productId: 'premium_yearly' })).d.rechnung;
    assert.equal(r4.nummer, `AP-${JAHR}-0004`, 'Reihe nach Neustart zurückgesetzt');
  } finally {
    await s.stopp();
    rmSync(ordner, { recursive: true, force: true });
  }
});
