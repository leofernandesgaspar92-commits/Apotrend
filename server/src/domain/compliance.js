// ============================================================================
//  Dynamic Country Compliance Engine
// ============================================================================
//  Beim Wechsel des Landes im Header ändern sich drei Dinge gleichzeitig:
//    1. der zulässige Handels-Modus  (SAAS_ONLY vs. MARKETPLACE_FEES)
//    2. das Gebührenmodell           (SAAS_FLAT vs. COMMISSION_FEE)
//    3. die zulässigen Bezahlwege    (lokale Fiat-Schienen je Land)
//
//  ⚠️ Kein Rechtsrat. Wie docs/LEGAL_COUNTRY_MATRIX.md ist das eine konservative
//     Gating-Einschätzung zur Produktsteuerung, kein anwaltlicher Rat. Im Zweifel
//     wurde die strengere Variante gewählt. Alle Profile sind vom Betreiber
//     übersteuerbar (siehe `withOverrides`).
//
//  BEWUSST OHNE node:-Importe und ohne Abhängigkeiten: dieselbe Datei läuft im
//  Server UND — über tools/build-checkout-demo.mjs eingebettet — im Browser.
//  Zwei Kopien derselben Regeln würden garantiert auseinanderlaufen, und
//  ausgerechnet bei Compliance-Regeln wäre das der teuerste Ort dafür.
//
//  ──────────────────────────────────────────────────────────────────────────
//  KRYPTO-GEBOT (Owner-Vorgabe, nicht verhandelbar)
//  ──────────────────────────────────────────────────────────────────────────
//  Krypto-Zahlungen sind in JEDEM Land für JEDEN Zweck verfügbar und dürfen
//  nicht herausgefiltert werden. Das steht hier nicht nur als Kommentar:
//  `paymentMethodsFor()` ruft am Ende `assertCryptoAvailable()` auf und WIRFT,
//  wenn die Krypto-Schiene fehlt. Ein Filter, der sie versehentlich entfernt,
//  bringt damit sofort den Aufruf zum Absturz statt still zu wirken — und der
//  Test `compliance-engine.test.js` prüft alle Länder × alle Zwecke.
//  Ein Kommentar wäre eine Bitte. Das hier ist eine Zusicherung.
// ============================================================================

// --- Handels-Modi -----------------------------------------------------------

/** Nur Software-Lizenzen. Keine Provision auf den Warenwert. */
export const SAAS_ONLY = 'SAAS_ONLY';
/** Marktplatz mit Transaktions-/Logistikgebühr auf vermittelte Bestellungen. */
export const MARKETPLACE_FEES = 'MARKETPLACE_FEES';

/** Wofür wird gezahlt? Steuert Gebührenmodell und Pflichtfelder. */
export const PURPOSES = ['saas_license', 'marketplace_order', 'merchant_credit'];

export const PURPOSE_LABELS = {
  saas_license: 'Software-Lizenz (Abo)',
  marketplace_order: 'Marktplatz-Bestellung',
  merchant_credit: 'Händler-Guthaben',
};

export class ComplianceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ComplianceError';
    this.code = code;
    this.status = 422;
  }
}

// --- Krypto: die unverrückbare Schiene ---------------------------------------
//  Global verfügbar für grenzüberschreitende B2B-Lizenzen, Händler-Guthaben und
//  internationale Transaktionen. Reihenfolge = Anzeigereihenfolge.

export const CRYPTO_METHODS = Object.freeze([
  Object.freeze({
    id: 'usdt', rail: 'crypto', label: 'USDT (Tether)', asset: 'USDT',
    networks: Object.freeze(['Ethereum (ERC-20)', 'Tron (TRC-20)']),
    settlement: 'stablecoin', confirmations: 12,
  }),
  Object.freeze({
    id: 'usdc', rail: 'crypto', label: 'USDC (Circle)', asset: 'USDC',
    networks: Object.freeze(['Ethereum (ERC-20)', 'Solana', 'Polygon']),
    settlement: 'stablecoin', confirmations: 12,
  }),
  Object.freeze({
    id: 'btc', rail: 'crypto', label: 'Bitcoin', asset: 'BTC',
    networks: Object.freeze(['Bitcoin (Mainnet)']),
    settlement: 'volatile', confirmations: 2,
  }),
  Object.freeze({
    id: 'walletconnect', rail: 'crypto', label: 'Web3-Wallet (WalletConnect)', asset: 'MULTI',
    networks: Object.freeze(['Ethereum', 'Polygon', 'Arbitrum']),
    settlement: 'wallet', confirmations: 12,
  }),
]);

