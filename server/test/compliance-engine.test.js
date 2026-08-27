// ============================================================================
//  Dynamic Country Compliance Engine — Tests
// ============================================================================
//  Der wichtigste Test dieser Datei ist der erste: Er prüft ALLE Länder gegen
//  ALLE Zahlungszwecke darauf, dass die Krypto-Schiene vorhanden ist. Damit ist
//  die Owner-Vorgabe „Krypto darf nie entfernt werden" keine Bitte im Kommentar,
//  sondern eine Zusicherung, die beim nächsten Länderfilter rot wird.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COMPLIANCE_PROFILES,
  CRYPTO_METHODS,
  MARKETPLACE_FEES,
  PURPOSES,
  SAAS_ONLY,
  assertCryptoAvailable,
  availablePurposes,
  calculateFee,
  checkoutFieldsFor,
  complianceProfile,
  createComplianceManager,
  feeModel,
  formatAmount,
  paymentMethodsFor,
} from '../src/domain/compliance.js';
import { plansForCountry, priceFor } from '../src/data/plans.js';

const ALL_COUNTRIES = Object.keys(COMPLIANCE_PROFILES);

// --- Das Krypto-Gebot -------------------------------------------------------

test('Krypto ist in JEDEM Land und JEDEM Zweck verfügbar', () => {
  let checked = 0;
  for (const country of ALL_COUNTRIES) {
    for (const purpose of PURPOSES) {
      if (!availablePurposes(country).includes(purpose)) continue;
      const methods = paymentMethodsFor(country, purpose);
      const crypto = methods.filter((m) => m.rail === 'crypto');
      assert.equal(
        crypto.length, CRYPTO_METHODS.length,
        `${country}/${purpose}: Krypto-Methoden fehlen oder wurden gefiltert`,
      );
      checked++;
    }
  }
  // Absicherung gegen einen Test, der nichts prüft, weil die Schleife leer bleibt.
  assert.ok(checked >= ALL_COUNTRIES.length, `zu wenige Kombinationen geprüft: ${checked}`);
});

test('USDT, USDC, BTC, ETH, SOL und WalletConnect sind überall dabei', () => {
  for (const country of ALL_COUNTRIES) {
    const ids = paymentMethodsFor(country, 'saas_license')
      .filter((m) => m.rail === 'crypto')
      .map((m) => m.id);
    for (const required of ['usdt', 'usdc', 'btc', 'eth', 'sol', 'walletconnect']) {
      assert.ok(ids.includes(required), `${country}: ${required} fehlt`);
    }
  }
});

test('Der Wächter schlägt an, wenn jemand die Krypto-Schiene wegfiltert', () => {
  const nurFiat = paymentMethodsFor('DE', 'saas_license').filter((m) => m.rail === 'fiat');
  assert.throws(
    () => assertCryptoAvailable(nurFiat, 'DE', 'saas_license'),
    (e) => e.code === 'crypto_rail_missing',
  );
});

// --- DACH: keine Provision auf Arzneimittel ---------------------------------

test('DACH läuft im SaaS-Modus ohne Transaktionsgebühren', () => {
  for (const country of ['AT', 'DE', 'CH', 'LI']) {
    const p = complianceProfile(country);
    assert.equal(p.commerceMode, SAAS_ONLY, `${country}`);
    assert.equal(p.transactionFeeAllowed, false, `${country}`);
  }
});

test('Eine Marktplatz-Bestellung ist in DACH gar nicht erst möglich', () => {
  for (const country of ['AT', 'DE', 'CH', 'LI']) {
    assert.ok(!availablePurposes(country).includes('marketplace_order'), country);
    assert.throws(
      () => paymentMethodsFor(country, 'marketplace_order'),
      (e) => e.code === 'marketplace_disabled',
      country,
    );
    assert.throws(
      () => feeModel(country, 'marketplace_order'),
      (e) => e.code === 'commission_forbidden',
      country,
    );
  }
});

