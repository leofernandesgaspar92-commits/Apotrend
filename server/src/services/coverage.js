// ============================================================================
//  Länderabdeckung — was tatsächlich ankommt, nicht was eingetragen ist
// ============================================================================
//  DER UNTERSCHIED, UM DEN ES GEHT
//
//  `/api/live/status` konnte bisher sagen: „Für Nigeria ist eine Quelle
//  eingetragen." Das ist wahr und trotzdem irreführend, denn eingetragen heißt
//  nicht geliefert. Am 05.09.2026 waren 18 Quellen eingetragen und vier haben
//  geantwortet. Eine Apothekerin in Lagos wählt „Nigeria", sieht eine leere
//  Liste — und schließt daraus, dass die Plattform kaputt ist. Sie kommt nicht
//  wieder, und niemand erfährt warum.
//
//  Das Naheliegende wäre gewesen, die zwölf stummen Länder auszublenden. Genau
//  das habe ich im Audit vorgeschlagen — und es war falsch: Nigeria, Kenia,
//  Ghana, Angola und Moçambique sind die Märkte der Afrika-Strategie. Sie
//  unsichtbar zu machen hieße, die Strategie stillzulegen, um ein
//  Anzeigeproblem zu lösen.
//
//  Also der andere Weg: Das Land bleibt wählbar, und die leere Liste bekommt
//  eine ehrliche Erklärung. „Für Nigeria hat die NAFDAC zuletzt nicht
//  geantwortet" ist eine Aussage, mit der man umgehen kann. Eine wortlose
//  leere Liste ist es nicht.
//
//  ──────────────────────────────────────────────────────────────────────────
//  GEMESSEN, NICHT GEPFLEGT
//  ──────────────────────────────────────────────────────────────────────────
//  Der Zustand kommt aus dem letzten echten Durchlauf, nicht aus einer Liste
//  im Code. Eine gepflegte Liste wäre am Tag nach dem nächsten Behördenumbau
//  falsch, und niemand würde es merken. Fängt eine Quelle wieder an zu
//  liefern, verschwindet der Hinweis von selbst — ohne Deploy, ohne dass
//  jemand daran denken muss.
// ============================================================================

/**
 * Speicher für das Ergebnis der letzten Durchläufe.
 *
 * GETRENNT NACH ART (news / shortages), und das ist keine Feinheit:
 * Es sind verschiedene Quellen. Österreich bezieht seine Nachrichten vom
 * BASG-Newsfeed und seine Engpässe aus der BASG-Schnittstelle
 * `vertriebseinschraenkungen.basg.gv.at` — zwei Server, die unabhängig
 * voneinander ausfallen können.
 *
 * Die erste Fassung dieser Datei kannte diese Trennung nicht. Damit erklärte
 * sich die leere ENGPASS-Liste mit der Gesundheit der NACHRICHTEN-Quelle:
 * Läuft der Newsfeed und die Engpass-Schnittstelle nicht, hätte die Ansicht
 * geschwiegen — leere Liste, keine Erklärung, also genau der Zustand, den
 * diese Datei beseitigen soll. Umgekehrt hätte sie eine Störung gemeldet, wo
 * die Engpässe einwandfrei ankommen.
 *
 * Bewusst im Arbeitsspeicher: Nach einem Neustart ist unbekannt, was gilt —
 * und „unbekannt" ist der ehrliche Zustand, bis der erste Durchlauf gelaufen
 * ist. Ein aus der Datenbank geholter Stand von gestern würde behaupten, etwas
 * über heute zu wissen.
 */