/**
 * Torwächter für das Krypto-Gebot.
 *
 * Wird am Ende JEDER Methodenliste aufgerufen. Wer künftig einen Länderfilter
 * ergänzt, der die Krypto-Schiene mit erwischt, bekommt hier sofort einen
 * Fehler statt einer stillen Regression in Produktion.
 */
export function assertCryptoAvailable(methods, country, purpose) {
  const crypto = methods.filter((m) => m.rail === 'crypto');
  if (crypto.length === 0) {
    throw new ComplianceError(
      'crypto_rail_missing',
      `Krypto-Zahlung fehlt für ${country}/${purpose}. Die Krypto-Schiene ist ` +
        'eine feste Zusage der Plattform und darf nicht länderabhängig gefiltert werden.',
    );
  }
  return methods;
}

// --- Fiat-Schienen ----------------------------------------------------------

const FIAT = {
  card: { id: 'card', rail: 'fiat', label: 'Kredit-/Debitkarte', provider: 'stripe', settlementDays: 2 },
  sepa: { id: 'sepa', rail: 'fiat', label: 'SEPA-Lastschrift', provider: 'stripe', settlementDays: 5 },
  sepa_credit: { id: 'sepa_credit', rail: 'fiat', label: 'SEPA-Überweisung', provider: 'bank', settlementDays: 2 },
  invoice: { id: 'invoice', rail: 'fiat', label: 'Rechnung (30 Tage)', provider: 'internal', settlementDays: 30 },
  mbway: { id: 'mbway', rail: 'fiat', label: 'MB WAY', provider: 'sibs', settlementDays: 1 },
  multicaixa: { id: 'multicaixa', rail: 'fiat', label: 'Multicaixa Express', provider: 'emis', settlementDays: 1 },
  mpesa: { id: 'mpesa', rail: 'fiat', label: 'M-Pesa', provider: 'safaricom', settlementDays: 1 },
  paystack: { id: 'paystack', rail: 'fiat', label: 'Karte / Bank-Transfer (Paystack)', provider: 'paystack', settlementDays: 2 },
  pix: { id: 'pix', rail: 'fiat', label: 'Pix', provider: 'stripe', settlementDays: 1 },
  ach: { id: 'ach', rail: 'fiat', label: 'ACH-Lastschrift', provider: 'stripe', settlementDays: 4 },
  bacs: { id: 'bacs', rail: 'fiat', label: 'Bacs-Lastschrift', provider: 'stripe', settlementDays: 3 },
};

export const FIAT_METHODS = Object.freeze(FIAT);

// --- Pflichtfelder im Checkout ----------------------------------------------
//  `pattern` ist eine Zeichenkette statt eines RegExp-Literals: so lässt sich
//  dasselbe Feld im Server (new RegExp) und im HTML-Formular (pattern-Attribut)
//  verwenden, ohne die Regel zweimal zu schreiben.

