// @ts-check
// ============================================================================
//  Gemeinsamer Abruf-Baustein für externe Schnittstellen
// ============================================================================
//  Jede externe Quelle (World Bank, Open-Meteo, Frankfurter …) läuft hierüber.
//  Drei Zusagen, die NICHT verhandelbar sind:
//
//  1. ZWISCHENSPEICHER. Derselbe Abruf geht nicht bei jedem Seitenaufruf neu hinaus —
//     erst nach Ablauf von `ttlMs`. Gleichzeitige Anfragen nach demselben Schlüssel
//     teilen sich EINEN Abruf.
//  2. NIE ABSTÜRZEN. Zeitlimit je Abruf; jeder Fehler (Netz, HTTP-Status, kaputte
//     Antwort) wird gefangen. Nach HTTP 429 (Grenze erreicht) pausiert die Quelle.
//  3. RÜCKFALL AUF DEN GESICHERTEN STAND. Der letzte gute Wert liegt im Speicher und
//     wandert mit der Zustandssicherung in die Datenbank (server.js, collectSnapshot) —
//     er übersteht also auch einen Neustart. Ist die Quelle weg, kommt er zurück,
//     gekennzeichnet als `veraltet` mit seinem Stand. Erfunden wird nie etwas: ohne
//     gesicherten Stand heißt es ehrlich `daten: null`.
// ============================================================================

/** @template T @typedef {import('./typen').AbrufErgebnis<T>} AbrufErgebnis */
/** @typedef {import('./typen').QuellenStatus} QuellenStatus */

const MAX_EINTRAEGE = 400;

/** Gesicherte Werte aller Quellen — wird mit dem Zustand gesichert (__dump/__load). */
export function createExternerSpeicher({ jetzt = () => Date.now() } = {}) {
  /** @type {Map<string, { wert: any, at: number }>} */
  const eintraege = new Map();
  return {
    get: (k) => eintraege.get(k) || null,
    set(k, wert) {
      eintraege.delete(k);
      eintraege.set(k, { wert, at: jetzt() });
      while (eintraege.size > MAX_EINTRAEGE) eintraege.delete(eintraege.keys().next().value);
    },
    get groesse() { return eintraege.size; },
    __dump: () => [...eintraege],
    __load(snap) {
      eintraege.clear();
      for (const e of Array.isArray(snap) ? snap : []) {
        if (!Array.isArray(e) || typeof e[0] !== 'string' || !e[1] || typeof e[1].at !== 'number') continue;
        eintraege.set(e[0], { wert: e[1].wert, at: e[1].at });
      }
    },
  };
}

/**
 * @param {{ name: string, quelle: string, link: string, ttlMs: number, speicher: ReturnType<typeof createExternerSpeicher>,
 *   fetchImpl?: typeof fetch, zeitlimitMs?: number, pauseNach429Ms?: number, jetzt?: () => number }} o
 */
export function createAbruf({ name, quelle, link, ttlMs, speicher, fetchImpl = globalThis.fetch, zeitlimitMs = 8_000, pauseNach429Ms = 5 * 60_000, jetzt = () => Date.now() }) {
  const laufend = new Map();
  let zuletztOk = null, letzterFehler = null, pauseBis = 0, abrufe = 0, ausSpeicher = 0;
  const iso = (t) => (t ? new Date(t).toISOString() : null);

  /**
   * @template T
   * @param {string} schluessel  fachlicher Schlüssel (z. B. Land, Hafen)
   * @param {string} url
   * @param {(json: any) => T} lesen  wirft bei unbrauchbarer Antwort
   * @returns {Promise<AbrufErgebnis<T>>}
   */
  async function holen(schluessel, url, lesen) {
    const k = `${name}:${schluessel}`;
    const c = speicher.get(k);
    if (c && jetzt() - c.at < ttlMs) { ausSpeicher++; return { daten: c.wert, stand: iso(c.at), aus: 'zwischenspeicher', veraltet: false }; }
    const rueckfall = (fehler) => (c
      ? { daten: c.wert, stand: iso(c.at), aus: /** @type {'gesichert'} */ ('gesichert'), veraltet: true, fehler }
      : { daten: null, stand: null, aus: /** @type {'keine'} */ ('keine'), veraltet: true, fehler });
    if (jetzt() < pauseBis) return rueckfall('Grenze erreicht — Pause bis ' + iso(pauseBis));
    if (laufend.has(k)) return laufend.get(k);
    const p = (async () => {
      abrufe++;
      const ab = new AbortController();
      const zeit = setTimeout(() => ab.abort(), zeitlimitMs);
      try {
        const r = await fetchImpl(url, { signal: ab.signal, headers: { accept: 'application/json', 'user-agent': 'ApoPulse (+https://www.apopulse.com)' } });
        if (r.status === 429) { pauseBis = jetzt() + pauseNach429Ms; throw Object.assign(new Error('HTTP 429 (Grenze erreicht)'), { code: 'quelle_gestoert' }); }
        if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { code: 'quelle_gestoert' });
        const daten = lesen(await r.json());
        speicher.set(k, daten);
        zuletztOk = jetzt(); letzterFehler = null;
        return { daten, stand: iso(jetzt()), aus: /** @type {'live'} */ ('live'), veraltet: false };
      } catch (e) {
        letzterFehler = e && e.name === 'AbortError' ? `keine Antwort binnen ${zeitlimitMs} ms` : String((e && e.message) || e).slice(0, 200);
        return rueckfall(letzterFehler);
      } finally {
        clearTimeout(zeit);
        laufend.delete(k);
      }
    })();
    laufend.set(k, p);
    return p;
  }

  /** @returns {QuellenStatus} */
  function status() {
    return { name, quelle, link, aktiv: true, zuletzt_ok: iso(zuletztOk), letzter_fehler: letzterFehler, pause_bis: jetzt() < pauseBis ? iso(pauseBis) : null, abrufe, aus_speicher: ausSpeicher };
  }
  return { holen, status };
}
