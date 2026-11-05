// @ts-check
// ============================================================================
//  Open-Meteo — Wetter an wichtigen Häfen (Transportrisiko)
// ============================================================================
//  Drei-Tage-Vorhersage für Niederschlag und Wind an Häfen, über die Arzneimittel nach
//  Europa und Afrika kommen. Ohne Schlüssel (frei bis 10.000 Abrufe/Tag; hier höchstens
//  ein Abruf je Hafen und Stunde). Hinweise nur bei klaren Schwellen:
//    Starkregen ≥ 50 mm/Tag, Sturmböen ≥ 75 km/h (etwa Windstärke 9).
//  Das ist ein WETTERHINWEIS, keine Aussage über Lieferungen oder Engpässe.
// ============================================================================
import { createAbruf } from './abruf.js';

/** @typedef {import('./typen').OpenMeteoAntwort} OpenMeteoAntwort */
/** @typedef {import('./typen').HafenWetter} HafenWetter */

/** Häfen (Hafenbecken-Koordinaten, Bereich für AIS ±0,15°). */
export const HAEFEN = [
  { id: 'koper', name: 'Koper', land: 'SI', lat: 45.548, lon: 13.730 },
  { id: 'rotterdam', name: 'Rotterdam', land: 'NL', lat: 51.950, lon: 4.140 },
  { id: 'tema', name: 'Tema', land: 'GH', lat: 5.630, lon: 0.017 },
  { id: 'lagos', name: 'Lagos (Apapa)', land: 'NG', lat: 6.445, lon: 3.365 },
  // Frankophones Westafrika (11/2026): Port Autonome de Dakar, Port Autonome d’Abidjan.
  { id: 'dakar', name: 'Dakar', land: 'SN', lat: 14.680, lon: -17.420 },
  { id: 'abidjan', name: 'Abidjan', land: 'CI', lat: 5.285, lon: -4.010 },
  { id: 'mombasa', name: 'Mombasa', land: 'KE', lat: -4.060, lon: 39.650 },
  { id: 'durban', name: 'Durban', land: 'ZA', lat: -29.870, lon: 31.030 },
];
export const SCHWELLE = { starkregen_mm: 50, sturm_boeen_kmh: 75 };

/** Antwort lesen. Wirft bei unbrauchbarer Antwort. */
export function wetterLesen(/** @type {OpenMeteoAntwort} */ j) {
  if (!j || !j.daily || !Array.isArray(j.daily.time) || !j.daily.time.length) throw Object.assign(new Error('keine Tageswerte'), { code: 'quelle_gestoert' });
  const zahl = (a, i) => (Array.isArray(a) && typeof a[i] === 'number' && Number.isFinite(a[i]) ? Math.round(a[i] * 10) / 10 : null);
  const d = j.daily;
  const tage = d.time.slice(0, 3).map((datum, i) => ({ datum: String(datum), regen_mm: zahl(d.precipitation_sum, i), wind_kmh: zahl(d.wind_speed_10m_max, i), boeen_kmh: zahl(d.wind_gusts_10m_max, i) }));
  /** @type {HafenWetter['hinweise']} */
  const hinweise = [];
  for (const t of tage) {
    if (t.regen_mm != null && t.regen_mm >= SCHWELLE.starkregen_mm) hinweise.push({ datum: t.datum, art: 'starkregen', wert: t.regen_mm });
    if (t.boeen_kmh != null && t.boeen_kmh >= SCHWELLE.sturm_boeen_kmh) hinweise.push({ datum: t.datum, art: 'sturm', wert: t.boeen_kmh });
  }
  return { tage, hinweise };
}

export function createHafenWetter({ speicher, fetchImpl, jetzt } = /** @type {any} */ ({})) {
  const abruf = createAbruf({ name: 'openmeteo', quelle: 'Open-Meteo', link: 'https://open-meteo.com/', ttlMs: 60 * 60_000, speicher, fetchImpl, jetzt });
  return {
    /** @param {typeof HAEFEN[number]} h */
    fuerHafen(h) {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${h.lat}&longitude=${h.lon}`
        + '&daily=precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max&forecast_days=3&timezone=auto';
      return abruf.holen(h.id, url, wetterLesen);
    },
    status: abruf.status,
  };
}
