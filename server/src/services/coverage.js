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
 * Bewusst im Arbeitsspeicher: Nach einem Neustart ist unbekannt, was gilt —
 * und „unbekannt" ist der ehrliche Zustand, bis der erste Durchlauf gelaufen
 * ist. Ein aus der Datenbank geholter Stand von gestern würde behaupten, etwas
 * über heute zu wissen.
 */
export function createCoverageStore({ now = () => Date.now() } = {}) {
  /** land -> { ok, quellen: [{id, ok, fehler, meldungen}], stand } */
  const proLand = new Map();

  return {
    /**
     * Ergebnis eines News-Durchlaufs übernehmen.
     * `report.perSource` stammt aus services/newsIngest.js.
     */
    ausNewsReport(report, quellen) {
      if (!report || !report.perSource) return;
      const stand = new Date(now()).toISOString();
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
      for (const [land, quellenListe] of gesammelt) {
        proLand.set(land, {
          // „ok" heißt: mindestens eine Quelle hat geantwortet. Ob sie dabei
          // NEUE Meldungen brachte, ist etwas anderes — eine Behörde, die drei
          // Tage nichts veröffentlicht, ist nicht kaputt.
          ok: quellenListe.some((q) => q.ok),
          quellen: quellenListe,
          stand,
        });
      }
    },

    /**
     * Zustand eines Landes.
     * `null` heißt „noch kein Durchlauf" — das ist NICHT dasselbe wie „stumm"
     * und darf nicht als Störung dargestellt werden.
     */
    fuerLand(land) {
      return proLand.get(String(land || '').toUpperCase()) || null;
    },

    /** Für /api/live/status: alle Länder mit gemessenem Zustand. */
    alle() {
      return Object.fromEntries([...proLand.entries()].map(([land, e]) => [land, {
        ok: e.ok, stand: e.stand,
        quellen: e.quellen.map((q) => ({ id: q.id, ok: q.ok, fehler: q.fehler })),
      }]));
    },

    size: () => proLand.size,
    __dump: () => [...proLand],
    __load(rows) { if (!rows) return; proLand.clear(); for (const [k, v] of rows) proLand.set(k, v); },
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
export function landStatus(land, { store, quellen }) {
  const cc = String(land || '').toUpperCase();
  const eingetragen = (quellen || []).filter((s) => s.country === cc);
  if (!eingetragen.length) return { land: cc, zustand: 'keine', quellen: 0, regulator: null };

  const gemessen = store.fuerLand(cc);
  if (!gemessen) return { land: cc, zustand: 'unbekannt', quellen: eingetragen.length, regulator: null };

  return {
    land: cc,
    zustand: gemessen.ok ? 'liefert' : 'stumm',
    quellen: eingetragen.length,
    stand: gemessen.stand,
    // Wer nicht antwortet, gehört benannt: „die NAFDAC antwortet nicht" ist
    // eine Aussage, mit der eine Apotheke etwas anfangen kann. „Keine Daten"
    // ist es nicht.
    stumm: gemessen.quellen.filter((q) => !q.ok).map((q) => q.id),
  };
}
