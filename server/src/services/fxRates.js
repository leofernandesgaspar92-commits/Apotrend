// Live-Wechselkurse (Fiat) über eine ÖFFENTLICHE, lesende API (open.er-api.com, ohne Key).
// Nur zur Anzeige/Umrechnung für Import-/Einkaufs-Fälle (z. B. NGN/BRL/AOA ↔ EUR/USD) —
// ECHTE Kurse, nichts erfunden. Gecacht (Standard 1 h), `fetch` injizierbar (testbar). Bei
// Netz-/API-Fehler: letzter Stand oder null (Frontend zeigt dann ehrlich „nicht verfügbar").
// Basis ist immer EUR; Umrechnung A->B über die EUR-Kreuzrate.
export function createFxRates({ fetchImpl = globalThis.fetch, ttlMs = 60 * 60 * 1000, now = () => Date.now() } = {}) {
  let cache = { at: 0, data: null };
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
        const data = { base: 'EUR', rates, updated_at: j.time_last_update_unix ? j.time_last_update_unix * 1000 : now() };
        cache = { at: now(), data };
        return data;
      } catch {
        return cache.data; // letzter bekannter Stand oder null
      }
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
