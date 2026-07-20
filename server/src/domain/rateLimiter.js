// Kleiner In-Memory-Ratenbegrenzer (gleitendes Zeitfenster) — schützt den Login
// gegen Brute-Force, ohne externe Abhängigkeit (Constraint: nur Built-ins).
// Schlüssel = z. B. `${ip}|${email}`. `check()` liest nur, `fail()` zählt einen
// Fehlversuch, `reset()` löscht nach erfolgreicher Anmeldung.
export function createRateLimiter({ max = 5, windowMs = 15 * 60 * 1000, now = () => Date.now() } = {}) {
  const hits = new Map(); // key -> aufsteigend sortierte Zeitstempel der Fehlversuche im Fenster

  const prune = (arr, t) => { const cut = t - windowMs; let i = 0; while (i < arr.length && arr[i] <= cut) i++; return i ? arr.slice(i) : arr; };

  return {
    // Ist der Schlüssel aktuell gesperrt? Ohne Seiteneffekt (vor dem Versuch aufrufen).
    check(key) {
      const t = now();
      const arr = prune(hits.get(key) || [], t);
      if (arr.length) hits.set(key, arr); else hits.delete(key);
      const blocked = arr.length >= max;
      return {
        blocked,
        remaining: Math.max(0, max - arr.length),
        retryAfterMs: blocked ? Math.max(0, arr[0] + windowMs - t) : 0,
      };
    },
    // Einen Fehlversuch verbuchen; liefert die Anzahl im Fenster.
    fail(key) {
      const t = now();
      const arr = prune(hits.get(key) || [], t);
      arr.push(t);
      hits.set(key, arr);
      return arr.length;
    },
    reset(key) { hits.delete(key); },
    _size() { return hits.size; },
  };
}