test('In DACH gibt es auf die Lizenz nur eine Pauschale, nie Prozente', () => {
  const model = feeModel('AT', 'saas_license');
  assert.equal(model.kind, 'SAAS_FLAT');
  assert.equal(model.bps, 0);
  assert.equal(calculateFee(2_000_00, 'DE', 'saas_license').feeMinor, 0);
});

// --- Afrikanische Märkte: Marktplatz mit Gebühren ---------------------------

test('Angola, Nigeria und Kenia rechnen Marktplatz-Gebühren ab', () => {
  for (const country of ['AO', 'NG', 'KE']) {
    const p = complianceProfile(country);
    assert.equal(p.commerceMode, MARKETPLACE_FEES, country);
    assert.ok(availablePurposes(country).includes('marketplace_order'), country);

    const model = feeModel(country, 'marketplace_order');
    assert.equal(model.kind, 'COMMISSION_FEE', country);
    assert.ok(model.bps > 0, country);
  }
});

test('Die Gebühr wird korrekt aus Basispunkten gerechnet', () => {
  // Angola: 250 bps Vermittlung + 150 bps Logistik = 400 bps = 4 %.
  const q = calculateFee(1_000_000, 'AO', 'marketplace_order'); // 10.000,00 AOA
  assert.equal(q.kind, 'COMMISSION_FEE');
  assert.equal(q.bps, 400);
  assert.equal(q.feeMinor, 40_000);
  assert.equal(q.netMinor, 960_000);
});

test('Import-Nachweise sind nur bei Warenbestellungen Pflicht, nicht beim Abo', () => {
  const beiWare = checkoutFieldsFor('AO', 'marketplace_order').map((f) => f.id);
  assert.ok(beiWare.includes('import_licence'));
  assert.ok(beiWare.includes('gmp_certificate'));

  // Eine Software-Lizenz hat keine Ware — ein Zertifikat dafür wäre eine
  // Hürde ohne sachlichen Grund.
  const beiAbo = checkoutFieldsFor('AO', 'saas_license').map((f) => f.id);
  assert.ok(!beiAbo.includes('import_licence'));
  assert.ok(!beiAbo.includes('gmp_certificate'));
});

// --- USA: Rückverfolgbarkeit -------------------------------------------------

test('USA verlangt die FDA-Registrierungsnummer im Checkout', () => {
  const fields = checkoutFieldsFor('US', 'saas_license');
  const fda = fields.find((f) => f.id === 'fda_registration');
  assert.ok(fda, 'FDA-Feld fehlt');
  assert.equal(fda.required, true);
  assert.match(fda.legalBasis, /DSCSA/);

  // Die Prüfregel muss als echter regulärer Ausdruck taugen.
  const re = new RegExp(fda.pattern);
  assert.ok(re.test('3001234567'));
  assert.ok(!re.test('ABC'));
});

test('Das FDA-Feld erscheint NUR in den USA', () => {
  for (const country of ALL_COUNTRIES) {
    const ids = checkoutFieldsFor(country, 'saas_license').map((f) => f.id);
    assert.equal(
      ids.includes('fda_registration'), country === 'US',
      `${country} sollte das FDA-Feld ${country === 'US' ? 'haben' : 'nicht haben'}`,
    );
  }
});

test('USA führt DSCSA als Rückverfolgbarkeits-Rahmen', () => {
  assert.equal(complianceProfile('US').traceability, 'DSCSA');
});

// --- Lokale Zahlwege ---------------------------------------------------------

test('Jedes Land bekommt seine lokal üblichen Zahlwege', () => {
  const idsFor = (c) => paymentMethodsFor(c, 'saas_license').map((m) => m.id);

  assert.ok(idsFor('PT').includes('mbway'), 'PT braucht MB WAY');
  assert.ok(idsFor('AO').includes('multicaixa'), 'AO braucht Multicaixa');
  assert.ok(idsFor('KE').includes('mpesa'), 'KE braucht M-Pesa');
  assert.ok(idsFor('BR').includes('pix'), 'BR braucht Pix');
  assert.ok(idsFor('US').includes('ach'), 'US braucht ACH');
  assert.ok(idsFor('DE').includes('sepa'), 'DE braucht SEPA');
});