export function createCoverageStore({ now = () => Date.now() } = {}) {
  /** `${art}:${land}` -> { ok, quellen: [{id, ok, fehler, meldungen}], stand } */
  const proLand = new Map();
  const schluessel = (art, land) => `${art}:${String(land || '').toUpperCase()}`;

  /** Gemeinsamer Kern beider Übernahmen. */
  function uebernehmen(art, gesammelt) {
    const stand = new Date(now()).toISOString();
    for (const [land, quellenListe] of gesammelt) {
      proLand.set(schluessel(art, land), {
        // „ok" heißt: mindestens eine Quelle hat geantwortet. Ob sie dabei
        // NEUE Meldungen brachte, ist etwas anderes — eine Behörde, die drei
        // Tage nichts veröffentlicht, ist nicht kaputt.
        ok: quellenListe.some((q) => q.ok),
        quellen: quellenListe,
        stand,
      });
    }
  }

  return {
    /**
     * Ergebnis eines News-Durchlaufs übernehmen.
     * `report.perSource` stammt aus services/newsIngest.js.
     */
    ausNewsReport(report, quellen) {
      if (!report || !report.perSource) return;
      // Land der Quelle aus der Quellenliste holen: `perSource` trägt es nur
      // im Erfolgsfall, und gerade der Fehlerfall ist hier der interessante.
      const landVon = new Map((quellen || []).map((s) => [s.id, s.country]));
      const gesammelt = new Map();
      for (const [id, e] of Object.entries(report.perSource)) {
        const land = e.country || landVon.get(id);
        if (!land) continue;
        const liste = gesammelt.get(land) || [];
        liste.push({
          id,
          ok: !!e.ok && e.verified !== false,
          fehler: e.error || (e.verified === false ? e.reason : null) || null,
          meldungen: Number(e.fetched || 0),
        });
        gesammelt.set(land, liste);
      }
      uebernehmen('news', gesammelt);
    },

    /**
     * Ergebnis eines Engpass-Durchlaufs übernehmen.
     * `summary.csv` stammt aus runLiveIngest (http/server.js) und trägt je
     * Quelle entweder `count` (geliefert) oder `error` (gescheitert).
     */
    ausShortageSummary(summary, quellen) {
      if (!summary || !Array.isArray(summary.csv)) return;
      const landVon = new Map((quellen || []).map((s) => [s.id, s.country]));
      const gesammelt = new Map();
      for (const e of summary.csv) {
        const land = landVon.get(e.id);
        if (!land) continue;
        const liste = gesammelt.get(land) || [];
        liste.push({
          id: e.id,
          // Kein Fehler heißt geantwortet. Null Zeilen sind KEIN Ausfall —
          // ein Land ohne aktuelle Engpässe ist eine gute Nachricht, keine
          // Störung. Verworfene Zeilen dagegen schon: Dann hat die Behörde
          // geantwortet, aber ihre Feldnamen geändert.
          ok: !e.error && !(e.rejected > 0 && !e.count),
          fehler: e.error || (e.rejected > 0 && !e.count
            ? `${e.rejected} Zeilen empfangen, keine verwertbar` : null),
          meldungen: Number(e.count || 0),
        });
        gesammelt.set(land, liste);
      }
      uebernehmen('shortages', gesammelt);
    },

    /**
     * Zustand eines Landes.
     * `null` heißt „noch kein Durchlauf" — das ist NICHT dasselbe wie „stumm"
     * und darf nicht als Störung dargestellt werden.
     */
    fuerLand(land, art = 'news') {
      return proLand.get(schluessel(art, land)) || null;
    },

    /** Für /api/live/status: alle Länder mit gemessenem Zustand. */
    alle() {
      return Object.fromEntries([...proLand.entries()].map(([k, e]) => [k, {
        ok: e.ok, stand: e.stand,
        quellen: e.quellen.map((q) => ({ id: q.id, ok: q.ok, fehler: q.fehler })),
      }]));
    },

    size: () => proLand.size,
    // BEWUSST KEIN __dump/__load. Die anderen Speicher dieser Anwendung werden
    // in den Snapshot geschrieben und beim Start zurueckgeholt — dieser nicht.
    // Ein wiederhergestellter Stand von gestern wuerde behaupten, etwas ueber
    // HEUTE zu wissen: Er meldete „NAFDAC antwortet nicht", obwohl seit dem
    // Neustart noch gar kein Abruf gelaufen ist. „unbekannt" ist der ehrliche
    // Zustand, und er stellt sich nach fuenf Minuten von selbst richtig.
    //
    // Die Methoden gab es hier kurz — ungenutzt, weil sie im Snapshot nie
    // eingetragen wurden. Ungenutzter Code, der wie eine Funktion aussieht,
    // ist schlimmer als keiner: Der Naechste haelt Wiederherstellung fuer
    // vorgesehen und baut darauf.
  };
}

/**
 * Die Auskunft, die das Frontend braucht — knapp und ohne Innenleben.
 *
 * Drei Zustände, und die Unterscheidung ist der ganze Punkt:
 *   'liefert'   — mindestens eine Quelle hat zuletzt geantwortet
 *   'stumm'     — es gibt Quellen, aber keine hat geantwortet
 *   'unbekannt' — noch kein Durchlauf seit dem Start (KEIN Fehler!)
 *   'keine'     — für dieses Land ist gar keine Quelle eingetragen
 */
export function landStatus(land, { store, quellen, art = 'news' }) {
  const cc = String(land || '').toUpperCase();
  const eingetragen = (quellen || []).filter((s) => s.country === cc);
  if (!eingetragen.length) return { land: cc, art, zustand: 'keine', quellen: 0, regulator: null };

  const gemessen = store.fuerLand(cc, art);
  if (!gemessen) return { land: cc, art, zustand: 'unbekannt', quellen: eingetragen.length, regulator: null };

  return {
    land: cc,
    art,
    zustand: gemessen.ok ? 'liefert' : 'stumm',
    quellen: eingetragen.length,
    stand: gemessen.stand,
    // Wer nicht antwortet, gehört benannt: „die NAFDAC antwortet nicht" ist
    // eine Aussage, mit der eine Apotheke etwas anfangen kann. „Keine Daten"
    // ist es nicht.
    stumm: gemessen.quellen.filter((q) => !q.ok).map((q) => q.id),
  };
}
