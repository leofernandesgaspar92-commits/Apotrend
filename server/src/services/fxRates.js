// Live-Wechselkurse (Fiat), EUR-Basis — nur zur Anzeige/Umrechnung, nichts erfunden.
//
// Quellen (Sprint 4, 11/2026), beide ohne Schlüssel, je Abruf parallel:
//   1. EZB-Referenzkurse über die Frankfurter API (api.frankfurter.app) — amtlich, aber nur
//      ~30 Hauptwährungen (USD, GBP, CHF, ZAR …).
//   2. open.er-api.com — ergänzt alles, was die EZB nicht führt (NGN, GHS, KES, XOF, AOA …).
// Für jede Währung gilt der EZB-Kurs, wenn es ihn gibt; `quellen` sagt je Währung, woher der
// Kurs stammt, damit der Umrechner es anzeigen kann.
//
// Rückfall: Fällt eine Quelle aus, bleiben ihre Währungen auf dem letzten Stand; fallen beide
// aus, kommt der letzte Stand ganz (`veraltet: true`). Dieser Stand wird mit der Zustands-
// sicherung in die Datenbank geschrieben (__dump/__load, server.js) und übersteht so auch einen
// Neustart ohne Netz. Ohne jeden Stand: null — das Frontend sagt dann „nicht verfügbar".
export const QUELLE_EZB = 'EZB (Frankfurter)';
export const QUELLE_ER = 'open.er-api.com';
const VERALTET_NACH_MS = 36 * 60 * 60 * 1000; // EZB veröffentlicht werktags; >36 h = nicht aktuell

export function createFxRates({ fetchImpl = globalThis.fetch, ttlMs = 60 * 60 * 1000, now = () => Date.now() } = {}) {
  let cache = { at: 0, data: null };
  let letzterFehler = null;
  let laufend = null;

  async function holeEzb() {
    const r = await fetchImpl('https://api.frankfurter.app/latest?from=EUR');
    const f = await r.json();
    if (!f || f.base !== 'EUR' || !f.rates || typeof f.rates !== 'object') throw Object.assign(new Error('ungültige Frankfurter-Antwort'), { code: 'quelle_gestoert' });
    return { rates: f.rates, at: Date.parse(f.date + 'T16:00:00Z') || now() };
  }
  async function holeEr() {
    const r = await fetchImpl('https://open.er-api.com/v6/latest/EUR');
    const j = await r.json();
    if (!j || j.result !== 'success' || !j.rates || typeof j.rates !== 'object') throw Object.assign(new Error('ungültige FX-Antwort'), { code: 'quelle_gestoert' });
    return { rates: j.rates, at: j.time_last_update_unix ? j.time_last_update_unix * 1000 : now() };
  }

  async function abrufen() {
    const [ezb, er] = await Promise.allSettled([holeEzb(), holeEr()]);
    if (ezb.status === 'rejected' && er.status === 'rejected') {
      letzterFehler = String((er.reason && er.reason.message) || er.reason).slice(0, 200);
      if (cache.data) cache.data = { ...cache.data, veraltet: true };
      return cache.data; // letzter bekannter Stand (auch aus der Datenbank) oder null
    }
    const alt = cache.data || { rates: {}, quellen: {} };
    const rates = { ...alt.rates }, quellen = { ...(alt.quellen || {}) };
    const nimm = (res, quelle) => { for (const [k, v] of Object.entries(res.value.rates)) if (typeof v === 'number' && v > 0) { rates[k] = v; quellen[k] = quelle; } };
    if (er.status === 'fulfilled') nimm(er, QUELLE_ER);
    if (ezb.status === 'fulfilled') nimm(ezb, QUELLE_EZB); // EZB hat Vorrang
    rates.EUR = 1; quellen.EUR = ezb.status === 'fulfilled' ? QUELLE_EZB : QUELLE_ER;
    const zeiten = [ezb, er].filter((x) => x.status === 'fulfilled').map((x) => x.value.at);
    const quelle = ezb.status === 'fulfilled' && er.status === 'fulfilled' ? `${QUELLE_EZB} + ${QUELLE_ER}` : ezb.status === 'fulfilled' ? QUELLE_EZB : QUELLE_ER;
    letzterFehler = ezb.status === 'rejected' ? `EZB: ${String((ezb.reason && ezb.reason.message) || ezb.reason).slice(0, 150)}`
      : er.status === 'rejected' ? `open.er-api: ${String((er.reason && er.reason.message) || er.reason).slice(0, 150)}` : null;
    const data = { base: 'EUR', rates, quellen, updated_at: Math.min(...zeiten), quelle, veraltet: false };
    cache = { at: now(), data };
    return data;
  }

  return {
    async rates() {
      if (cache.data && (now() - cache.at) < ttlMs) return cache.data;
      if (!laufend) laufend = abrufen().finally(() => { laufend = null; });
      return laufend;
    },
    /** Für die Anzeige: ist der Stand zu alt (z. B. nach Neustart ohne Netz)? */
    istVeraltet(d = cache.data) { return !d || !!d.veraltet || (now() - (d.updated_at || 0)) > VERALTET_NACH_MS; },
    status() {
      return { name: 'wechselkurse', quelle: `${QUELLE_EZB} · ergänzt durch ${QUELLE_ER}`, link: 'https://www.frankfurter.app/', aktiv: true,
        zuletzt_ok: cache.at ? new Date(cache.at).toISOString() : null, letzter_fehler: letzterFehler, pause_bis: null, abrufe: 0, aus_speicher: 0 };
    },
    // Betrag von Währung A nach B umrechnen (EUR-Kreuzrate). Gibt null, wenn ein Kurs fehlt.
    convert(amount, from, to, data) {
      const d = data || cache.data;
      if (!d || !d.rates) return null;
      const a = d.rates[from], b = d.rates[to];
      if (!(a > 0) || !(b > 0) || !isFinite(amount)) return null;
      return (amount / a) * b;
    },
    // Zustandssicherung (Datenbank): letzter guter Stand übersteht Neustarts.
    __dump() { return cache.data ? { data: cache.data } : null; },
    __load(snap) {
      const d = snap && snap.data;
      if (!d || !d.rates || typeof d.rates !== 'object') return;
      cache = { at: 0, data: { ...d, veraltet: true } }; // at 0: beim ersten Bedarf neu abrufen
    },
  };
}
