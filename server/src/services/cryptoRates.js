// Live-Kurse EUR pro Coin über eine ÖFFENTLICHE, lesende API (CoinGecko). Rein zur
// Anzeige des umgerechneten Betrags — kein Geldfluss, kein Geheimnis. Gecacht (Standard
// 5 min), `fetch` injizierbar (testbar). Bei Netz-/API-Fehler: letzter Stand oder leer,
// damit die Zahlung (Adresse + „in Wallet öffnen") IMMER funktioniert, auch ohne Kurs.
export function createCryptoRates({ fetchImpl = globalThis.fetch, ttlMs = 5 * 60 * 1000, now = () => Date.now() } = {}) {
  let cache = { at: 0, rates: null };
  return {
    async ratesEur(ids = ['bitcoin', 'ethereum', 'solana']) {
      if (cache.rates && (now() - cache.at) < ttlMs) return cache.rates;
      try {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=eur`;
        const r = await fetchImpl(url);
        const j = await r.json();
        const rates = {};
        for (const id of ids) if (j && j[id] && typeof j[id].eur === 'number' && j[id].eur > 0) rates[id] = j[id].eur;
        cache = { at: now(), rates };
        return rates;
      } catch {
        return cache.rates || {}; // Fallback: letzter bekannter Stand oder leer
      }
    },
  };
}
