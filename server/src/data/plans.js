// ============================================================================
//  Abo-Katalog — Mehrwährungs-Lizenzen
// ============================================================================
//  WICHTIG zur Ehrlichkeit: Die Beträge unten sind eine BEISPIEL-Preisliste zur
//  Demonstration der Mechanik, keine betriebswirtschaftliche Empfehlung. Der
//  Betreiber setzt die echten Preise.
//
//  Warum feste Preise je Währung statt Umrechnung zum Tageskurs:
//  Ein Abo, dessen Betrag jeden Monat mit dem Wechselkurs schwankt, ist für die
//  Kundin nicht planbar und in der Buchhaltung ein Ärgernis. Übliche Praxis im
//  SaaS-Geschäft ist deshalb eine gepflegte Preisliste je Währung. Der
//  FX-Dienst (services/fxRates.js) dient der ANZEIGE von Vergleichswerten,
//  nicht der Abrechnung.
//
//  Beträge in der kleinsten Währungseinheit (Cent, Cêntimo, …).
// ============================================================================

import { complianceProfile, minorUnits, formatAmount } from '../domain/compliance.js';

export const BILLING_INTERVALS = ['monthly', 'yearly'];

/**
 * Preis je Währung. Fehlt eine Währung, greift `fallbackCurrency` —
 * besser eine klar benannte Fremdwährung als ein erfundener Umrechnungskurs.
 */
const PLANS = [
  {
    id: 'apo_basis',
    name: 'Basis',
    tier: 1,
    audience: 'Einzelapotheke',
    features: [
      'Engpass-Radar mit Behörden-Quellen',
      'Wirkstoff-Merkliste',
      'Notfall-Aushilfe (immer kostenfrei)',
      '1 Standort, 3 Konten',
    ],
    monthly: { EUR: 4900, CHF: 4900, GBP: 4200, USD: 5400, CAD: 7400, AUD: 8200, BRL: 27900, AOA: 4500000, MZN: 349000, NGN: 8900000, KES: 700000, GHS: 82000, ZAR: 99000 },
    yearly: { EUR: 49000, CHF: 49000, GBP: 42000, USD: 54000, CAD: 74000, AUD: 82000, BRL: 279000, AOA: 45000000, MZN: 3490000, NGN: 89000000, KES: 7000000, GHS: 820000, ZAR: 990000 },
  },
  {
    id: 'apo_pro',
    name: 'Professional',
    tier: 2,
    audience: 'Apothekenverbund, Klinikapotheke',
    features: [
      'Alles aus Basis',
      'Preisvergleich mehrerer Lieferanten',
      'Beschaffungs-Statistik und Export',
      'Bis 10 Standorte, 25 Konten',
    ],
    monthly: { EUR: 14900, CHF: 14900, GBP: 12900, USD: 16400, CAD: 22400, AUD: 24900, BRL: 84900, AOA: 13700000, MZN: 1060000, NGN: 27000000, KES: 2130000, GHS: 249000, ZAR: 299000 },
    yearly: { EUR: 149000, CHF: 149000, GBP: 129000, USD: 164000, CAD: 224000, AUD: 249000, BRL: 849000, AOA: 137000000, MZN: 10600000, NGN: 270000000, KES: 21300000, GHS: 2490000, ZAR: 2990000 },
  },
  {
    id: 'apo_logistics',
    name: 'Logistik',
    tier: 3,
    audience: 'Großhandel, Importeur',
    features: [
      'Alles aus Professional',
      'Marktplatz-Listungen und Auftragsabwicklung',
      'Import-Zertifikate und Chargen-Nachweis',
      'Unbegrenzte Standorte',
    ],
    monthly: { EUR: 39900, CHF: 39900, GBP: 34900, USD: 43900, CAD: 59900, AUD: 66900, BRL: 227000, AOA: 36600000, MZN: 2840000, NGN: 72000000, KES: 5690000, GHS: 665000, ZAR: 799000 },
    yearly: { EUR: 399000, CHF: 399000, GBP: 349000, USD: 439000, CAD: 599000, AUD: 669000, BRL: 2270000, AOA: 366000000, MZN: 28400000, NGN: 720000000, KES: 56900000, GHS: 6650000, ZAR: 7990000 },
    /** Nur dort buchbar, wo Marktplatz-Gebühren freigeschaltet sind. */
    requiresMarketplace: true,
  },
];

const FALLBACK_CURRENCY = 'EUR';

export function listPlanIds() {
  return PLANS.map((p) => p.id);
}

/**
 * Pläne für ein Land, bepreist in dessen Währung.
 *
 * `requiresMarketplace` filtert den Logistik-Plan dort heraus, wo es gar keinen
 * Marktplatz gibt — ein buchbarer Plan ohne Funktion wäre eine Falle.
 */
export function plansForCountry(code, { interval = 'monthly' } = {}) {
  const profile = complianceProfile(code);
  const currency = profile.currency;
  const period = BILLING_INTERVALS.includes(interval) ? interval : 'monthly';

  return PLANS
    .filter((p) => !p.requiresMarketplace || profile.transactionFeeAllowed)
    .map((p) => {
      const table = p[period];
      const native = table[currency];
      const usedCurrency = native != null ? currency : FALLBACK_CURRENCY;
      const amountMinor = native != null ? native : table[FALLBACK_CURRENCY];

      return {
        id: p.id,
        name: p.name,
        tier: p.tier,
        audience: p.audience,
        features: [...p.features],
        interval: period,
        currency: usedCurrency,
        amount_minor: amountMinor,
        minor_units: minorUnits(usedCurrency),
        display: formatAmount(amountMinor, usedCurrency),
        // Ehrlich kennzeichnen, wenn in Fremdwährung abgerechnet würde.
        billed_in_foreign_currency: usedCurrency !== currency,
      };
    });
}

export function getPlan(id) {
  return PLANS.find((p) => p.id === id) || null;
}

/** Preis eines Plans in einem Land — Grundlage für den Abo-Datensatz. */
export function priceFor(planId, code, interval = 'monthly') {
  const plan = getPlan(planId);
  if (!plan) return null;
  const profile = complianceProfile(code);
  const period = BILLING_INTERVALS.includes(interval) ? interval : 'monthly';
  const table = plan[period];
  const native = table[profile.currency];
  const currency = native != null ? profile.currency : FALLBACK_CURRENCY;
  return {
    plan_id: plan.id,
    currency,
    amount_minor: native != null ? native : table[FALLBACK_CURRENCY],
    interval: period,
  };
}
