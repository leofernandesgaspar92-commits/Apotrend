// Länder-Register für die länderübergreifende Plattform (MVP Stufe 1).
// Steuert Sichtbarkeits-Scope der Inhalte, UI-Sprache (locale_default), Währung
// und Zeitzone. Rechte hängen an der Rolle, NICHT am Land — das Land bestimmt nur
// Sichtbarkeit/Sprache/Währung. Regulator = offizielle News-/Engpassquelle je Land
// (Aussagen dazu nur mit belegter Quelle).
// regulator_url = offizielle Website der Arzneimittelbehörde (echte, verifizierte Quelle;
// null, wo die offizielle Domain nicht sicher belegt ist — lieber kein Link als ein falscher,
// gerade bei Sicherheits-/Echtheitsthemen). Aussagen/Alerts NUR aus solchen belegten Quellen.
export const COUNTRIES = {
  AT: { code: 'AT', name: 'Österreich',       flag: '🇦🇹', locale_default: 'de', locales: ['de'],             currency: 'EUR', timezone: 'Europe/Vienna',     regulator: 'BASG',            regulator_url: 'https://www.basg.gv.at', region: 'EUROPE' },
  DE: { code: 'DE', name: 'Deutschland',      flag: '🇩🇪', locale_default: 'de', locales: ['de'],             currency: 'EUR', timezone: 'Europe/Berlin',     regulator: 'BfArM',           regulator_url: 'https://www.bfarm.de', region: 'EUROPE' },
  CH: { code: 'CH', name: 'Schweiz',          flag: '🇨🇭', locale_default: 'de', locales: ['de', 'en'],       currency: 'CHF', timezone: 'Europe/Zurich',     regulator: 'Swissmedic',      regulator_url: 'https://www.swissmedic.ch', region: 'EUROPE' },
  LI: { code: 'LI', name: 'Liechtenstein',    flag: '🇱🇮', locale_default: 'de', locales: ['de'],             currency: 'CHF', timezone: 'Europe/Vaduz',      regulator: 'Amt für Gesundheit', regulator_url: null, region: 'EUROPE' },
  PT: { code: 'PT', name: 'Portugal',         flag: '🇵🇹', locale_default: 'pt', locales: ['pt'],             currency: 'EUR', timezone: 'Europe/Lisbon',     regulator: 'INFARMED',        regulator_url: 'https://www.infarmed.pt', region: 'EUROPE' },
  BR: { code: 'BR', name: 'Brasil',           flag: '🇧🇷', locale_default: 'pt', locales: ['pt'],             currency: 'BRL', timezone: 'America/Sao_Paulo', regulator: 'ANVISA',          regulator_url: 'https://www.gov.br/anvisa', region: 'AMERICAS' },
  AO: { code: 'AO', name: 'Angola',           flag: '🇦🇴', locale_default: 'pt', locales: ['pt'],             currency: 'AOA', timezone: 'Africa/Luanda',     regulator: 'ARMED',           regulator_url: null, region: 'AFRICA' },
  MZ: { code: 'MZ', name: 'Moçambique',       flag: '🇲🇿', locale_default: 'pt', locales: ['pt'],             currency: 'MZN', timezone: 'Africa/Maputo',     regulator: 'ANARME',          regulator_url: null, region: 'AFRICA' },
  GB: { code: 'GB', name: 'United Kingdom',   flag: '🇬🇧', locale_default: 'en', locales: ['en'],             currency: 'GBP', timezone: 'Europe/London',     regulator: 'MHRA',            regulator_url: 'https://www.gov.uk/government/organisations/medicines-and-healthcare-products-regulatory-agency', region: 'EUROPE' },
  US: { code: 'US', name: 'United States',    flag: '🇺🇸', locale_default: 'en', locales: ['en'],             currency: 'USD', timezone: 'America/New_York',  regulator: 'FDA',             regulator_url: 'https://www.fda.gov', region: 'AMERICAS' },
  NG: { code: 'NG', name: 'Nigeria',          flag: '🇳🇬', locale_default: 'en', locales: ['en'],             currency: 'NGN', timezone: 'Africa/Lagos',      regulator: 'NAFDAC',          regulator_url: 'https://www.nafdac.gov.ng', region: 'AFRICA' },
  KE: { code: 'KE', name: 'Kenya',            flag: '🇰🇪', locale_default: 'en', locales: ['en'],             currency: 'KES', timezone: 'Africa/Nairobi',    regulator: 'PPB',             regulator_url: 'https://ppb.go.ke', region: 'AFRICA' },
  GH: { code: 'GH', name: 'Ghana',            flag: '🇬🇭', locale_default: 'en', locales: ['en'],             currency: 'GHS', timezone: 'Africa/Accra',      regulator: 'FDA Ghana',       regulator_url: 'https://fdaghana.gov.gh', region: 'AFRICA' },
  CA: { code: 'CA', name: 'Canada',           flag: '🇨🇦', locale_default: 'en', locales: ['en'],             currency: 'CAD', timezone: 'America/Toronto',   regulator: 'Health Canada',   regulator_url: 'https://www.canada.ca/en/health-canada.html', region: 'AMERICAS' },
  AU: { code: 'AU', name: 'Australia',        flag: '🇦🇺', locale_default: 'en', locales: ['en'],             currency: 'AUD', timezone: 'Australia/Sydney',  regulator: 'TGA',             regulator_url: 'https://www.tga.gov.au', region: 'OCEANIA' },
  ZA: { code: 'ZA', name: 'South Africa',     flag: '🇿🇦', locale_default: 'en', locales: ['en'],             currency: 'ZAR', timezone: 'Africa/Johannesburg', regulator: 'SAHPRA',        regulator_url: 'https://www.sahpra.org.za', region: 'AFRICA' },
  // ── Englischsprachiges Afrika (Start 10/2026) ─────────────────────────────
  //  regulator_url nur, wo die offizielle Domain sicher bekannt ist; sonst null
  //  (Grundsatz oben: lieber kein Link als ein falscher). Simbabwe rechnet im
  //  Alltag überwiegend in US-Dollar — darum USD statt der neuen Landeswährung.
  UG: { code: 'UG', name: 'Uganda',           flag: '🇺🇬', locale_default: 'en', locales: ['en'],             currency: 'UGX', timezone: 'Africa/Kampala',    regulator: 'NDA',             regulator_url: 'https://www.nda.or.ug', region: 'AFRICA' },
  TZ: { code: 'TZ', name: 'Tanzania',         flag: '🇹🇿', locale_default: 'en', locales: ['en'],             currency: 'TZS', timezone: 'Africa/Dar_es_Salaam', regulator: 'TMDA',         regulator_url: 'https://www.tmda.go.tz', region: 'AFRICA' },
  ZM: { code: 'ZM', name: 'Zambia',           flag: '🇿🇲', locale_default: 'en', locales: ['en'],             currency: 'ZMW', timezone: 'Africa/Lusaka',     regulator: 'ZAMRA',           regulator_url: 'https://www.zamra.co.zm', region: 'AFRICA' },
  ZW: { code: 'ZW', name: 'Zimbabwe',         flag: '🇿🇼', locale_default: 'en', locales: ['en'],             currency: 'USD', timezone: 'Africa/Harare',     regulator: 'MCAZ',            regulator_url: 'https://www.mcaz.co.zw', region: 'AFRICA' },
  RW: { code: 'RW', name: 'Rwanda',           flag: '🇷🇼', locale_default: 'en', locales: ['en'],             currency: 'RWF', timezone: 'Africa/Kigali',     regulator: 'Rwanda FDA',      regulator_url: 'https://www.rwandafda.gov.rw', region: 'AFRICA' },
  BW: { code: 'BW', name: 'Botswana',         flag: '🇧🇼', locale_default: 'en', locales: ['en'],             currency: 'BWP', timezone: 'Africa/Gaborone',   regulator: 'BoMRA',           regulator_url: 'https://www.bomra.co.bw', region: 'AFRICA' },
  NA: { code: 'NA', name: 'Namibia',          flag: '🇳🇦', locale_default: 'en', locales: ['en'],             currency: 'NAD', timezone: 'Africa/Windhoek',   regulator: 'NMRC',            regulator_url: null, region: 'AFRICA' },
  MW: { code: 'MW', name: 'Malawi',           flag: '🇲🇼', locale_default: 'en', locales: ['en'],             currency: 'MWK', timezone: 'Africa/Blantyre',   regulator: 'PMRA',            regulator_url: null, region: 'AFRICA' },
  ET: { code: 'ET', name: 'Ethiopia',         flag: '🇪🇹', locale_default: 'en', locales: ['en'],             currency: 'ETB', timezone: 'Africa/Addis_Ababa', regulator: 'EFDA',           regulator_url: 'https://www.efda.gov.et', region: 'AFRICA' },
  SL: { code: 'SL', name: 'Sierra Leone',     flag: '🇸🇱', locale_default: 'en', locales: ['en'],             currency: 'SLE', timezone: 'Africa/Freetown',   regulator: 'Pharmacy Board of Sierra Leone', regulator_url: null, region: 'AFRICA' },
  LR: { code: 'LR', name: 'Liberia',          flag: '🇱🇷', locale_default: 'en', locales: ['en'],             currency: 'LRD', timezone: 'Africa/Monrovia',   regulator: 'LMHRA',           regulator_url: null, region: 'AFRICA' },
  GM: { code: 'GM', name: 'The Gambia',       flag: '🇬🇲', locale_default: 'en', locales: ['en'],             currency: 'GMD', timezone: 'Africa/Banjul',     regulator: 'MCA',             regulator_url: null, region: 'AFRICA' },
  // 10/2026, zweite Welle (Owner: „alle afrikanischen Länder"): übrige Länder mit Englisch
  // bzw. Portugiesisch als Amtssprache. Behörde laut Recherche; wo keine eigene arbeitende
  // Behörde belegt ist (Lesotho, Eswatini: gesetzlich vorgesehen, noch im Aufbau; Seychellen,
  // Guinea-Bissau, São Tomé), steht das Gesundheitsministerium — nichts Erfundenes.
  LS: { code: 'LS', name: 'Lesotho', flag: '🇱🇸', locale_default: 'en', locales: ['en'], currency: 'LSL', timezone: 'Africa/Maseru', regulator: 'Ministry of Health', regulator_url: null, region: 'AFRICA' },
  SZ: { code: 'SZ', name: 'Eswatini', flag: '🇸🇿', locale_default: 'en', locales: ['en'], currency: 'SZL', timezone: 'Africa/Mbabane', regulator: 'Ministry of Health', regulator_url: null, region: 'AFRICA' },
  MU: { code: 'MU', name: 'Mauritius', flag: '🇲🇺', locale_default: 'en', locales: ['en'], currency: 'MUR', timezone: 'Indian/Mauritius', regulator: 'Pharmacy Board', regulator_url: null, region: 'AFRICA' },
  SC: { code: 'SC', name: 'Seychelles', flag: '🇸🇨', locale_default: 'en', locales: ['en'], currency: 'SCR', timezone: 'Indian/Mahe', regulator: 'Ministry of Health', regulator_url: null, region: 'AFRICA' },
  SS: { code: 'SS', name: 'South Sudan', flag: '🇸🇸', locale_default: 'en', locales: ['en'], currency: 'SSP', timezone: 'Africa/Juba', regulator: 'DFCA', regulator_url: null, region: 'AFRICA' },
  ER: { code: 'ER', name: 'Eritrea', flag: '🇪🇷', locale_default: 'en', locales: ['en'], currency: 'ERN', timezone: 'Africa/Asmara', regulator: 'NMFA', regulator_url: null, region: 'AFRICA' },
  CV: { code: 'CV', name: 'Cabo Verde', flag: '🇨🇻', locale_default: 'pt', locales: ['pt'], currency: 'CVE', timezone: 'Atlantic/Cape_Verde', regulator: 'ERIS', regulator_url: null, region: 'AFRICA' },
  GW: { code: 'GW', name: 'Guiné-Bissau', flag: '🇬🇼', locale_default: 'pt', locales: ['pt'], currency: 'XOF', timezone: 'Africa/Bissau', regulator: 'Ministério da Saúde Pública', regulator_url: null, region: 'AFRICA' },
  ST: { code: 'ST', name: 'São Tomé e Príncipe', flag: '🇸🇹', locale_default: 'pt', locales: ['pt'], currency: 'STN', timezone: 'Africa/Sao_Tome', regulator: 'Ministério da Saúde', regulator_url: null, region: 'AFRICA' },
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

// ── Regionen: drei Ebenen Land / Region / Welt ──────────────────────────────
//  Jedes Land gehört zu GENAU einer Region. Zusätzlich gibt es Quellen, die
//  keinem Land gehören: EMA (EU), Africa CDC / WHO Afrika (AFR), WHO (INT).
//  Diese Codes sind KEINE Länder — sie dürfen nie als Land eines Kontos,
//  eines Engpasses oder einer Rechtsprüfung dienen, nur als Herkunft einer
//  Meldung.
export const REGIONEN = ['AFRICA', 'EUROPE', 'AMERICAS', 'OCEANIA'];
export const QUELL_REGIONEN = { EU: 'EUROPE', AFR: 'AFRICA', INT: null };
export const istQuellRegion = (code) => Object.prototype.hasOwnProperty.call(QUELL_REGIONEN, String(code || '').toUpperCase());
export function regionVon(code) {
  const c = String(code || '').toUpperCase();
  if (istQuellRegion(c)) return QUELL_REGIONEN[c];
  return COUNTRIES[c] ? COUNTRIES[c].region : null;
}
export const laenderInRegion = (region) => Object.values(COUNTRIES).filter((c) => c.region === region).map((c) => c.code);

// Öffentliche Liste fürs Frontend (stabile Reihenfolge = Einfügereihenfolge).
export function listCountries() {
  return Object.values(COUNTRIES).map((c) => ({ ...c, locales: [...c.locales] }));
}
