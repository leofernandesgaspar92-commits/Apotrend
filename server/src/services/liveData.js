// Live-Daten-Schnittstelle („Anschluss-Stelle"): solange keine echte Quelle konfiguriert
// ist, laufen wir auf kuratierten Referenzdaten (Seed). Sobald pro Land eine Quelle-URL per
// Umgebungsvariable gesetzt ist, holt der Auto-Refresh dort echte Engpassdaten, VALIDIERT sie
// gegen den unten definierten Vertrag und übernimmt sie — bei jedem Fehler bleiben die alten
// Daten stehen (nie halbe/kaputte Daten anzeigen). Sicherheits-/Quellenpflicht (CLAUDE.md):
// übernommene Einträge tragen provenance='verified' und die Behörde als Quelle.
//
// VERTRAG (die spätere Server-URL MUSS genau dieses JSON liefern):
//   {
//     "country": "AT",                      // ISO-Ländercode
//     "source":  "BASG",                    // Name der Behörde/Quelle (optional; sonst Register-Regulator)
//     "fetched_at": "2026-07-29T10:00:00Z", // optional
//     "shortages": [
//       { "wirkstoff": "Amoxicillin",
//         "bezeichnung": "Amoxicillin 1000 mg Filmtabletten",
//         "status": "kritisch",             // kritisch | eingeschraenkt | verfuegbar
//         "grund": "Erhöhte Nachfrage",     // optional
//         "gemeldet_am": "2026-06-14",      // optional (YYYY-MM-DD)
//         "voraussichtlich_bis": "2026-08-15" // optional
//       }, ...
//     ]
//   }
import { COUNTRIES } from '../data/countries.js';

export const SHORTAGE_STATUSES = ['kritisch', 'eingeschraenkt', 'verfuegbar'];
const envKey = (country) => `APOTREND_LIVE_SHORTAGES_${String(country || '').toUpperCase()}`;

// Ist für dieses Land eine echte Live-Quelle konfiguriert (= „angeschlossen")?
export function isLive(country, env = process.env) {
  return !!env[envKey(country)];
}

// Alle konfigurierten Quellen { AT: { url }, ... } — leer, solange nichts angeschlossen ist.
export function liveSources(env = process.env) {
  const out = {};
  for (const code of Object.keys(COUNTRIES)) {
    const url = env[envKey(code)];
    if (url) out[code] = { url };
  }
  return out;
}

// Payload gegen den Vertrag prüfen. Gibt bereinigte Zeilen + gesammelte Fehler zurück.
export function validateShortagePayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, errors: ['Payload fehlt oder ist kein Objekt'], rows: [] };
  }
  if (!Array.isArray(payload.shortages)) {
    return { ok: false, errors: ['Feld "shortages" muss ein Array sein'], rows: [] };
  }
  const rows = [];
  payload.shortages.forEach((r, i) => {
    if (!r || typeof r !== 'object') { errors.push(`#${i}: kein Objekt`); return; }
    if (typeof r.wirkstoff !== 'string' || !r.wirkstoff.trim()) { errors.push(`#${i}: "wirkstoff" fehlt`); return; }
    if (typeof r.bezeichnung !== 'string' || !r.bezeichnung.trim()) { errors.push(`#${i}: "bezeichnung" fehlt`); return; }
    if (!SHORTAGE_STATUSES.includes(r.status)) { errors.push(`#${i}: "status" ungültig (${r.status})`); return; }
    rows.push({
      wirkstoff: r.wirkstoff.trim(),
      bezeichnung: r.bezeichnung.trim(),
      status: r.status,
      grund: r.grund != null ? String(r.grund) : null,
      gemeldet_am: r.gemeldet_am != null ? String(r.gemeldet_am) : null,
      voraussichtlich_bis: r.voraussichtlich_bis != null ? String(r.voraussichtlich_bis) : null,
    });
  });
  return { ok: errors.length === 0, errors, rows };
}

// Eine Quelle abrufen, validieren und übernehmen. fetchJson ist injizierbar (Tests/Austausch).
// Bei Fehler: KEINE Änderung am Bestand (alte Daten bleiben), aussagekräftiger Report zurück.
export async function refreshShortages(country, { fetchJson, shortagesRepo, env = process.env } = {}) {
  const cc = String(country || '').toUpperCase();
  const url = env[envKey(cc)];
  if (!url) return { ok: false, skipped: true, country: cc, reason: 'keine Quelle konfiguriert' };
  let payload;
  try { payload = await fetchJson(url); }
  catch (e) { return { ok: false, country: cc, error: 'Abruf fehlgeschlagen: ' + (e && e.message) }; }
  const v = validateShortagePayload(payload);
  if (!v.ok) return { ok: false, country: cc, error: 'ungültige Daten — Bestand unverändert', errors: v.errors };
  const source = (payload && typeof payload.source === 'string' && payload.source) || (COUNTRIES[cc] && COUNTRIES[cc].regulator) || 'Live';
  const count = shortagesRepo.replaceFeed(v.rows, { provenance: 'verified', quelle: source });
  return { ok: true, country: cc, count, source, fetched_at: (payload && payload.fetched_at) || null };
}

