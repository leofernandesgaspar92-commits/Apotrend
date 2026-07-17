// Länder-Register für die länderübergreifende Plattform (MVP Stufe 1).
// Steuert Sichtbarkeits-Scope der Inhalte, UI-Sprache (locale_default), Währung
// und Zeitzone. Rechte hängen an der Rolle, NICHT am Land — das Land bestimmt nur
// Sichtbarkeit/Sprache/Währung. Regulator = offizielle News-/Engpassquelle je Land
// (Aussagen dazu nur mit belegter Quelle).
export const COUNTRIES = {
  AT: { code: 'AT', name: 'Österreich',       flag: '🇦🇹', locale_default: 'de', locales: ['de'],             currency: 'EUR', timezone: 'Europe/Vienna',     regulator: 'BASG' },
  DE: { code: 'DE', name: 'Deutschland',      flag: '🇩🇪', locale_default: 'de', locales: ['de'],             currency: 'EUR', timezone: 'Europe/Berlin',     regulator: 'BfArM' },
  CH: { code: 'CH', name: 'Schweiz',          flag: '🇨🇭', locale_default: 'de', locales: ['de', 'en'],       currency: 'CHF', timezone: 'Europe/Zurich',     regulator: 'Swissmedic' },
  PT: { code: 'PT', name: 'Portugal',         flag: '🇵🇹', locale_default: 'pt', locales: ['pt'],             currency: 'EUR', timezone: 'Europe/Lisbon',     regulator: 'INFARMED' },
  BR: { code: 'BR', name: 'Brasil',           flag: '🇧🇷', locale_default: 'pt', locales: ['pt'],             currency: 'BRL', timezone: 'America/Sao_Paulo', regulator: 'ANVISA' },
  AO: { code: 'AO', name: 'Angola',           flag: '🇦🇴', locale_default: 'pt', locales: ['pt'],             currency: 'AOA', timezone: 'Africa/Luanda',     regulator: 'ARMED' },
  MZ: { code: 'MZ', name: 'Moçambique',       flag: '🇲🇿', locale_default: 'pt', locales: ['pt'],             currency: 'MZN', timezone: 'Africa/Maputo',     regulator: 'ANARME' },
  GB: { code: 'GB', name: 'United Kingdom',   flag: '🇬🇧', locale_default: 'en', locales: ['en'],             currency: 'GBP', timezone: 'Europe/London',     regulator: 'MHRA' },
  US: { code: 'US', name: 'United States',    flag: '🇺🇸', locale_default: 'en', locales: ['en'],             currency: 'USD', timezone: 'America/New_York',  regulator: 'FDA' },
  NG: { code: 'NG', name: 'Nigeria',          flag: '🇳🇬', locale_default: 'en', locales: ['en'],             currency: 'NGN', timezone: 'Africa/Lagos',      regulator: 'NAFDAC' },
  KE: { code: 'KE', name: 'Kenya',            flag: '🇰🇪', locale_default: 'en', locales: ['en'],             currency: 'KES', timezone: 'Africa/Nairobi',    regulator: 'PPB' },
  GH: { code: 'GH', name: 'Ghana',            flag: '🇬🇭', locale_default: 'en', locales: ['en'],             currency: 'GHS', timezone: 'Africa/Accra',      regulator: 'FDA Ghana' },
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