const FIELD = {
  vat_id: {
    id: 'vat_id', label: 'USt-IdNr. / UID', required: false,
    pattern: '^[A-Z]{2}[0-9A-Z]{8,12}$', example: 'ATU12345678',
    hint: 'Für den innergemeinschaftlichen Bezug (Reverse Charge). Ohne Angabe wird die Umsatzsteuer des Sitzlandes berechnet.',
    legalBasis: 'Art. 196 MwStSystRL',
  },
  fda_registration: {
    id: 'fda_registration', label: 'FDA Establishment Registration Number', required: true,
    pattern: '^[0-9]{7,11}$', example: '3001234567',
    hint: 'Pflicht für die Lieferkettendokumentation nach DSCSA. Wird bei jeder Transaktion mitgeführt.',
    legalBasis: 'FD&C Act § 582 (DSCSA)',
  },
  dea_number: {
    id: 'dea_number', label: 'DEA-Nummer (nur bei kontrollierten Substanzen)', required: false,
    pattern: '^[A-Z]{2}[0-9]{7}$', example: 'AB1234563',
    hint: 'Nur erforderlich, wenn kontrollierte Substanzen im Auftrag enthalten sind.',
    legalBasis: '21 CFR 1301',
  },
  import_licence: {
    id: 'import_licence', label: 'Einfuhr-Lizenznummer', required: true,
    pattern: '^[A-Za-z0-9\\-/]{5,32}$', example: 'ARMED/IMP/2026/0042',
    hint: 'Nummer der Einfuhrgenehmigung der nationalen Arzneimittelbehörde.',
    legalBasis: 'nationale Einfuhrbestimmungen',
  },
  gmp_certificate: {
    id: 'gmp_certificate', label: 'GMP-/Herkunftszertifikat', required: true, type: 'file',
    accept: 'application/pdf,image/jpeg,image/png',
    hint: 'Nachweis der Herkunft gegen gefälschte Arzneimittel. Wird bei der Freigabe der Bestellung geprüft.',
    legalBasis: 'WHO GDP; nationale Vorgaben',
  },
  pharmacy_licence: {
    id: 'pharmacy_licence', label: 'Apotheken-/Betriebserlaubnis', required: true,
    pattern: '^[A-Za-z0-9\\-/ ]{4,40}$', example: 'BR-K-2024-1188',
    hint: 'Nur zugelassene Betriebe dürfen bestellen. Wird gegen das Register geprüft.',
    legalBasis: 'nationale Apothekengesetze',
  },
};

export const CHECKOUT_FIELDS = Object.freeze(FIELD);

// --- Länderprofile ----------------------------------------------------------
//  Die Angaben zu Gesetzen sind BEZEICHNUNGEN von Rechtsrahmen, keine Auslegung.
//  `notes` sind Hinweistexte für die Oberfläche, kein Gutachten.

