// Landesspezifische Feature-Konfiguration (Owner-Framework, „active_features"-Schema).
// EHRLICH: enabled=true nur für Funktionen, die WIRKLICH existieren. Sicherheits-/
// Datenabhängige Module (z. B. Echtheitsprüfung, Rückruf-Tracking) sind enabled=false und
// als „geplant" markiert — sie schalten sich erst frei, wenn eine echte Quelle angeschlossen
// ist (siehe docs/LIVE_DATA.md), niemals mit erfundenen Daten.
import { COUNTRIES, normalizeCountry } from './countries.js';

// Sprachgruppen aus der Ziel-Matrix (für gruppenspezifische, geplante Module).
const DACH = new Set(['AT', 'DE', 'CH', 'LI']);
const LUSO = new Set(['PT', 'BR', 'AO', 'MZ']);
// (Alle übrigen Register-Länder sind anglophon: GB, US, NG, KE, GH, CA, AU, ZA.)

// ── Rechtliche Länder-Restriktionen (Compliance-Screen, KEINE Rechtsberatung) ──
// Grundlage: docs/LEGAL_COUNTRY_MATRIX.md (länderweise Analyse). 'blocked' = Funktion
// in diesem Land unzulässig → hart gesperrt (UI ausgeblendet, API 451). 'restricted' =
// zulässig mit Auflagen → bleibt nutzbar, zeigt aber einen rechtlichen Hinweis.
// Bewusst konservativ und vom Betreiber überschreibbar; von Fachjurist:innen zu prüfen.
// Nur die rechtlich heiklen Module (deals, price_compare, stock_exchange) werden bewertet;
// die übrigen Kernfunktionen sind überall zulässig.
const FEATURE_RESTRICTIONS = {
  AT: { deals: 'restricted', price_compare: 'restricted', stock_exchange: 'restricted' },
  DE: { deals: 'blocked', price_compare: 'restricted', stock_exchange: 'restricted' },
  CH: { deals: 'restricted', price_compare: 'restricted', stock_exchange: 'restricted' },
  LI: { deals: 'restricted', price_compare: 'restricted', stock_exchange: 'restricted' },
  PT: { deals: 'blocked', price_compare: 'restricted', stock_exchange: 'restricted' },
  BR: { deals: 'restricted', price_compare: 'restricted', stock_exchange: 'restricted' },
  AO: { deals: 'restricted', stock_exchange: 'blocked' },
  MZ: { deals: 'restricted', stock_exchange: 'blocked' },
  GB: { deals: 'restricted', price_compare: 'restricted', stock_exchange: 'restricted' },
  US: { deals: 'restricted', price_compare: 'restricted', stock_exchange: 'blocked' },
  NG: { deals: 'restricted', stock_exchange: 'restricted' },
  KE: { deals: 'restricted', stock_exchange: 'restricted' },
  GH: { deals: 'restricted', stock_exchange: 'restricted' },
  CA: { deals: 'restricted', price_compare: 'restricted', stock_exchange: 'restricted' },
  AU: { deals: 'restricted', price_compare: 'restricted', stock_exchange: 'restricted' },
  ZA: { deals: 'restricted', price_compare: 'restricted', stock_exchange: 'restricted' },
};

// Rechtsstatus einer Funktion im Land: 'blocked' | 'restricted' | 'allowed'.
export function featureStatus(code, featureId) {
  const r = FEATURE_RESTRICTIONS[normalizeCountry(code)];
  return (r && r[featureId]) || 'allowed';
}
// Kurz-Prüfung fürs Backend-Gate: ist die Funktion im Land hart gesperrt?
export function isFeatureBlocked(code, featureId) {
  return featureStatus(code, featureId) === 'blocked';
}

// Reason-Code (i18n-Schlüssel `legal_<reason>`) je heikler Funktion und Status.
const LEGAL_REASON = {
  deals: { blocked: 'deals_blocked', restricted: 'deals_restricted' },
  price_compare: { blocked: 'price_blocked', restricted: 'price_restricted' },
  stock_exchange: { blocked: 'exchange_blocked', restricted: 'exchange_restricted' },
};

export function countryConfig(code) {
  const c = COUNTRIES[normalizeCountry(code)];
  // Immer verfügbare, echte Kernfunktionen. Bei den heiklen Modulen wird der rechtliche
  // Status (blocked/restricted/allowed) je Land angehängt — das Frontend blendet
  // gesperrte Reiter aus bzw. zeigt bei „restricted" einen rechtlichen Hinweis.
  const legal = (id) => {
    const status = featureStatus(c.code, id);
    if (status === 'allowed') return { status };
    return { status, enabled: status !== 'blocked', legal_reason: (LEGAL_REASON[id] || {})[status] || null };
  };
  const features = [
    { feature_id: 'shortage_radar',     type: 'tab',    enabled: true },
    { feature_id: 'price_compare',      type: 'tab',    enabled: true, ...legal('price_compare') },
    { feature_id: 'deals',              type: 'tab',    enabled: true, ...legal('deals') },
    { feature_id: 'stock_exchange',     type: 'tab',    enabled: true, ...legal('stock_exchange') },
    { feature_id: 'watchlist',          type: 'widget', enabled: true },
    { feature_id: 'currency_converter', type: 'widget', enabled: true },
    { feature_id: 'live_data_status',   type: 'badge',  enabled: true },
  ];
  // Offizielle Behörden-Quelle: aktiv nur mit verifizierter URL, sonst als „geplant".
  if (c.regulator) {
    features.push(c.regulator_url
      ? { feature_id: 'regulator_source', type: 'link', enabled: true, label: c.regulator, url: c.regulator_url }
      : { feature_id: 'regulator_source', type: 'link', enabled: false, label: c.regulator, planned: true });
  }
  // Gruppenspezifische, NOCH nicht gebaute Module aus der Matrix — ehrlich als geplant.
  // (enabled=false: erscheinen nicht als echte Funktion, dokumentieren aber die Roadmap.)
  if (DACH.has(c.code)) features.push({ feature_id: 'pzn_matching', type: 'widget', enabled: false, planned: true });
  if (LUSO.has(c.code)) features.push({ feature_id: 'import_logistics', type: 'widget', enabled: false, planned: true });
  if (!DACH.has(c.code) && !LUSO.has(c.code)) features.push({ feature_id: 'authenticity_check', type: 'widget', enabled: false, planned: true });
  // Sicherheitskritisch & datenabhängig — überall geplant, bis eine echte Quelle angeschlossen ist.
  features.push({ feature_id: 'recall_tracking', type: 'feed', enabled: false, planned: true });

  return {
    country: c.code,
    country_name: c.name,
    language: c.locale_default,
    currency: c.currency,
    regulator: c.regulator,
    active_features: features,
  };
}
