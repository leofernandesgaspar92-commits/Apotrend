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

// Standard-Fetcher (JSON über global fetch). In Tests wird stattdessen ein Stub injiziert.
export async function fetchJsonDefault(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// Auto-Refresh: startet NUR, wenn mindestens eine Quelle konfiguriert ist. Läuft sonst nicht
// (bis die Website „angeschlossen" wird). Fehler werden geloggt, brechen aber nie den Server.
export function startLiveRefresh({ shortagesRepo, env = process.env, intervalMs = 15 * 60 * 1000, fetchJson = fetchJsonDefault, log = console } = {}) {
  const sources = liveSources(env);
  const codes = Object.keys(sources);
  if (!codes.length) return null; // nichts angeschlossen -> nichts tun
  const runAll = async () => {
    for (const cc of codes) {
      try {
        const r = await refreshShortages(cc, { fetchJson, shortagesRepo, env });
        if (r.ok) log.log?.(`ApoTrend Live: ${cc} aktualisiert (${r.count} Einträge, Quelle ${r.source})`);
        else log.warn?.(`ApoTrend Live: ${cc} nicht aktualisiert — ${r.error || r.reason}`);
      } catch (e) { log.warn?.(`ApoTrend Live: ${cc} Ausnahme — ${e && e.message}`); }
    }
  };
  runAll(); // sofort einmal beim Start
  const timer = setInterval(runAll, intervalMs);
  if (timer.unref) timer.unref(); // blockiert den Prozess-Exit nicht
  return { stop: () => clearInterval(timer), countries: codes };
}