test('SEPA erscheint nicht außerhalb des SEPA-Raums', () => {
  for (const country of ['US', 'AO', 'KE', 'NG', 'BR', 'GB', 'CH', 'AU', 'ZA']) {
    const ids = paymentMethodsFor(country, 'saas_license').map((m) => m.id);
    assert.ok(!ids.includes('sepa'), `${country} sollte kein SEPA-Lastschriftverfahren anbieten`);
  }
});

test('Rechnung auf 30 Tage gibt es nicht bei der Guthaben-Aufladung', () => {
  const ids = paymentMethodsFor('DE', 'merchant_credit').map((m) => m.id);
  assert.ok(!ids.includes('invoice'));
  // Krypto bleibt selbstverständlich auch hier.
  assert.ok(ids.includes('usdt'));
});

// --- Währungen ---------------------------------------------------------------

test('Beträge werden in der Landeswährung ausgewiesen', () => {
  assert.equal(complianceProfile('AT').currency, 'EUR');
  assert.equal(complianceProfile('CH').currency, 'CHF');
  assert.equal(complianceProfile('AO').currency, 'AOA');
  assert.equal(complianceProfile('US').currency, 'USD');
});

test('formatAmount stürzt bei unbekannter Währung nicht ab', () => {
  // Ein wohlgeformter, aber unbekannter ISO-Code wird von Intl anstandslos
  // formatiert — der catch-Zweig greift hier gar nicht.
  assert.match(formatAmount(1234, 'XYZ'), /12[.,]34\s*XYZ/);

  // Ein MALFORMED Code lässt Intl mit RangeError scheitern. Genau dafür ist der
  // Rückfall da: lieber roh anzeigen als die Seite mitreißen.
  assert.match(formatAmount(1234, 'X'), /^12\.34 X$/);
});

test('formatAmount nennt Währung und Betrag', () => {
  const eur = formatAmount(4900, 'EUR');
  assert.match(eur, /49/);
  const usd = formatAmount(5400, 'USD', 'en-US');
  assert.match(usd, /\$54\.00/);
});

// --- Abo-Katalog -------------------------------------------------------------

test('Pläne werden in der Landeswährung bepreist', () => {
  const at = plansForCountry('AT');
  assert.ok(at.every((p) => p.currency === 'EUR'));
  assert.ok(at.every((p) => !p.billed_in_foreign_currency));

  const ao = plansForCountry('AO');
  assert.ok(ao.every((p) => p.currency === 'AOA'));
});

test('Der Logistik-Plan erscheint nur, wo es einen Marktplatz gibt', () => {
  const de = plansForCountry('DE').map((p) => p.id);
  assert.ok(!de.includes('apo_logistics'), 'ohne Marktplatz kein Logistik-Plan');

  const ao = plansForCountry('AO').map((p) => p.id);
  assert.ok(ao.includes('apo_logistics'));
});

test('Jahrespreis liegt unter zwölf Monatspreisen', () => {
  for (const country of ['AT', 'US', 'AO']) {
    const monthly = plansForCountry(country, { interval: 'monthly' });
    const yearly = plansForCountry(country, { interval: 'yearly' });
    for (const y of yearly) {
      const m = monthly.find((x) => x.id === y.id);
      assert.ok(y.amount_minor < m.amount_minor * 12, `${country}/${y.id}`);
    }
  }
});

test('priceFor liefert einen abrechenbaren Datensatz', () => {
  const p = priceFor('apo_pro', 'PT', 'monthly');
  assert.deepEqual(p, { plan_id: 'apo_pro', currency: 'EUR', amount_minor: 14900, interval: 'monthly' });
});

// --- Der Zustands-Manager ----------------------------------------------------

