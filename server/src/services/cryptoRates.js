// Live-Kurse EUR pro Coin über eine ÖFFENTLICHE, lesende API (CoinGecko). Rein zur
// Anzeige des umgerechneten Betrags — kein Geldfluss, kein Geheimnis. Gecacht (Standard
// 5 min), `fetch` injizierbar (testbar). Bei Netz-/API-Fehler: letzter Stand oder leer,
// damit die Zahlung (Adresse + „in Wallet öffnen") IMMER funktioniert, auch ohne Kurs.
//
// Zwischenspeicher JE COIN (11/2026): Vorher galt ein Abruf für alle — wer zuerst nur
// Bitcoin abfragte, bekam danach 5 Minuten lang für Tether/Tron gar keinen Kurs.
// Letzter guter Stand bleibt auch über die Ablaufzeit hinaus als Rückfall (veraltet besser
// als gar keiner — die Zahlungsansicht nennt den Betrag ohnehin als Näherung).
export function createCryptoRates({ fetchImpl = globalThis.fetch, ttlMs = 5 * 60 * 1000, now = () => Date.now(), zeitlimitMs = 8_000 } = {}) {
  const cache = new Map(); // id -> { at, eur }
  let letzterFehler = null;
  let letzterErfolg = null;
  return {
    async ratesEur(ids = ['bitcoin', 'ethereum', 'solana']) {
      const gesucht = [...new Set(ids.map(String).filter((x) => /^[a-z0-9-]{2,40}$/.test(x)))];
      const frisch = (id) => { const c = cache.get(id); return c && (now() - c.at) < ttlMs; };
      const fehlend = gesucht.filter((id) => !frisch(id));
      if (fehlend.length) {
        try {
          const url = `https://api.coingecko.com/api/v3/simple/price?ids=${fehlend.join(',')}&vs_currencies=eur`;
          const ab = new AbortController(); const zeit = setTimeout(() => ab.abort(), zeitlimitMs);
          let j;
          try {
            const r = await fetchImpl(url, { signal: ab.signal });
            if (r && r.ok === false) throw Object.assign(new Error(`HTTP ${r.status}`), { code: 'quelle_gestoert' }); // 429 = Grenze erreicht
            j = await r.json();
          } finally { clearTimeout(zeit); }
          for (const id of fehlend) if (j && j[id] && typeof j[id].eur === 'number' && j[id].eur > 0) cache.set(id, { at: now(), eur: j[id].eur });
          letzterErfolg = now(); letzterFehler = null;
        } catch (e) {
          letzterFehler = (e && e.message) || String(e); // Rückfall: letzter Stand (auch veraltet)
        }
      }
      const rates = {};
      for (const id of gesucht) { const c = cache.get(id); if (c) rates[id] = c.eur; }
      return rates;
    },
    // Zustandssicherung (Datenbank, server.js): Der letzte gute Kurs je Münze übersteht einen
    // Neustart ohne Netz. Sein Zeitstempel bleibt — er gilt also nicht als frisch, wird beim
    // nächsten Bedarf neu abgerufen und dient nur als Rückfall.
    __dump() { return [...cache].map(([id, c]) => [id, { at: c.at, eur: c.eur }]); },
    __load(snap) {
      for (const e of Array.isArray(snap) ? snap : []) {
        if (Array.isArray(e) && typeof e[0] === 'string' && e[1] && typeof e[1].eur === 'number' && e[1].eur > 0 && typeof e[1].at === 'number') cache.set(e[0], { at: e[1].at, eur: e[1].eur });
      }
    },
    /** Stand je Münze (für die Anzeige „Kurs von …"). */
    stand(id) { const c = cache.get(id); return c ? new Date(c.at).toISOString() : null; },
    /** Für Statusseiten: nie Geheimnisse, nur Zeitpunkte. */
    status() {
      return { quelle: 'CoinGecko', zuletzt_ok: letzterErfolg ? new Date(letzterErfolg).toISOString() : null, fehler: letzterFehler, coins: cache.size };
    },
  };
}
