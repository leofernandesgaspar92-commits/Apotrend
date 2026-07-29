// Länder-Register für die länderübergreifende Plattform (MVP Stufe 1).
// Steuert Sichtbarkeits-Scope der Inhalte, UI-Sprache (locale_default), Währung
// und Zeitzone. Rechte hängen an der Rolle, NICHT am Land — das Land bestimmt nur
// Sichtbarkeit/Sprache/Währung. Regulator = offizielle News-/Engpassquelle je Land
// (Aussagen dazu nur mit belegter Quelle).
// regulator_url = offizielle Website der Arzneimittelbehörde (echte, verifizierte Quelle;
// null, wo die offizielle Domain nicht sicher belegt ist — lieber kein Link als ein falscher,
// gerade bei Sicherheits-/Echtheitsthemen). Aussagen/Alerts NUR aus solchen belegten Quellen.
export const COUNTRIES = {
  AT: { code: 'AT', name: 'Österreich',       flag: '🇦🇹', locale_default: 'de', locales: ['de'],             currency: 'EUR', timezone: 'Europe/Vienna',     regulator: 'BASG',            regulator_url: 'https://www.basg.gv.at' },
  DE: { code: 'DE', name: 'Deutschland',      flag: '🇩🇪', locale_default: 'de', locales: ['de'],             currency: 'EUR', timezone: 'Europe/Berlin',     regulator: 'BfArM',           regulator_url: 'https://www.bfarm.de' },
  CH: { code: 'CH', name: 'Schweiz',          flag: '🇨🇭', locale_default: 'de', locales: ['de', 'en'],       currency: 'CHF', timezone: 'Europe/Zurich',     regulator: 'Swissmedic',      regulator_url: 'https://www.swissmedic.ch' },
  LI: { code: 'LI', name: 'Liechtenstein',    flag: '🇱🇮', locale_default: 'de', locales: ['de'],             currency: 'CHF', timezone: 'Europe/Vaduz',      regulator: 'Amt für Gesundheit', regulator_url: null },
  PT: { code: 'PT', name: 'Portugal',         flag: '🇵🇹', locale_default: 'pt', locales: ['pt'],             currency: 'EUR', timezone: 'Europe/Lisbon',     regulator: 'INFARMED',        regulator_url: 'https://www.infarmed.pt' },
  BR: { code: 'BR', name: 'Brasil',           flag: '🇧🇷', locale_default: 'pt', locales: ['pt'],             currency: 'BRL', timezone: 'America/Sao_Paulo', regulator: 'ANVISA',          regulator_url: 'https://www.gov.br/anvisa' },
  AO: { code: 'AO', name: 'Angola',           flag: '🇦🇴', locale_default: 'pt', locales: ['pt'],             currency: 'AOA', timezone: 'Africa/Luanda',     regulator: 'ARMED',           regulator_url: null },
  MZ: { code: 'MZ', name: 'Moçambique',       flag: '🇲🇿', locale_default: 'pt', locales: ['pt'],             currency: 'MZN', timezone: 'Africa/Maputo',     regulator: 'ANARME',          regulator_url: null },
  GB: { code: 'GB', name: 'United Kingdom',   flag: '🇬🇧', locale_default: 'en', locales: ['en'],             currency: 'GBP', timezone: 'Europe/London',     regulator: 'MHRA',            regulator_url: 'https://www.gov.uk/government/organisations/medicines-and-healthcare-products-regulatory-agency' },
  US: { code: 'US', name: 'United States',    flag: '🇺🇸', locale_default: 'en', locales: ['en'],             currency: 'USD', timezone: 'America/New_York',  regulator: 'FDA',             regulator_url: 'https://www.fda.gov' },
  NG: { code: 'NG', name: 'Nigeria',          flag: '🇳🇬', locale_default: 'en', locales: ['en'],             currency: 'NGN', timezone: 'Africa/Lagos',      regulator: 'NAFDAC',          regulator_url: 'https://www.nafdac.gov.ng' },
  KE: { code: 'KE', name: 'Kenya',            flag: '🇰🇪', locale_default: 'en', locales: ['en'],             currency: 'KES', timezone: 'Africa/Nairobi',    regulator: 'PPB',             regulator_url: 'https://ppb.go.ke' },
  GH: { code: 'GH', name: 'Ghana',            flag: '🇬🇭', locale_default: 'en', locales: ['en'],             currency: 'GHS', timezone: 'Africa/Accra',      regulator: 'FDA Ghana',       regulator_url: 'https://fdaghana.gov.gh' },
  CA: { code: 'CA', name: 'Canada',           flag: '🇨🇦', locale_default: 'en', locales: ['en'],             currency: 'CAD', timezone: 'America/Toronto',   regulator: 'Health Canada',   regulator_url: 'https://www.canada.ca/en/health-canada.html' },
  AU: { code: 'AU', name: 'Australia',        flag: '🇦🇺', locale_default: 'en', locales: ['en'],             currency: 'AUD', timezone: 'Australia/Sydney',  regulator: 'TGA',             regulator_url: 'https://www.tga.gov.au' },
  ZA: { code: 'ZA', name: 'South Africa',     flag: '🇿🇦', locale_default: 'en', locales: ['en'],             currency: 'ZAR', timezone: 'Africa/Johannesburg', regulator: 'SAHPRA',        regulator_url: 'https://www.sahpra.org.za' },
};

export const DEFAULT_COUNTRY = 'AT';
export const SUPPORTED_LOCALES = ['de', 'en', 'pt'];

// Gültiger Ländercode? (Großschreibung normalisiert.)
export function isValidCountry(code) {
  return typeof code === 'string' && Object.prototype.hasOwnProperty.call(COUNTRIES, code.toUpperCase());
}

// Land normalisieren mit Fallback auf Standardland.
export function normalizeCountry(code) {
  return isValidCountry(code) ? code.toUpperCase() : DEFAULT_COUNTRY;
}

// UI-Sprache validieren; Fallback = Standardsprache des (ggf. normalisierten) Landes.
export function normalizeLocale(locale, country) {
  if (typeof locale === 'string' && SUPPORTED_LOCALES.includes(locale.toLowerCase())) return locale.toLowerCase();
  return COUNTRIES[normalizeCountry(country)].locale_default;
}

// Öffentliche Liste fürs Frontend (stabile Reihenfolge = Einfügereihenfolge).
export function listCountries() {
  return Object.values(COUNTRIES).map((c) => ({ ...c, locales: [...c.locales] }));
}