test('Der Länderwechsel schaltet Modus, Währung und Zahlwege um', () => {
  const m = createComplianceManager({ country: 'AT' });

  assert.equal(m.getState().commerceMode, SAAS_ONLY);
  assert.equal(m.getState().currency, 'EUR');
  assert.equal(m.getState().transactionFeeAllowed, false);

  m.setCountry('PT');
  assert.ok(m.getState().fiatMethods.some((x) => x.id === 'mbway'));

  m.setCountry('AO');
  assert.equal(m.getState().commerceMode, MARKETPLACE_FEES);
  assert.equal(m.getState().currency, 'AOA');
  assert.equal(m.getState().transactionFeeAllowed, true);
  assert.ok(m.getState().fiatMethods.some((x) => x.id === 'multicaixa'));

  m.setCountry('US');
  assert.equal(m.getState().currency, 'USD');
  assert.ok(m.getState().fields.some((f) => f.id === 'fda_registration'));
});

test('Krypto bleibt über den gesamten Länderwechsel hinweg stehen', () => {
  const m = createComplianceManager({ country: 'AT' });
  for (const country of ALL_COUNTRIES) {
    m.setCountry(country);
    assert.equal(m.getState().cryptoMethods.length, CRYPTO_METHODS.length, country);
  }
});

test('Abonnenten werden bei jedem Wechsel benachrichtigt', () => {
  const m = createComplianceManager({ country: 'AT' });
  const seen = [];
  const off = m.subscribe((s) => seen.push(s.country));

  m.setCountry('PT');
  m.setCountry('AO');
  m.setCountry('AO'); // gleiches Land -> kein zusätzlicher Aufruf
  assert.deepEqual(seen, ['PT', 'AO']);

  off();
  m.setCountry('US');
  assert.deepEqual(seen, ['PT', 'AO'], 'nach dem Abmelden darf nichts mehr kommen');
});

test('Ein unmöglicher Zweck wird beim Länderwechsel still korrigiert', () => {
  const m = createComplianceManager({ country: 'AO', purpose: 'marketplace_order' });
  assert.equal(m.getState().purpose, 'marketplace_order');

  // Deutschland kennt keine Marktplatz-Bestellung — der Zustand darf nicht
  // in einer Sackgasse landen.
  m.setCountry('DE');
  assert.equal(m.getState().purpose, 'saas_license');
  assert.equal(m.getState().purposeCorrected, true);
  assert.equal(m.getState().error, null);
});

test('getSnapshot liefert dieselbe Referenz, solange sich nichts ändert', () => {
  // Bedingung für React useSyncExternalStore: sonst rendert es endlos.
  const m = createComplianceManager({ country: 'AT' });
  assert.equal(m.getSnapshot(), m.getSnapshot());
  const before = m.getSnapshot();
  m.setCountry('PT');
  assert.notEqual(m.getSnapshot(), before);
});

test('Unbekanntes Land fällt konservativ zurück statt zu raten', () => {
  const p = complianceProfile('XX');
  assert.equal(p.commerceMode, SAAS_ONLY);
  assert.equal(p.transactionFeeAllowed, false);

  // Und auch dort gilt das Krypto-Gebot.
  assert.equal(
    paymentMethodsFor('XX', 'saas_license').filter((m) => m.rail === 'crypto').length,
    CRYPTO_METHODS.length,
  );
});

test('Der Betreiber kann ein Profil übersteuern', () => {
  // Gleiche Kultur wie LEGAL_COUNTRY_MATRIX.md: sicherer Standard, kein Zwang.
  const overrides = { US: { transactionFeeAllowed: true, marketplaceFeeBps: 100, logisticsFeeBps: 0 } };
  assert.ok(availablePurposes('US', overrides).includes('marketplace_order'));
  const model = feeModel('US', 'marketplace_order', overrides);
  assert.equal(model.kind, 'COMMISSION_FEE');
  assert.equal(model.bps, 100);

  // Ohne Übersteuerung bleibt es beim strengen Standard.
  assert.ok(!availablePurposes('US').includes('marketplace_order'));
});
