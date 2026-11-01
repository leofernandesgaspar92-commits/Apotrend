// Live-Wechselkurse (Fiat) über eine ÖFFENTLICHE, lesende API (open.er-api.com, ohne Key).
// Nur zur Anzeige/Umrechnung für Import-/Einkaufs-Fälle (z. B. NGN/BRL/AOA ↔ EUR/USD) —
// ECHTE Kurse, nichts erfunden. Gecacht (Standard 1 h), `fetch` injizierbar (testbar). Bei
// Netz-/API-Fehler: letzter Stand oder null (Frontend zeigt dann ehrlich „nicht verfügbar").
// Basis ist immer EUR; Umrechnung A->B über die EUR-Kreuzrate.
export function createFxRates({ fetchImpl = globalThis.fetch, ttlMs = 60 * 60 * 1000, now = () => Date.now() } = {}) {
  let cache = { at: 0, data: null };
  let letzterFehler = null;
  return {
    async rates() {
      if (cache.data && (now() - cache.at) < ttlMs) return cache.data;
      try {
        const r = await fetchImpl('https://open.er-api.com/v6/latest/EUR');
        const j = await r.json();
        if (!j || j.result !== 'success' || !j.rates || typeof j.rates !== 'object') throw new Error('ungültige FX-Antwort');
        const rates = {};
        for (const [k, v] of Object.entries(j.rates)) if (typeof v === 'number' && v > 0) rates[k] = v;
        if (!rates.EUR) rates.EUR = 1;
        const data = { base: 'EUR', rates, updated_at: j.time_last_update_unix ? j.time_last_update_unix * 1000 : now(), quelle: 'open.er-api.com' };
        cache = { at: now(), data }; letzterFehler = null;
        return data;
      } catch (e) {
        letzterFehler = String((e && e.message) || e).slice(0, 200);
        // Rückfall (11/2026): EZB-Kurse über die Frankfurter API — ohne Schlüssel. Nur ~30
        // Hauptwährungen (USD, GBP, CHF, ZAR …); afrikanische Währungen wie NGN/GHS/XOF/KES
        // fehlen dort. Deshalb werden sie mit dem letzten Stand der Hauptquelle ergänzt, nie erfunden.
        try {
          const r2 = await fetchImpl('https://api.frankfurter.app/latest?from=EUR');
          const f = await r2.json();
          if (!f || f.base !== 'EUR' || !f.rates || typeof f.rates !== 'object') throw Object.assign(new Error('ungültige Frankfurter-Antwort'), { code: 'quelle_gestoert' });
          const rates = { ...((cache.data && cache.data.rates) || {}) };
          for (const [k, v] of Object.entries(f.rates)) if (typeof v === 'number' && v > 0) rates[k] = v;
          rates.EUR = 1;
          const data = { base: 'EUR', rates, updated_at: Date.parse(f.date + 'T16:00:00Z') || now(), quelle: 'EZB (Frankfurter)' };
          cache = { at: now(), data };
          return data;
        } catch {
          return cache.data; // letzter bekannter Stand oder null
        }
      }
    },
    status() {
      return { name: 'wechselkurse', quelle: 'open.er-api.com · Rückfall EZB (Frankfurter)', link: 'https://www.frankfurter.app/', aktiv: true,
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
  };
}
