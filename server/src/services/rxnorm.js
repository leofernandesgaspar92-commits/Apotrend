// ============================================================================
//  RxNorm/RxNav — Wirkstoff und Handelsname zusammenbringen
// ============================================================================
//  Das Problem, das dieser Dienst loest: Die Suche vergleicht Text. Wer
//  „Pantoprazol" eingibt, findet nichts, was „Pantoloc" heisst — obwohl es
//  dasselbe Praeparat ist. Im Einkauf ist das der Normalfall, nicht die
//  Ausnahme: Die Engpassmeldung nennt den Wirkstoff, das Angebot des
//  Grosshaendlers den Handelsnamen.
//
//  RxNorm ist das Arzneimittel-Vokabular der US-amerikanischen National
//  Library of Medicine. Die RxNav-Schnittstelle ist oeffentlich und ohne
//  Schluessel nutzbar.
//
//  ──────────────────────────────────────────────────────────────────────────
//  DREI GRENZEN, DIE HIER EINGEBAUT SIND
//  ──────────────────────────────────────────────────────────────────────────
//
//  1. RECHTLICH. Genutzt wird die SCHNITTSTELLE, nicht der Datenbestand. Der
//     vollstaendige RxNorm-Bestand steckt in der UMLS und haengt an einer
//     (kostenlosen, aber zu unterzeichnenden) Lizenz. Deshalb wird hier nichts
//     auf Vorrat heruntergeladen und nichts gespiegelt — es werden einzelne
//     Begriffe nachgeschlagen und kurz zwischengespeichert.
//
//  2. FACHLICH. RxNorm ist US-zentriert. Ein oesterreichischer Handelsname
//     steht dort haeufig NICHT drin. Der Dienst ist deshalb eine ERGAENZUNG
//     der Textsuche, nie ihr Ersatz: Findet er nichts, sucht die Anwendung
//     genau wie bisher weiter.
//
//  3. BETRIEBLICH. Die Schnittstelle bittet um hoechstens etwa 20 Anfragen je
//     Sekunde. Die Suche laeuft im Anfragepfad einer Nutzerin — ein haengender
//     fremder Server darf sie nicht aufhalten. Deshalb: kurzes Zeitlimit,
//     Zwischenspeicher, und bei jedem Zweifel lieber ohne Ergaenzung antworten.
//
//  KEINE MEDIZINISCHE AUSSAGE. Der Dienst liefert Namensvarianten, sonst
//  nichts. Er sagt nicht, dass zwei Praeparate austauschbar sind — das haengt
//  an Darreichungsform, Staerke und nationaler Zulassung. Eine Substitution
//  darf daraus nicht abgeleitet werden (CLAUDE.md: sicherheitsrelevante
//  Aussagen nur mit Quelle).
// ============================================================================

export const RXNAV_BASE = 'https://rxnav.nlm.nih.gov/REST';

/** Zeitlimit im Anfragepfad. Kurz gehalten — siehe Grenze 3 oben. */
export const LOOKUP_TIMEOUT_MS = 1500;
/** Wie lange ein Ergebnis gilt. Namen aendern sich nicht stuendlich. */
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
/** Obergrenze des Zwischenspeichers (Begriffe, nicht Bytes). */
export const CACHE_MAX = 2000;

/**
 * Antwort von /rxcui?name=… auswerten.
 * Getrennt von der Netzabfrage, damit die Auswertung ohne Netz pruefbar ist.
 */
export function parseRxcui(json) {
  const ids = json && json.idGroup && json.idGroup.rxnormId;
  return Array.isArray(ids) && ids.length ? String(ids[0]) : null;
}

/**
 * Antwort von /rxcui/<id>/allrelated auswerten -> Namensvarianten.
 *
 * Uebernommen werden nur die Begriffsarten, die tatsaechlich NAMEN sind:
 *   IN   Wirkstoff (ingredient)
 *   BN   Handelsname (brand name)
 *   PIN  praezisierter Wirkstoff (z. B. als Salz)
 * Dosierungsformen (SCD/SBD) werden bewusst NICHT uebernommen: „Pantoprazol
 * 40 MG Oral Tablet" ist kein Name, nach dem jemand sucht, und wuerde die
 * Trefferliste mit Varianten derselben Sache fluten.
 */