const PROFILES = {
  // ── DACH: strikt SaaS. Keine Provision auf Arzneimittel. ──────────────────
  AT: {
    region: 'DACH', currency: 'EUR', commerceMode: SAAS_ONLY, transactionFeeAllowed: false,
    legalFramework: ['AMG (AT)', 'HWG', 'Apothekengesetz', 'DSGVO'],
    regulator: 'BASG',
    fiat: ['sepa', 'card', 'invoice', 'sepa_credit'],
    fields: ['vat_id'],
    monetization: ['saas_flat', 'verified_manufacturer_post', 'emergency_aid_free'],
    notes: [
      'Keine prozentuale Verkaufsprovision auf Arzneimittel — die Plattform verdient ausschließlich an Software-Lizenzen und gekennzeichneten Hersteller-Beiträgen.',
      'Notfall-Aushilfe zwischen Apotheken ist dauerhaft kostenfrei und wird nicht abgerechnet.',
    ],
  },
  DE: {
    region: 'DACH', currency: 'EUR', commerceMode: SAAS_ONLY, transactionFeeAllowed: false,
    legalFramework: ['AMG (DE)', 'HWG', 'ApoG', 'AMPreisV', 'DSGVO'],
    regulator: 'BfArM',
    fiat: ['sepa', 'card', 'invoice', 'sepa_credit'],
    fields: ['vat_id'],
    monetization: ['saas_flat', 'verified_manufacturer_post', 'emergency_aid_free'],
    notes: [
      'Keine prozentuale Verkaufsprovision auf Arzneimittel. Die Arzneimittelpreisverordnung lässt für preisgebundene Arzneimittel ohnehin keinen Spielraum für Vermittlungsentgelte am Warenwert.',
      'Notfall-Aushilfe zwischen Apotheken ist dauerhaft kostenfrei.',
    ],
  },
  CH: {
    region: 'DACH', currency: 'CHF', commerceMode: SAAS_ONLY, transactionFeeAllowed: false,
    legalFramework: ['HMG', 'AWV', 'revDSG'],
    regulator: 'Swissmedic',
    fiat: ['card', 'invoice', 'sepa_credit'],
    fields: [],
    monetization: ['saas_flat', 'verified_manufacturer_post', 'emergency_aid_free'],
    notes: [
      'Nicht-EU: kein SEPA-Lastschriftverfahren, Abrechnung in CHF.',
      'Keine prozentuale Verkaufsprovision auf Arzneimittel.',
    ],
  },
  LI: {
    region: 'DACH', currency: 'CHF', commerceMode: SAAS_ONLY, transactionFeeAllowed: false,
    legalFramework: ['HMG (übernommen)', 'EWR-Recht', 'DSGVO'],
    regulator: 'Amt für Gesundheit',
    fiat: ['card', 'invoice', 'sepa_credit'],
    fields: ['vat_id'],
    monetization: ['saas_flat', 'verified_manufacturer_post', 'emergency_aid_free'],
    notes: ['Keine prozentuale Verkaufsprovision auf Arzneimittel.'],
  },

  // ── EU (Portugal und übrige EU): SaaS mit lokalen Zahlwegen ───────────────
  PT: {
    region: 'EU', currency: 'EUR', commerceMode: SAAS_ONLY, transactionFeeAllowed: false,
    legalFramework: ['Decreto-Lei 176/2006', 'EU-Richtlinie 2001/83/EG', 'DSGVO'],
    regulator: 'INFARMED',
    fiat: ['mbway', 'sepa', 'card', 'invoice'],
    fields: ['vat_id'],
    monetization: ['saas_flat', 'verified_manufacturer_post'],
    notes: [
      'MB WAY ist der verbreitetste lokale Zahlweg und steht vor Karte.',
      'SaaS-Modell: keine Provision auf den Warenwert von Arzneimitteln.',
    ],
  },

  // ── Afrikanische Märkte: Marktplatz mit Gebühren + Echtheitsnachweis ──────
  AO: {
    region: 'AFRICA', currency: 'AOA', commerceMode: MARKETPLACE_FEES, transactionFeeAllowed: true,
    marketplaceFeeBps: 250, logisticsFeeBps: 150,
    legalFramework: ['ARMED-Regulierung', 'MINSA-Vorgaben', 'Lei de Proteção de Dados'],
    regulator: 'ARMED',
    fiat: ['multicaixa', 'card', 'invoice'],
    fields: ['import_licence', 'gmp_certificate', 'pharmacy_licence'],
    monetization: ['marketplace_fee', 'logistics_fee', 'saas_flat'],
    notes: [
      'Marktplatz-Transaktionsgebühren sind freigeschaltet: 2,5 % Vermittlung plus 1,5 % Logistik.',
      'Einfuhr-Lizenz und Herkunftszertifikat sind Pflicht — der Nachweis gegen gefälschte Arzneimittel ist hier der Kern der Regulierung.',
    ],
  },
  MZ: {
    region: 'AFRICA', currency: 'MZN', commerceMode: MARKETPLACE_FEES, transactionFeeAllowed: true,
    marketplaceFeeBps: 250, logisticsFeeBps: 150,
    legalFramework: ['ANARME-Regulierung'],
    regulator: 'ANARME',
    fiat: ['card', 'invoice'],
    fields: ['import_licence', 'gmp_certificate', 'pharmacy_licence'],
    monetization: ['marketplace_fee', 'logistics_fee', 'saas_flat'],
    notes: ['Einfuhr-Lizenz und Herkunftszertifikat sind Pflicht.'],
  },
  NG: {
    region: 'AFRICA', currency: 'NGN', commerceMode: MARKETPLACE_FEES, transactionFeeAllowed: true,
    marketplaceFeeBps: 250, logisticsFeeBps: 150,
    legalFramework: ['NAFDAC Act', 'NDPR'],
    regulator: 'NAFDAC',
    fiat: ['paystack', 'card', 'invoice'],
    fields: ['import_licence', 'gmp_certificate', 'pharmacy_licence'],
    monetization: ['marketplace_fee', 'logistics_fee', 'saas_flat'],
    notes: [
      'NAFDAC-Registrierungsnummer und Herkunftszertifikat sind Pflicht.',
      'Marktplatz-Gebühren freigeschaltet.',
    ],
  },
  KE: {
    region: 'AFRICA', currency: 'KES', commerceMode: MARKETPLACE_FEES, transactionFeeAllowed: true,
    marketplaceFeeBps: 250, logisticsFeeBps: 150,
    legalFramework: ['Pharmacy and Poisons Act', 'Data Protection Act 2019'],
    regulator: 'PPB',
    fiat: ['mpesa', 'card', 'invoice'],
    fields: ['import_licence', 'gmp_certificate', 'pharmacy_licence'],
    monetization: ['marketplace_fee', 'logistics_fee', 'saas_flat'],
    notes: [
      'M-Pesa steht als verbreitetster Zahlweg an erster Stelle.',
      'PPB-Lizenz und Herkunftszertifikat sind Pflicht.',
    ],
  },
  GH: {
    region: 'AFRICA', currency: 'GHS', commerceMode: MARKETPLACE_FEES, transactionFeeAllowed: true,
    marketplaceFeeBps: 250, logisticsFeeBps: 150,
    legalFramework: ['Public Health Act 851'],
    regulator: 'FDA Ghana',
    fiat: ['paystack', 'card', 'invoice'],
    fields: ['import_licence', 'gmp_certificate', 'pharmacy_licence'],
    monetization: ['marketplace_fee', 'logistics_fee', 'saas_flat'],
    notes: ['Einfuhr-Lizenz und Herkunftszertifikat sind Pflicht.'],
  },
  ZA: {
    region: 'AFRICA', currency: 'ZAR', commerceMode: MARKETPLACE_FEES, transactionFeeAllowed: true,
    marketplaceFeeBps: 200, logisticsFeeBps: 100,
    legalFramework: ['Medicines and Related Substances Act', 'POPIA'],
    regulator: 'SAHPRA',
    fiat: ['card', 'invoice', 'paystack'],
    fields: ['pharmacy_licence'],
    monetization: ['marketplace_fee', 'logistics_fee', 'saas_flat'],
    notes: ['SAHPRA-Lizenz erforderlich; Einfuhrnachweis nur bei Importware.'],
  },

  // ── USA: SaaS + strikte Rückverfolgbarkeit ────────────────────────────────
  US: {
    region: 'AMERICAS', currency: 'USD', commerceMode: SAAS_ONLY, transactionFeeAllowed: false,
    legalFramework: ['FD&C Act', 'DSCSA (Title II DQSA)', 'State Board of Pharmacy'],
    regulator: 'FDA',
    traceability: 'DSCSA',
    fiat: ['card', 'ach', 'invoice'],
    fields: ['fda_registration', 'dea_number'],
    monetization: ['saas_flat', 'verified_manufacturer_post'],
    notes: [
      'Track-and-Trace nach DSCSA: Jede Transaktion führt die FDA-Registrierungsnummer mit und erzeugt einen unveränderlichen Nachweis (Transaction Information / History / Statement).',
      'Konservative Voreinstellung ohne Marktplatz-Provision — die Großhandelserlaubnis ist einzelstaatlich geregelt und vom Betreiber je Bundesstaat freizuschalten.',
    ],
  },
  CA: {
    region: 'AMERICAS', currency: 'CAD', commerceMode: SAAS_ONLY, transactionFeeAllowed: false,
    legalFramework: ['Food and Drugs Act', 'PIPEDA'],
    regulator: 'Health Canada',
    fiat: ['card', 'invoice'],
    fields: [],
    monetization: ['saas_flat', 'verified_manufacturer_post'],
    notes: ['SaaS-Modell; Marktplatz-Gebühren nicht freigeschaltet.'],
  },
  BR: {
    region: 'AMERICAS', currency: 'BRL', commerceMode: SAAS_ONLY, transactionFeeAllowed: false,
    legalFramework: ['Lei 6.360/1976', 'RDC ANVISA', 'LGPD'],
    regulator: 'ANVISA',
    fiat: ['pix', 'card', 'invoice'],
    fields: ['pharmacy_licence'],
    monetization: ['saas_flat', 'verified_manufacturer_post'],
    notes: ['Pix als verbreitetster lokaler Zahlweg steht an erster Stelle.'],
  },

  // ── Übrige ───────────────────────────────────────────────────────────────
  GB: {
    region: 'UK', currency: 'GBP', commerceMode: SAAS_ONLY, transactionFeeAllowed: false,
    legalFramework: ['Human Medicines Regulations 2012', 'UK GDPR'],
    regulator: 'MHRA',
    fiat: ['card', 'bacs', 'invoice'],
    fields: [],
    monetization: ['saas_flat', 'verified_manufacturer_post'],
    notes: ['Nicht-EU: kein SEPA-Lastschriftverfahren, Abrechnung in GBP.'],
  },
  AU: {
    region: 'APAC', currency: 'AUD', commerceMode: SAAS_ONLY, transactionFeeAllowed: false,
    legalFramework: ['Therapeutic Goods Act 1989', 'Privacy Act 1988'],
    regulator: 'TGA',
    fiat: ['card', 'invoice'],
    fields: [],
    monetization: ['saas_flat', 'verified_manufacturer_post'],
    notes: ['SaaS-Modell; Marktplatz-Gebühren nicht freigeschaltet.'],
  },
};

