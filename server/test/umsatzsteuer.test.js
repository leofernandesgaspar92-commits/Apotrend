// Umsatzsteuer für Empfänger außerhalb der EU (domain/umsatzsteuer.js): Mit
// APOPULSE_UST_SATZ=20 wies jede Rechnung 20 % aus — auch für eine Apotheke in
// Uganda. Bei Anzeigen (Netto + USt) zahlte eine Firma in Nairobi dadurch 20 % mehr.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ustFuerEmpfaenger, EU_LAENDER } from '../src/domain/umsatzsteuer.js';
import { createAnzeigen } from '../src/services/anzeigen.js';
import { werbeplaetzeAusUmgebung } from '../src/data/werbeplaetze.js';

const HIER = dirname(fileURLToPath(import.meta.url));

test('Grundregel: außerhalb der EU keine EU-Umsatzsteuer, im Zweifel mit Steuer', () => {
  for (const l of ['UG', 'KE', 'NG', 'ZA', 'CH', 'GB', 'US', 'ke']) assert.deepEqual(ustFuerEmpfaenger(20, l), { satz: 0, hinweis: 'drittland' }, l);
  for (const l of ['AT', 'DE', 'PT', 'GR', 'IE']) assert.deepEqual(ustFuerEmpfaenger(20, l), { satz: 20, hinweis: null }, l);
  for (const l of ['', null, undefined, 'Kenia', 'X']) assert.equal(ustFuerEmpfaenger(20, l).satz, 20, `unklar (${l}) → mit Steuer`);
  assert.deepEqual(ustFuerEmpfaenger(0, 'UG'), { satz: 0, hinweis: null }, 'ohne Satz kein Hinweis');
  assert.equal(ustFuerEmpfaenger(20, 'UG', { drittlandMitSteuer: true }).satz, 20, 'altes Verhalten einschaltbar');
  assert.equal(EU_LAENDER.size, 27);
});

test('Anzeige einer Firma in Nairobi: Rechnung und Krypto-Betrag ohne Steuer, mit Hinweis; Wien unverändert', () => {
  const PROFILE = { nairobi: { account_type: 'pharma', country: 'KE' }, wien: { account_type: 'pharma', country: 'AT' }, red: { account_type: 'pharmacy', country: 'AT' } };
  const a = createAnzeigen({
    jetzt: () => Date.parse('2026-10-22T08:00:00Z'), plaetze: werbeplaetzeAusUmgebung({}), profilVon: (u) => PROFILE[u] || null,
    istModerator: (u) => u === 'red', moderatoren: () => ['red'], benachrichtige: () => {},
    betreiber: { firma: 'ApoPulse', anschrift: 'Ring 1, 1010 Wien', iban: 'AT00 0000 0000 0000 0000', ust_satz: 20 },
  });
  const buche = (uid, land) => {
    a.firmaSetzen(uid, { firma: 'Firma ' + uid, strasse: 'Weg 1', plz: '100', ort: 'Ort', land, email: `r@${uid}.example` });
    const k = a.anlegen(uid, { titel: 'Kühlkette für Apotheken', text: 'Temperaturgeführte Lagerung und Zustellung, 2–8 °C.', link: 'https://example.com/k',
      platz: 'start', laender: [land], zielgruppen: ['pharmacy'], wochen: 1, start: '2026-10-22' });
    a.einreichen(uid, k.id); a.freigeben('red', k.id);
    return { r: a.rechnungAusstellen(uid, k.id).rechnung, zahlung: a.kampagneFuerZahlung(uid, k.id) };
  };
  const ke = buche('nairobi', 'KE');
  assert.equal(ke.r.ust_satz, 0); assert.equal(ke.r.ust_cents, 0); assert.equal(ke.r.ust_hinweis, 'drittland');
  assert.equal(ke.r.brutto_cents, ke.r.netto_cents);
  assert.equal(ke.zahlung.betrag_cents, ke.r.brutto_cents, 'Krypto verlangt denselben Betrag wie die Rechnung');
  const at = buche('wien', 'AT');
  assert.equal(at.r.ust_satz, 20); assert.equal(at.r.ust_hinweis, null);
  assert.equal(at.zahlung.betrag_cents, at.r.brutto_cents);
});

test('Über HTTP: Tarif-Rechnung (Überweisung) Uganda ohne Steuer, Österreich mit 20 % enthalten', { timeout: 90000 }, async () => {
  const env = { ...process.env, PORT: '0', APOPULSE_TOKEN_SECRET: 'umsatzsteuer-test-12345', APOPULSE_DATA_FILE: '', APOPULSE_PRESSE: 'aus',
    APOPULSE_FIRMA_NAME: 'Prüfbetrieb GmbH', APOPULSE_FIRMA_ANSCHRIFT: 'Prüfweg 1, 1010 Wien', APOPULSE_BANK_IBAN: 'AT00 0000 0000 0000 0000', APOPULSE_UST_SATZ: '20' };
  delete env.APOPULSE_UST_DRITTLAND; delete env.APOPULSE_PREISE_REGION;
  const kind = spawn(process.execPath, [join(HIER, '..', 'src', 'http', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  try {
    const port = await new Promise((ok, fail) => {
      const zeit = setTimeout(() => fail(new Error('Server kam nicht hoch:\n' + log)), 20000);
      const lies = (x) => { log += x; const m = log.match(/läuft auf http:\/\/localhost:(\d+)/); if (m) { clearTimeout(zeit); ok(Number(m[1])); } };
      kind.stdout.on('data', lies); kind.stderr.on('data', lies);
      kind.on('exit', (c) => { clearTimeout(zeit); fail(new Error(`Server beendet (${c}):\n${log}`)); });
    });
    const B = `http://localhost:${port}`;
    const j = async (pfad, opt = {}) => (await fetch(B + pfad, opt)).json();
    const H = (t) => ({ 'content-type': 'application/json', authorization: 'Bearer ' + t });
    const rechnung = async (land) => {
      const tok = (await j('/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Apo ' + land, email: `${land}@ust.test`, password: 'Passwort123!', country: land, accountType: 'pharmacy' }) })).token;
      await j('/api/rechnungen/angaben', { method: 'POST', headers: H(tok), body: JSON.stringify({ firma: 'Apotheke ' + land, strasse: 'Weg 1', plz: '1', ort: 'Ort', land, email: `b@${land}.test` }) });
      return (await j('/api/rechnungen/ueberweisung', { method: 'POST', headers: H(tok), body: JSON.stringify({ productId: 'premium_monthly' }) })).rechnung;
    };
    const ug = await rechnung('UG');
    assert.deepEqual([ug.brutto_cents, ug.ust_satz, ug.ust_cents, ug.netto_cents, ug.ust_hinweis], [300, 0, 0, 300, 'drittland'], 'Afrika-Preis, keine Steuer');
    const at = await rechnung('AT');
    assert.deepEqual([at.brutto_cents, at.ust_satz, at.ust_cents, at.ust_hinweis], [999, 20, 167, null], '20 % im Endpreis enthalten');
  } finally {
    await new Promise((ok) => { if (kind.exitCode !== null) return ok(); kind.once('exit', ok); kind.kill(); });
  }
});
