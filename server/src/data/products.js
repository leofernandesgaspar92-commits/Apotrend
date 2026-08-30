// Premium-Produkte (Freischalt-Funktionen). Preise in Cent (EUR), damit keine
// Fließkomma-Rundungsfehler entstehen. Das `feature` wird bei erfolgreicher
// Zahlung als Entitlement freigeschaltet. Bewusst schlank + zentral — später
// leicht erweiterbar oder aus einer DB ladbar.
export const PRODUCTS = {
  premium_monthly: { id: 'premium_monthly', feature: 'premium', amount_cents: 999, currency: 'EUR', name: 'ApoPulse Premium (Monat)' },
  premium_yearly: { id: 'premium_yearly', feature: 'premium', amount_cents: 9900, currency: 'EUR', name: 'ApoPulse Premium (Jahr)' },
};

export function getProduct(id) { return PRODUCTS[id] || null; }
export function listProducts() { return Object.values(PRODUCTS).map(p => ({ ...p })); }