/** Land ohne eigenes Profil: konservativer Rückfall (SaaS, keine Gebühren). */
const FALLBACK_PROFILE = {
  region: 'OTHER', currency: 'EUR', commerceMode: SAAS_ONLY, transactionFeeAllowed: false,
  legalFramework: ['unbestimmt'], regulator: null,
  fiat: ['card', 'invoice'], fields: [],
  monetization: ['saas_flat'],
  notes: ['Für dieses Land liegt noch kein geprüftes Profil vor. Konservative Voreinstellung: nur Software-Lizenzen, keine Marktplatz-Gebühren.'],
};

export const COMPLIANCE_PROFILES = PROFILES;

// --- Zugriff ----------------------------------------------------------------

export function hasProfile(code) {
  return typeof code === 'string' && Object.prototype.hasOwnProperty.call(PROFILES, code.toUpperCase());
}

/**
 * Vollständiges Profil eines Landes.
 * `overrides` erlaubt dem Betreiber, einzelne Felder zu übersteuern — dieselbe
 * Kultur wie in LEGAL_COUNTRY_MATRIX.md: die Engine setzt einen sicheren
 * Standard, keine unumstößliche Sperre.
 */
export function complianceProfile(code, overrides = {}) {
  const upper = typeof code === 'string' ? code.toUpperCase() : '';
  const base = PROFILES[upper] || FALLBACK_PROFILE;
  const merged = { ...base, ...(overrides[upper] || {}) };
  return { country: upper || 'XX', ...merged };
}