export function parseNames(json, { kinds = ['IN', 'BN', 'PIN'] } = {}) {
  const gruppen = (json && json.allRelatedGroup && json.allRelatedGroup.conceptGroup) || [];
  const out = new Set();
  for (const g of gruppen) {
    if (!kinds.includes(g.tty)) continue;
    for (const c of g.conceptProperties || []) {
      const n = String(c.name || '').trim();
      if (n) out.add(n);
    }
  }
  return [...out];
}

/** Kleiner Zwischenspeicher mit Verfallszeit. Aeltestes zuerst vergessen. */
function createCache({ max = CACHE_MAX, ttlMs = CACHE_TTL_MS, now = Date.now } = {}) {
  const map = new Map();
  return {
    get(key) {
      const e = map.get(key);
      if (!e) return undefined;
      if (now() - e.at > ttlMs) { map.delete(key); return undefined; }
      return e.value;
    },
    set(key, value) {
      map.set(key, { value, at: now() });
      while (map.size > max) map.delete(map.keys().next().value);
    },
    size: () => map.size,
  };
}

export function createRxNormService({
  fetchImpl = globalThis.fetch,
  base = RXNAV_BASE,
  timeoutMs = LOOKUP_TIMEOUT_MS,
  now = Date.now,
  log = console,
} = {}) {
  const cache = createCache({ now });
  const stats = { lookups: 0, hits: 0, misses: 0, errors: 0, cached: 0 };

  async function holen(pfad) {
    const res = await fetchImpl(base + pfad, {
      headers: {
        accept: 'application/json',
        // Die Nutzungsbedingungen bitten um eine erkennbare Kennung, damit die
        // Betreiber bei Auffaelligkeiten wissen, wen sie ansprechen koennen.
        'user-agent': 'ApoPulse/1.0 (Fach-Plattform Arzneimittelversorgung)',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const e = new Error('HTTP ' + res.status);
      e.status = res.status;
      throw e;
    }
    return res.json();
  }

  return {
    /**
     * Namensvarianten zu einem Begriff.
     *
     * Gibt IMMER ein Array zurueck — leer, wenn nichts gefunden wurde oder die
     * Schnittstelle schweigt. Der Aufrufer braucht keinen Fehlerpfad: Ohne
     * Ergaenzung sucht die Anwendung wie bisher.
     */
    async synonyms(term) {
      const begriff = String(term || '').trim();
      // Unter drei Zeichen lohnt es nicht und trifft ohnehin alles.
      if (begriff.length < 3) return [];

      const key = begriff.toLowerCase();
      const gecacht = cache.get(key);
      if (gecacht !== undefined) { stats.cached++; return gecacht; }

      stats.lookups++;
      try {
        const rxcui = parseRxcui(await holen(`/rxcui.json?name=${encodeURIComponent(begriff)}`));
        if (!rxcui) {
          // Auch das Nicht-Finden wird gemerkt: Ein oesterreichischer
          // Handelsname steht dort oft nicht drin, und ohne diesen Eintrag
          // liefe bei jeder Suche danach erneut eine Abfrage ins Leere.
          stats.misses++;
          cache.set(key, []);
          return [];
        }
        const namen = parseNames(await holen(`/rxcui/${encodeURIComponent(rxcui)}/allrelated.json`))
          // Den eingegebenen Begriff selbst nicht als "Synonym" zurueckgeben.
          .filter((n) => n.toLowerCase() !== key);
        stats.hits++;
        cache.set(key, namen);
        return namen;
      } catch (e) {
        stats.errors++;
        // NICHT werfen und NICHT als leeres Ergebnis merken: Ein
        // Netzausfall ist keine Aussage darueber, ob es Synonyme gibt.
        // Wuerde man ihn zwischenspeichern, bliebe die Suche fuer diesen
        // Begriff einen Tag lang schlechter, ohne Grund.
        log.warn?.(`ApoPulse RxNorm: "${begriff}" nicht nachschlagbar — ${(e && e.message) || e}`);
        return [];
      }
    },

    stats: () => ({ ...stats, cacheSize: cache.size() }),
  };
}
