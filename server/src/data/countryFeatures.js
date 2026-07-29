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

export function countryConfig(code) {
  const c = COUNTRIES[normalizeCountry(code)];
  // Immer verfügbare, echte Kernfunktionen.
  const features = [
    { feature_id: 'shortage_radar',     type: 'tab',    enabled: true },
    { feature_id: 'price_compare',      type: 'tab',    enabled: true },
    { feature_id: 'deals',              type: 'tab',    enabled: true },
    { feature_id: 'stock_exchange',     type: 'tab',    enabled: true },
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
    language: c.locale_default,
    currency: c.currency,
    regulator: c.regulator,
    active_features: features,
  };
}