/** Welche Zahlungszwecke sind in diesem Land überhaupt möglich? */
export function availablePurposes(code, overrides = {}) {
  const p = complianceProfile(code, overrides);
  // Marktplatz-Bestellungen gibt es nur, wo Transaktionsgebühren zulässig sind.
  // In DACH ist das der Kern der Vorgabe: keine Provision auf Arzneimittel.
  return p.transactionFeeAllowed
    ? ['saas_license', 'marketplace_order', 'merchant_credit']
    : ['saas_license', 'merchant_credit'];
}

/**
 * Zulässige Bezahlwege für Land + Zweck.
 *
 * Fiat wird nach Land gefiltert; Krypto wird IMMER angehängt (Owner-Vorgabe)
 * und der Anhang anschließend durch `assertCryptoAvailable` abgesichert.
 */
export function paymentMethodsFor(code, purpose = 'saas_license', overrides = {}) {
  if (!PURPOSES.includes(purpose)) {
    throw new ComplianceError('purpose_unknown', `Unbekannter Zahlungszweck: ${purpose}`);
  }
  const p = complianceProfile(code, overrides);

  if (purpose === 'marketplace_order' && !p.transactionFeeAllowed) {
    throw new ComplianceError(
      'marketplace_disabled',
      `Marktplatz-Bestellungen sind in ${p.country} nicht freigeschaltet: ` +
        'Auf Arzneimittel wird dort keine Verkaufsprovision erhoben.',
    );
  }

  const fiat = (p.fiat || [])
    .map((id) => FIAT[id])
    .filter(Boolean)
    // Rechnung ergibt bei Guthaben-Aufladung keinen Sinn (Vorkasse-Logik).
    .filter((m) => !(purpose === 'merchant_credit' && m.id === 'invoice'))
    .map((m) => ({ ...m, currency: p.currency }));

  // Krypto: ohne Länderfilter, in jedem Zweck.
  const crypto = CRYPTO_METHODS.map((m) => ({ ...m, networks: [...m.networks] }));

  return assertCryptoAvailable([...fiat, ...crypto], p.country, purpose);
}