// ── Preise (zweiter Datentyp, gleiche Anschluss-Logik wie Engpässe) ──
// Vertrag: { country, source, fetched_at, prices: [ { bezeichnung, wirkstoff?, supplier,
//            aep (Zahl > 0), prev_aep?, currency?, series?[Zahlen] } ] }
const priceEnvKey = (country) => `APOTREND_LIVE_PRICES_${String(country || '').toUpperCase()}`;

export function isPriceLive(country, env = process.env) { return !!env[priceEnvKey(country)]; }
export function livePriceSources(env = process.env) {
  const out = {};
  for (const code of Object.keys(COUNTRIES)) { const url = env[priceEnvKey(code)]; if (url) out[code] = { url }; }
  return out;
}

export function validatePricePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, errors: ['Payload fehlt oder ist kein Objekt'], rows: [] };
  }
  if (!Array.isArray(payload.prices)) {
    return { ok: false, errors: ['Feld "prices" muss ein Array sein'], rows: [] };
  }
  const errors = [];
  const rows = [];
  payload.prices.forEach((r, i) => {
    if (!r || typeof r !== 'object') { errors.push(`#${i}: kein Objekt`); return; }
    if (typeof r.bezeichnung !== 'string' || !r.bezeichnung.trim()) { errors.push(`#${i}: "bezeichnung" fehlt`); return; }
    if (typeof r.supplier !== 'string' || !r.supplier.trim()) { errors.push(`#${i}: "supplier" fehlt`); return; }
    const aep = Number(r.aep);
    if (!(aep > 0)) { errors.push(`#${i}: "aep" ungültig (${r.aep})`); return; }
    rows.push({
      bezeichnung: r.bezeichnung.trim(),
      wirkstoff: r.wirkstoff != null ? String(r.wirkstoff) : null,
      supplier: r.supplier.trim(),
      aep,
      prev_aep: r.prev_aep != null && isFinite(Number(r.prev_aep)) ? Number(r.prev_aep) : null,
      currency: typeof r.currency === 'string' && r.currency ? r.currency : 'EUR',
      series: Array.isArray(r.series) ? r.series.filter((x) => typeof x === 'number' && isFinite(x)) : [],
    });
  });
  return { ok: errors.length === 0, errors, rows };
}

export async function refreshPrices(country, { fetchJson, pricesRepo, env = process.env } = {}) {
  const cc = String(country || '').toUpperCase();
  const url = env[priceEnvKey(cc)];
  if (!url) return { ok: false, skipped: true, country: cc, reason: 'keine Quelle konfiguriert' };
  let payload;
  try { payload = await fetchJson(url); }
  catch (e) { return { ok: false, country: cc, error: 'Abruf fehlgeschlagen: ' + (e && e.message) }; }
  const v = validatePricePayload(payload);
  if (!v.ok) return { ok: false, country: cc, error: 'ungültige Daten — Bestand unverändert', errors: v.errors };
  const source = (payload && typeof payload.source === 'string' && payload.source) || 'Live';
  const count = pricesRepo.replaceFeed(v.rows, { provenance: 'verified', quelle: source });
  return { ok: true, country: cc, count, source, fetched_at: (payload && payload.fetched_at) || null };
}

// ── Rabatte/Aktionen (dritter Datentyp, gleiche Anschluss-Logik) ──
// Vertrag: { country, source, prices?…, rabatte: [ { bezeichnung, wirkstoff?, supplier,
//            listenpreis (>0), aktionspreis (>0), min_menge?, gueltig_bis (YYYY-MM-DD),
//            currency? } ] }
const rabatteEnvKey = (country) => `APOTREND_LIVE_RABATTE_${String(country || '').toUpperCase()}`;

export function isRabatteLive(country, env = process.env) { return !!env[rabatteEnvKey(country)]; }
export function liveRabatteSources(env = process.env) {
  const out = {};
  for (const code of Object.keys(COUNTRIES)) { const url = env[rabatteEnvKey(code)]; if (url) out[code] = { url }; }
  return out;
}

