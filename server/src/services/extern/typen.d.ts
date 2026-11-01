// ============================================================================
//  Typen der externen Schnittstellen (Antworten so, wie die Anbieter sie liefern)
// ============================================================================
//  Das Projekt läuft ohne TypeScript-Build (reines Node). Diese Datei beschreibt die
//  Antworten trotzdem verbindlich: Die Module binden sie per JSDoc ein
//  (`@typedef {import('./typen').…}`), Editoren prüfen damit, und die Tests bilden
//  genau diese Formen nach. Quelle jeweils: öffentliche Dokumentation des Anbieters.
// ============================================================================

/** Ergebnis eines Abrufs über den gemeinsamen Baustein (abruf.js). */
export interface AbrufErgebnis<T> {
  daten: T | null;
  /** ISO-Zeitpunkt, zu dem `daten` beim Anbieter abgeholt wurden. */
  stand: string | null;
  /** live: gerade abgerufen · zwischenspeicher: frisch aus dem Speicher ·
   *  gesichert: Anbieter weg, letzter guter Stand · keine: nichts verfügbar */
  aus: 'live' | 'zwischenspeicher' | 'gesichert' | 'keine';
  veraltet: boolean;
  fehler?: string;
}

export interface QuellenStatus {
  name: string;
  quelle: string;
  link: string;
  aktiv: boolean;
  zuletzt_ok: string | null;
  letzter_fehler: string | null;
  pause_bis: string | null;
  abrufe: number;
  aus_speicher: number;
}

// ── World Bank Open Data · https://api.worldbank.org/v2/country/{cc}/indicator/{id}?format=json
export interface WeltbankSeite { page: number; pages: number; per_page: number; total: number; lastupdated?: string; }
export interface WeltbankWert {
  indicator: { id: string; value: string };
  country: { id: string; value: string };
  countryiso3code: string;
  date: string;            // Jahr, z. B. "2023"
  value: number | null;
  unit?: string;
  obs_status?: string;
  decimal?: number;
}
/** Erfolgreiche Antwort: [Seiteninfo, Werte]. Fehler: [{ message: [...] }]. */
export type WeltbankAntwort = [WeltbankSeite, WeltbankWert[] | null] | [{ message: Array<{ id: string; key: string; value: string }> }];

export interface LogistikIndex { land: string; wert: number; jahr: string; skala: string; link: string; }

// ── Open-Meteo Forecast · https://api.open-meteo.com/v1/forecast
export interface OpenMeteoAntwort {
  latitude: number;
  longitude: number;
  timezone?: string;
  daily_units?: Record<string, string>;
  daily: {
    time: string[];                       // "YYYY-MM-DD"
    precipitation_sum?: (number | null)[]; // mm
    wind_speed_10m_max?: (number | null)[]; // km/h
    wind_gusts_10m_max?: (number | null)[]; // km/h
  };
}
export interface HafenWetterTag { datum: string; regen_mm: number | null; wind_kmh: number | null; boeen_kmh: number | null; }
export interface HafenWetter { tage: HafenWetterTag[]; hinweise: Array<{ datum: string; art: 'starkregen' | 'sturm'; wert: number }>; }

// ── Frankfurter (EZB-Kurse) · https://api.frankfurter.app/latest?from=EUR
export interface FrankfurterAntwort { amount: number; base: string; date: string; rates: Record<string, number>; }

// ── CoinGecko simple/price · https://api.coingecko.com/api/v3/simple/price?ids=tether,tron&vs_currencies=eur
export type CoinGeckoPreise = Record<string, { eur?: number; usd?: number }>;

// ── AISStream · wss://stream.aisstream.io/v0/stream
export interface AisAbo {
  APIKey: string;
  BoundingBoxes: Array<[[number, number], [number, number]]>; // [[lat, lon], [lat, lon]]
  FilterMessageTypes?: string[];
}
export interface AisNachricht {
  MessageType: string; // "PositionReport", "Error", …
  MetaData: { MMSI: number; ShipName?: string; latitude: number; longitude: number; time_utc?: string };
  Message: { PositionReport?: { Sog?: number; NavigationalStatus?: number; UserID?: number } };
  error?: string;
}
export interface HafenSchiffe { im_gebiet: number; vor_anker: number; festgemacht: number; in_fahrt: number; stand: string | null; }