/** Pflicht- und Kann-Felder im Checkout für Land + Zweck. */
export function checkoutFieldsFor(code, purpose = 'saas_license', overrides = {}) {
  const p = complianceProfile(code, overrides);
  const ids = p.fields || [];

  return ids
    .map((id) => FIELD[id])
    .filter(Boolean)
    .map((f) => ({ ...f }))
    // Herkunfts-/Lizenznachweise hängen an der WARE. Bei einer reinen
    // Software-Lizenz oder Guthaben-Aufladung sind sie sachlich unbegründet —
    // und ein unbegründetes Pflichtfeld ist eine Hürde ohne Gegenwert.
    .filter((f) => {
      const goodsOnly = ['import_licence', 'gmp_certificate', 'pharmacy_licence'];
      if (purpose !== 'marketplace_order' && goodsOnly.includes(f.id)) return false;
      return true;
    });
}

/**
 * Gebührenmodell für Land + Zweck.
 *
 * Der wichtigste Rückgabewert ist `kind`: `SAAS_FLAT` und `COMMISSION_FEE`
 * werden in der Transaktionstabelle getrennt geführt, weil die steuerliche und
 * die aufsichtsrechtliche Behandlung unterschiedlich ist.
 */
export function feeModel(code, purpose = 'saas_license', overrides = {}) {
  const p = complianceProfile(code, overrides);

  if (purpose === 'saas_license') {
    return {
      kind: 'SAAS_FLAT', bps: 0, appliesTo: 'subscription',
      reason: 'Feste Lizenzgebühr je Abrechnungszeitraum, unabhängig vom Warenwert.',
    };
  }

  if (purpose === 'merchant_credit') {
    return {
      kind: 'SAAS_FLAT', bps: 0, appliesTo: 'credit_topup',
      reason: 'Guthaben-Aufladung ohne Aufschlag; verbraucht wird es über Lizenz- oder Marktplatz-Gebühren.',
    };
  }

  // marketplace_order
  if (!p.transactionFeeAllowed) {
    throw new ComplianceError(
      'commission_forbidden',
      `In ${p.country} ist keine prozentuale Verkaufsprovision auf Arzneimittel vorgesehen.`,
    );
  }

  const marketplaceBps = p.marketplaceFeeBps ?? 0;
  const logisticsBps = p.logisticsFeeBps ?? 0;
  return {
    kind: 'COMMISSION_FEE',
    bps: marketplaceBps + logisticsBps,
    marketplaceBps,
    logisticsBps,
    appliesTo: 'order_value',
    reason: `Vermittlung ${(marketplaceBps / 100).toFixed(2)} % zzgl. Logistik ${(logisticsBps / 100).toFixed(2)} %.`,
  };
}

/** Gebühr in kleinster Währungseinheit. Kaufmännisch gerundet. */
export function calculateFee(amountMinor, code, purpose = 'saas_license', overrides = {}) {
  const model = feeModel(code, purpose, overrides);
  const amount = Number.isFinite(amountMinor) ? Math.max(0, Math.round(amountMinor)) : 0;
  const fee = model.kind === 'COMMISSION_FEE' ? Math.round((amount * model.bps) / 10000) : 0;
  return { ...model, amountMinor: amount, feeMinor: fee, netMinor: amount - fee };
}

// --- Währungsdarstellung ----------------------------------------------------
//  Nicht jede Währung hat zwei Nachkommastellen. AOA und KES werden im Handel
//  üblicherweise ohne Bruchteile ausgewiesen; JPY hat gar keine. Ein fest
//  verdrahtetes „/100" wäre in diesen Märkten schlicht falsch.

const CURRENCY_MINOR_UNITS = {
  EUR: 2, CHF: 2, USD: 2, GBP: 2, CAD: 2, AUD: 2, BRL: 2, ZAR: 2, GHS: 2, MZN: 2,
  AOA: 2, KES: 2, NGN: 2,
};

export function minorUnits(currency) {
  return CURRENCY_MINOR_UNITS[currency] ?? 2;
}

/**
 * Betrag formatieren. `locale` optional — sonst wird aus der Währung eine
 * sinnvolle Voreinstellung abgeleitet.
 */
export function formatAmount(amountMinor, currency, locale = null) {
  const digits = minorUnits(currency);
  const value = amountMinor / 10 ** digits;
  const loc = locale || DEFAULT_LOCALE_BY_CURRENCY[currency] || 'de-DE';
  try {
    return new Intl.NumberFormat(loc, {
      style: 'currency', currency,
      minimumFractionDigits: digits, maximumFractionDigits: digits,
    }).format(value);
  } catch {
    // Unbekannter Währungscode: lieber roh anzeigen als abstürzen.
    return `${value.toFixed(digits)} ${currency}`;
  }
}

