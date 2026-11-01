// @ts-check
// ============================================================================
//  World Bank Open Data — Logistics Performance Index (LPI) je Land
// ============================================================================
//  Kennzahl LP.LPI.OVRL.XQ: Gesamtwert 1 (schlecht) bis 5 (sehr gut), erhoben in
//  Befragungen der Weltbank, erscheint nur alle paar Jahre (2016, 2018, 2023 …).
//  Darum lange Zwischenspeicherung (7 Tage) und immer mit Jahr anzeigen — ein Wert von
//  2018 ist kein Lagebild von heute. Ohne Schlüssel, frei nutzbar (CC BY 4.0, Quelle nennen).
//  Ein Index, keine Aussage über Engpässe: Er beschreibt, wie gut Zoll, Infrastruktur und
//  Sendungsverfolgung eines Landes im Durchschnitt funktionieren.
// ============================================================================
import { createAbruf } from './abruf.js';

/** @typedef {import('./typen').WeltbankAntwort} WeltbankAntwort */
/** @typedef {import('./typen').LogistikIndex} LogistikIndex */

export const LPI_KENNZAHL = 'LP.LPI.OVRL.XQ';
export const lpiLink = (cc) => `https://data.worldbank.org/indicator/${LPI_KENNZAHL}?locations=${cc}`;

/** Antwort lesen: den jüngsten vorhandenen Wert. Wirft bei unbrauchbarer Antwort. */
export function lpiLesen(/** @type {WeltbankAntwort} */ j, cc) {
  if (!Array.isArray(j)) throw Object.assign(new Error('keine Liste'), { code: 'quelle_gestoert' });
  const kopf = j[0];
  if (kopf && 'message' in kopf) throw Object.assign(new Error('Weltbank: ' + ((kopf.message[0] && kopf.message[0].value) || 'Fehler')), { code: 'quelle_gestoert' });
  const werte = Array.isArray(j[1]) ? j[1] : [];
  const w = werte.filter((x) => x && typeof x.value === 'number' && Number.isFinite(x.value)).sort((a, b) => Number(b.date) - Number(a.date))[0];
  if (!w) return null; // Land ohne Erhebung: ehrlich „kein Wert", kein Fehler
  /** @type {LogistikIndex} */
  const erg = { land: cc, wert: Math.round(w.value * 100) / 100, jahr: String(w.date), skala: '1–5', link: lpiLink(cc) };
  if (!(erg.wert >= 1 && erg.wert <= 5)) throw Object.assign(new Error('Wert außerhalb 1–5'), { code: 'quelle_gestoert' });
  return erg;
}

export function createWeltbank({ speicher, fetchImpl, jetzt } = /** @type {any} */ ({})) {
  const abruf = createAbruf({ name: 'weltbank', quelle: 'World Bank Open Data (LPI)', link: 'https://data.worldbank.org/indicator/' + LPI_KENNZAHL,
    ttlMs: 7 * 86_400_000, speicher, fetchImpl, jetzt });
  return {
    /** @param {string} cc ISO-3166-Alpha-2 */
    logistikIndex(cc) {
      const land = String(cc || '').toUpperCase();
      if (!/^[A-Z]{2}$/.test(land)) return Promise.resolve({ daten: null, stand: null, aus: /** @type {'keine'} */ ('keine'), veraltet: true, fehler: 'ungültiges Land' });
      // mrnev=1: jüngster nicht-leerer Wert; per_page großzügig, falls der Anbieter das ignoriert.
      return abruf.holen(land, `https://api.worldbank.org/v2/country/${land}/indicator/${LPI_KENNZAHL}?format=json&mrnev=1&per_page=50`, (j) => lpiLesen(j, land));
    },
    status: abruf.status,
  };
}
