// Premium-Produkte (Freischalt-Funktionen). Preise in Cent (EUR), damit keine
// Fließkomma-Rundungsfehler entstehen. Das `feature` wird bei erfolgreicher
// Zahlung als Entitlement freigeschaltet. Bewusst schlank + zentral — später
// leicht erweiterbar oder aus einer DB ladbar.
export const PRODUCTS = {
  // `monate`: Laufzeit je Zahlung. Ohne sie lief „Premium (Monat)" nie ab —
  // eine Zahlung schaltete Premium für immer frei (bis 10/2026).
  premium_monthly: { id: 'premium_monthly', feature: 'premium', amount_cents: 999, currency: 'EUR', name: 'ApoPulse Premium (Monat)', monate: 1 },
  premium_yearly: { id: 'premium_yearly', feature: 'premium', amount_cents: 9900, currency: 'EUR', name: 'ApoPulse Premium (Jahr)', monate: 12 },
  // Business: Daten-Schnittstelle für Großhandel, Ketten, Klinik-Einkauf
  // (services/datenApi.js). `zusatz`: schaltet Premium für dieselbe Laufzeit
  // mit frei — wer die Schnittstelle bezahlt, soll in der App nicht vor
  // einer Premium-Sperre stehen. Startpreise, per Umgebung änderbar:
  // APOPULSE_PREISE_BUSINESS="monat:99,jahr:990" (EUR).
  business_monthly: { id: 'business_monthly', feature: 'api', zusatz: ['premium'], amount_cents: businessPreis('monat', 9900), currency: 'EUR', name: 'ApoPulse Business mit Daten-Schnittstelle (Monat)', monate: 1 },
  business_yearly: { id: 'business_yearly', feature: 'api', zusatz: ['premium'], amount_cents: businessPreis('jahr', 99000), currency: 'EUR', name: 'ApoPulse Business mit Daten-Schnittstelle (Jahr)', monate: 12 },
};

function businessPreis(art, standard, env = process.env) {
  const m = String(env.APOPULSE_PREISE_BUSINESS || '').match(new RegExp(`(?:^|,)\\s*${art}\\s*:\\s*(\\d{1,6})(?:[.,](\\d{1,2}))?\\s*(?:,|$)`));
  if (!m) return standard;
  const cent = Number(m[1]) * 100 + Number((m[2] || '0').padEnd(2, '0'));
  return cent > 0 ? cent : standard;
}

export function getProduct(id) { return PRODUCTS[id] || null; }
export function listProducts() { return Object.values(PRODUCTS).map(p => ({ ...p })); }