const DEFAULT_LOCALE_BY_CURRENCY = {
  EUR: 'de-DE', CHF: 'de-CH', USD: 'en-US', GBP: 'en-GB', CAD: 'en-CA', AUD: 'en-AU',
  BRL: 'pt-BR', AOA: 'pt-AO', MZN: 'pt-MZ', NGN: 'en-NG', KES: 'en-KE', GHS: 'en-GH', ZAR: 'en-ZA',
};

// --- Der Zustands-Manager ---------------------------------------------------

/**
 * CountryComplianceManager — beobachtbarer Zustand für den Länderwechsel.
 *
 * Bewusst ohne Framework: `subscribe(fn)` gibt eine Abmeldefunktion zurück, das
 * ist genau die Form, die `useSyncExternalStore` in React erwartet. Damit läuft
 * derselbe Manager in der Vanilla-SPA, im React-Context und im Server, ohne dass
 * die Regeln dreimal existieren.
 *
 *   const manager = createComplianceManager({ country: 'AT' })
 *   const off = manager.subscribe(() => render(manager.getState()))
 *   manager.setCountry('AO')   // -> Modus, Gebühren, Zahlwege wechseln
 */
export function createComplianceManager({
  country = 'AT',
  purpose = 'saas_license',
  overrides = {},
} = {}) {
  let currentCountry = hasProfile(country) ? country.toUpperCase() : 'AT';
  let currentPurpose = PURPOSES.includes(purpose) ? purpose : 'saas_license';
  let snapshot = null;
  const listeners = new Set();

  function build() {
    const profile = complianceProfile(currentCountry, overrides);
    const purposes = availablePurposes(currentCountry, overrides);

    // Zweck ggf. korrigieren: Wer in Angola eine Marktplatz-Bestellung offen
    // hat und nach Deutschland wechselt, darf nicht in einem Zustand landen,
    // den es dort nicht gibt.
    const effectivePurpose = purposes.includes(currentPurpose) ? currentPurpose : purposes[0];
    const purposeCorrected = effectivePurpose !== currentPurpose;
    currentPurpose = effectivePurpose;

    let methods = [];
    let fees = null;
    let error = null;
    try {
      methods = paymentMethodsFor(currentCountry, currentPurpose, overrides);
      fees = feeModel(currentCountry, currentPurpose, overrides);
    } catch (e) {
      // Die Krypto-Zusicherung darf niemals verschluckt werden: wenn sie
      // auslöst, ist die Konfiguration kaputt und das muss laut scheitern.
      if (e.code === 'crypto_rail_missing') throw e;
      error = { code: e.code, message: e.message };
    }

    snapshot = Object.freeze({
      country: currentCountry,
      purpose: currentPurpose,
      purposeCorrected,
      availablePurposes: purposes,
      profile,
      commerceMode: profile.commerceMode,
      currency: profile.currency,
      transactionFeeAllowed: profile.transactionFeeAllowed,
      methods,
      fiatMethods: methods.filter((m) => m.rail === 'fiat'),
      cryptoMethods: methods.filter((m) => m.rail === 'crypto'),
      fields: checkoutFieldsFor(currentCountry, currentPurpose, overrides),
      fees,
      error,
    });
    return snapshot;
  }

  function emit() {
    build();
    for (const fn of listeners) fn(snapshot);
  }

  build();

  return {
    getState: () => snapshot,
    /** Signatur passend zu React `useSyncExternalStore`. */
    getSnapshot: () => snapshot,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    setCountry(code) {
      const next = hasProfile(code) ? code.toUpperCase() : currentCountry;
      if (next === currentCountry) return snapshot;
      currentCountry = next;
      emit();
      return snapshot;
    },
    setPurpose(next) {
      if (!PURPOSES.includes(next) || next === currentPurpose) return snapshot;
      currentPurpose = next;
      emit();
      return snapshot;
    },
    /** Gebühr für einen konkreten Betrag im aktuellen Zustand. */
    quote(amountMinor) {
      return calculateFee(amountMinor, currentCountry, currentPurpose, overrides);
    },
  };
}