export function validateRabattePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, errors: ['Payload fehlt oder ist kein Objekt'], rows: [] };
  }
  if (!Array.isArray(payload.rabatte)) {
    return { ok: false, errors: ['Feld "rabatte" muss ein Array sein'], rows: [] };
  }
  const errors = [];
  const rows = [];
  payload.rabatte.forEach((r, i) => {
    if (!r || typeof r !== 'object') { errors.push(`#${i}: kein Objekt`); return; }
    if (typeof r.bezeichnung !== 'string' || !r.bezeichnung.trim()) { errors.push(`#${i}: "bezeichnung" fehlt`); return; }
    if (typeof r.supplier !== 'string' || !r.supplier.trim()) { errors.push(`#${i}: "supplier" fehlt`); return; }
    const listenpreis = Number(r.listenpreis), aktionspreis = Number(r.aktionspreis);
    if (!(listenpreis > 0)) { errors.push(`#${i}: "listenpreis" ungültig`); return; }
    if (!(aktionspreis > 0)) { errors.push(`#${i}: "aktionspreis" ungültig`); return; }
    if (typeof r.gueltig_bis !== 'string' || !r.gueltig_bis.trim()) { errors.push(`#${i}: "gueltig_bis" fehlt`); return; }
    rows.push({
      bezeichnung: r.bezeichnung.trim(),
      wirkstoff: r.wirkstoff != null ? String(r.wirkstoff) : null,
      supplier: r.supplier.trim(),
      listenpreis, aktionspreis,
      min_menge: r.min_menge != null && isFinite(Number(r.min_menge)) ? Number(r.min_menge) : null,
      gueltig_bis: r.gueltig_bis.trim(),
      currency: typeof r.currency === 'string' && r.currency ? r.currency : 'EUR',
    });
  });
  return { ok: errors.length === 0, errors, rows };
}

export async function refreshRabatte(country, { fetchJson, rabatteRepo, env = process.env } = {}) {
  const cc = String(country || '').toUpperCase();
  const url = env[rabatteEnvKey(cc)];
  if (!url) return { ok: false, skipped: true, country: cc, reason: 'keine Quelle konfiguriert' };
  let payload;
  try { payload = await fetchJson(url); }
  catch (e) { return { ok: false, country: cc, error: 'Abruf fehlgeschlagen: ' + (e && e.message) }; }
  const v = validateRabattePayload(payload);
  if (!v.ok) return { ok: false, country: cc, error: 'ungültige Daten — Bestand unverändert', errors: v.errors };
  const source = (payload && typeof payload.source === 'string' && payload.source) || 'Live';
  const count = rabatteRepo.replaceFeed(v.rows, { provenance: 'verified', quelle: source });
  return { ok: true, country: cc, count, source, fetched_at: (payload && payload.fetched_at) || null };
}

// Standard-Fetcher (JSON über global fetch). In Tests wird stattdessen ein Stub injiziert.
export async function fetchJsonDefault(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// Auto-Refresh: startet NUR, wenn mindestens eine Quelle konfiguriert ist. Läuft sonst nicht
// (bis die Website „angeschlossen" wird). Fehler werden geloggt, brechen aber nie den Server.
export function startLiveRefresh({ shortagesRepo, pricesRepo, rabatteRepo, env = process.env, intervalMs = 15 * 60 * 1000, fetchJson = fetchJsonDefault, log = console } = {}) {
  const tasks = [];
  if (shortagesRepo) for (const cc of Object.keys(liveSources(env))) tasks.push({ cc, kind: 'shortages', run: () => refreshShortages(cc, { fetchJson, shortagesRepo, env }) });
  if (pricesRepo) for (const cc of Object.keys(livePriceSources(env))) tasks.push({ cc, kind: 'prices', run: () => refreshPrices(cc, { fetchJson, pricesRepo, env }) });
  if (rabatteRepo) for (const cc of Object.keys(liveRabatteSources(env))) tasks.push({ cc, kind: 'rabatte', run: () => refreshRabatte(cc, { fetchJson, rabatteRepo, env }) });
  if (!tasks.length) return null; // nichts angeschlossen -> nichts tun
  const runAll = async () => {
    for (const t of tasks) {
      try {
        const r = await t.run();
        if (r.ok) log.log?.(`ApoTrend Live: ${t.cc}/${t.kind} aktualisiert (${r.count} Einträge, Quelle ${r.source})`);
        else log.warn?.(`ApoTrend Live: ${t.cc}/${t.kind} nicht aktualisiert — ${r.error || r.reason}`);
      } catch (e) { log.warn?.(`ApoTrend Live: ${t.cc}/${t.kind} Ausnahme — ${e && e.message}`); }
    }
  };
  runAll(); // sofort einmal beim Start
  const timer = setInterval(runAll, intervalMs);
  if (timer.unref) timer.unref(); // blockiert den Prozess-Exit nicht
  return { stop: () => clearInterval(timer), countries: [...new Set(tasks.map((t) => t.cc))], tasks: tasks.map((t) => `${t.cc}/${t.kind}`) };
}
