// In-Memory-Store für Lieferengpässe (Repository-Seam). Beim Deployment ersetzt
// eine echte Quelle diesen Store: der bestehende BASG-Parser (backend/api/
// engpass.js) liefert LIVE-Daten mit provenance='verified'. Hier: kuratierte
// Referenzdaten (provenance='reference'), damit die Herkunft ehrlich sichtbar ist.
import crypto from 'node:crypto';
import { praeparatTreffer } from '../domain/wirkstoffTreffer.js';

// Kuratierte AT-Referenzdaten (NICHT live) — klar als 'reference' gekennzeichnet.
// Die Referenzdaten sind OESTERREICHISCH (BASG-Faelle, AT-Praeparatenamen).
// Bis zum 06.09.2026 trugen sie kein Land und erschienen deshalb in allen
// 16 Laendern. Jetzt stehen sie dort, wohin sie gehoeren — und die uebrigen
// Laender zeigen eine leere Liste MIT Erklaerung (services/coverage.js).
// Das ist die ehrlichere Ansicht: lieber leer als plausibel falsch.
const SEED_LAND = 'AT';
// `vor_tagen` ist das Meldedatum RELATIV zu heute, `termin_in` der
// voraussichtliche Termin relativ zu heute (negativ = bereits ueberschritten).
//
// ──────────────────────────────────────────────────────────────────────────
// WARUM KEINE KALENDERDATEN MEHR (03.10.2026)
// ──────────────────────────────────────────────────────────────────────────
// Hier standen feste Daten aus Juni/Juli 2026. Vier Wochen spaeter zeigte die
// Ansicht Engpaesse, die seit 111 Tagen als „kritisch" gemeldet waren, und
// zwei ueberschrittene Liefertermine — ohne dass sich an einer Zeile Code
// etwas geaendert haette. In sechs Monaten stuende dort „280 Tage seit
// Meldung".
//
// Das ist dieselbe Zeitbombe, die am 05.09.2026 schon die Rabatt-Referenzdaten
// erwischt hat: Sechs von dreizehn Aktionen waren abgelaufen, die Ansicht
// duennte still aus, und ein Test fiel an einem Kalendertag um. Dort wurde sie
// entschaerft, hier blieb sie stehen — jetzt nicht mehr.
//
// Die Abstaende bleiben bewusst erhalten: Ein frisch gemeldeter Fall, ein
// laenger laufender, ein knapp ueberschrittener Termin und ein wieder
// verfuegbares Praeparat. Genau diese Mischung braucht die Ansicht, damit
// Alterssignale und Fristwarnungen ueberhaupt etwas zu zeigen haben.
const SEED = [
  { wirkstoff: 'Amoxicillin',     bezeichnung: 'Amoxicillin 1000 mg Filmtabletten', status: 'kritisch',       grund: 'Erhöhte Nachfrage',      vor_tagen: 9 },
  { wirkstoff: 'Salbutamol',      bezeichnung: 'Salbutamol Inhalat 100 µg',          status: 'eingeschraenkt', grund: 'Produktionsverzögerung', vor_tagen: 21, termin_in: 12 },
  { wirkstoff: 'Clarithromycin',  bezeichnung: 'Clarithromycin 500 mg',              status: 'kritisch',       grund: 'Wirkstoffknappheit',     vor_tagen: 34, termin_in: -3 },
  { wirkstoff: 'Levothyroxin',    bezeichnung: 'Levothyroxin 100 µg Tabletten',      status: 'kritisch',       grund: 'Herstellungsproblem',    vor_tagen: 48 },
  { wirkstoff: 'Ibuprofen',       bezeichnung: 'Ibuprofen 400 mg',                   status: 'eingeschraenkt', grund: 'Kontingentierung',       vor_tagen: 5 },
  { wirkstoff: 'Metformin',       bezeichnung: 'Metformin 850 mg',                   status: 'verfuegbar',     grund: null,                     vor_tagen: 2 },
];

export function createShortagesRepo({ seed = true, today = null } = {}) {
  // Injizierbar wie im Rabatt-Repo: Ein Test, der sich auf „heute" verlaesst,
  // laeuft sonst an irgendeinem Kalendertag anders.
  const heute = () => today || new Date().toISOString().slice(0, 10);
  const tagVersatz = (tage) =>
    new Date(Date.parse(heute() + 'T00:00:00Z') + tage * 86400000).toISOString().slice(0, 10);
  const shortages = new Map();
  // Beobachtungsliste je Nutzer: userId -> Map<wirkstoffLower, Anzeigename>
  const watch = new Map();
  const watchNotes = new Map(); // userId -> Map(normKey -> Notiz) — Premium: private Notizen je Wirkstoff
  const watchAlerts = new Map(); // userId -> Map(normKey -> pct) — Rabatt-Alarm-Schwelle je Wirkstoff
  const alertedDeals = new Map(); // userId -> Set(dealKey) — schon benachrichtigte Aktionen (Dedup)
  const uuid = () => crypto.randomUUID();
  const now = () => new Date().toISOString();
  const norm = (w) => String(w || '').trim().toLowerCase();

  function upsert(s) {
    const row = {
      id: s.id || uuid(), wirkstoff: s.wirkstoff, bezeichnung: s.bezeichnung,
      status: s.status || 'kritisch', grund: s.grund ?? null,
      gemeldet_am: s.gemeldet_am ?? null, voraussichtlich_bis: s.voraussichtlich_bis ?? null,
      // Land des Engpasses. NICHT das Land der meldenden Person, sondern das,
      // fuer das die Meldung gilt: Eine BASG-Meldung betrifft Oesterreich,
      // auch wenn sie ein deutscher Kollege liest.
      //
      // WARUM DAS FELD UEBERHAUPT DAZUKAM (06.09.2026): Es gab keines. Damit
      // sah eine Apotheke in Nairobi oesterreichische Referenzdaten
      // („Levothyroxin 100 µg, kritisch") als IHRE Engpaesse. Korrekt als
      // Referenzdaten gekennzeichnet — und trotzdem im falschen Land. Fuer
      // eine Plattform, deren ganzer Zuschnitt laenderspezifisch ist, ist das
      // kein Schoenheitsfehler: Auf Engpassangaben hin wird umbestellt.
      //
      // `null` heisst ausdruecklich „gilt ueberall" und ist erlaubt — aber
      // nichts, was der Seed nutzt. Wer eine Zeile ohne Land einstellt, tut
      // das bewusst.
      country: s.country === undefined ? null : (s.country ? String(s.country).toUpperCase() : null),
      provenance: s.provenance || 'reference',
      quelle: s.quelle === undefined ? 'Referenzdaten' : s.quelle,
      reporter_user_id: s.reporter_user_id ?? null,
      confirmations: Array.isArray(s.confirmations) ? [...s.confirmations] : [],
      created_at: now(),
    };
    // Statusverlauf: erster Eintrag = Ausgangsmeldung (Datum, Status, Quelle, Herkunft).
    row.history = [{ am: row.gemeldet_am || now().slice(0, 10), status: row.status, quelle: row.quelle ?? null, provenance: row.provenance }];
    shortages.set(row.id, row);
    return { ...row, confirmations: [...row.confirmations] };
  }

  if (seed) {
    SEED.forEach(({ vor_tagen, termin_in, ...r }) => upsert({
      ...r,
      country: SEED_LAND,
      gemeldet_am: tagVersatz(-vor_tagen),
      voraussichtlich_bis: termin_in === undefined ? null : tagVersatz(termin_in),
    }));
  }

  return {
    upsert,
    // Live-/Referenz-Feed ersetzen: entfernt die NICHT von Nutzer:innen gemeldeten Einträge
    // (Seed/Live) DER BETROFFENEN LÄNDER und setzt die übergebenen Zeilen neu.
    // Community-Meldungen (reporter_user_id gesetzt) bleiben unangetastet. Gibt die Anzahl
    // der übernommenen Einträge zurück.
    //
    // Nur die betroffenen Länder (seit 10/2026): Vorher räumte jeder Aufruf ALLE Länder ab.
    // Lieferte die US-Quelle und die österreichische fiel aus, verschwand der letzte
    // bekannte österreichische Stand — obwohl die Ansicht „angezeigt wird der letzte
    // bekannte Stand" versprach. `laender` nennt sie ausdrücklich (nötig, wenn eine
    // Behörde eine LEERE Liste meldet); sonst gelten die Länder der Zeilen.
    replaceFeed(rows, { provenance = 'verified', quelle = null, laender = null } = {}) {
      const betroffen = new Set((laender || (rows || []).map((r) => r.country))
        .map((c) => (c ? String(c).toUpperCase() : null)));
      for (const [id, s] of shortages) if (!s.reporter_user_id && betroffen.has(s.country ?? null)) shortages.delete(id);
      let n = 0;
      // Eigene Quelle der Zeile vor der Sammelangabe: Bei mehreren Behörden in einem
      // Lauf stand sonst an jeder Zeile „BASG, openFDA" statt der einen, die sie meldete.
      for (const r of (rows || [])) { upsert({ ...r, provenance, quelle: r.quelle || quelle }); n++; }
      return n;
    },
    // Status (+ Quelle/Herkunft) eines bestehenden Engpasses ändern, andere Felder erhalten.
    setStatus(id, { status, quelle, provenance, gemeldet_am, grund }) {
      const s = shortages.get(id);
      if (!s) return null;
      const before = s.status;
      if (status !== undefined) s.status = status;
      if (quelle !== undefined) s.quelle = quelle;
      if (provenance !== undefined) s.provenance = provenance;
      if (gemeldet_am !== undefined) s.gemeldet_am = gemeldet_am;
      if (grund !== undefined) s.grund = grund;
      // Statusverlauf fortschreiben (nur bei echter Statusänderung).
      if (status !== undefined && status !== before) {
        if (!Array.isArray(s.history)) s.history = []; // alte Snapshots ohne history
        s.history.push({ am: s.gemeldet_am || now().slice(0, 10), status, quelle: s.quelle ?? null, provenance: s.provenance });
      }
      return { ...s };
    },
    // Voraussichtlichen Wiederverfügbarkeits-Termin setzen/entfernen (null = unbekannt).
    setExpectedDate(id, voraussichtlich_bis) {
      const s = shortages.get(id);
      if (!s) return null;
      s.voraussichtlich_bis = voraussichtlich_bis ?? null;
      return { ...s };
    },
    get(id) { const s = shortages.get(id); return s ? { ...s, confirmations: [...(s.confirmations || [])], history: (s.history || []).map(h => ({ ...h })) } : null; },
    /**
     * `country` filtert auf ein Land. Zeilen OHNE Land ("gilt ueberall")
     * kommen immer mit — sonst verschwaende ein bewusst laenderloser Eintrag
     * still. Ohne Angabe bleibt alles sichtbar; die Entscheidung, wer filtert,
     * liegt beim Aufrufer.
     */
    list({ country = null } = {}) {
      const rank = { kritisch: 2, eingeschraenkt: 1, verfuegbar: 0 };
      const cc = country ? String(country).toUpperCase() : null;
      return [...shortages.values()]
        .filter((s) => !cc || !s.country || s.country === cc)
        .sort((a, b) => rank[b.status] - rank[a.status])
        .map(s => ({ ...s, confirmations: [...(s.confirmations || [])], history: (s.history || []).map(h => ({ ...h })) }));
    },
    // Bestätigung ("auch bei uns") durch eine Apotheke; kein Doppel, nicht der Melder.
    confirm(id, userId, am = heute()) {
      const s = shortages.get(id);
      if (!s) return null;
      if (!Array.isArray(s.confirmations)) s.confirmations = [];
      if (userId && userId !== s.reporter_user_id && !s.confirmations.includes(userId)) { s.confirmations.push(userId); s.zuletzt_aktiv = am; s.erinnert = false; }
      return { ...s, confirmations: [...s.confirmations] };
    },
    unconfirm(id, userId) {
      const s = shortages.get(id);
      if (!s) return null;
      if (Array.isArray(s.confirmations)) s.confirmations = s.confirmations.filter(u => u !== userId);
      return { ...s, confirmations: [...(s.confirmations || [])] };
    },
    // Dedup der Melder-Benachrichtigung: je (Engpass, Apotheke) nur EINMAL benachrichtigen —
    // auch bei wiederholtem confirm/unconfirm. Wird bei unconfirm bewusst NICHT zurückgesetzt.
    wasConfirmNotified(id, userId) { const s = shortages.get(id); return !!(s && Array.isArray(s.notified_confirmers) && s.notified_confirmers.includes(userId)); },
    // „Noch aktuell" (Apotheken-Meldung): letzte Aktivität auf heute; wer
    // bestätigt, zählt — Meldende nur als Auffrischung, nicht doppelt.
    nochAktuell(id, userId, am = heute()) {
      const s = shortages.get(id);
      if (!s) return null;
      if (!Array.isArray(s.confirmations)) s.confirmations = [];
      if (userId && userId !== s.reporter_user_id && !s.confirmations.includes(userId)) s.confirmations.push(userId);
      s.zuletzt_aktiv = am; s.erinnert = false;
      return { ...s, confirmations: [...s.confirmations] };
    },
    markErinnert(id) { const s = shortages.get(id); if (s) s.erinnert = true; },
    wasBestaetigtGemeldet(id) { const s = shortages.get(id); return !!(s && s.bestaetigt_gemeldet); },
    markBestaetigtGemeldet(id) { const s = shortages.get(id); if (s) s.bestaetigt_gemeldet = true; },
    markConfirmNotified(id, userId) { const s = shortages.get(id); if (!s) return; if (!Array.isArray(s.notified_confirmers)) s.notified_confirmers = []; if (!s.notified_confirmers.includes(userId)) s.notified_confirmers.push(userId); },

    // ── Beobachtungsliste (Wirkstoffe je Nutzer) ──
    addWatch(userId, wirkstoff) {
      const key = norm(wirkstoff);
      if (!key) return;
      if (!watch.has(userId)) watch.set(userId, new Map());
      watch.get(userId).set(key, String(wirkstoff).trim());
    },
    removeWatch(userId, wirkstoff) {
      const m = watch.get(userId);
      if (m) { m.delete(norm(wirkstoff)); if (m.size === 0) watch.delete(userId); }
    },
    isWatched(userId, wirkstoff) {
      const m = watch.get(userId);
      return !!(m && m.has(norm(wirkstoff)));
    },
    listWatch(userId) {
      const m = watch.get(userId);
      return m ? [...m.values()] : [];
    },
    // Private Notiz je beobachtetem Wirkstoff (Premium). Leerer Text löscht die Notiz.
    setWatchNote(userId, wirkstoff, note) {
      const key = norm(wirkstoff); if (!key) return;
      const text = String(note ?? '').trim().slice(0, 280);
      if (!watchNotes.has(userId)) watchNotes.set(userId, new Map());
      const m = watchNotes.get(userId);
      if (text) m.set(key, text); else { m.delete(key); if (m.size === 0) watchNotes.delete(userId); }
    },
    getWatchNote(userId, wirkstoff) {
      const m = watchNotes.get(userId);
      return (m && m.get(norm(wirkstoff))) || '';
    },
    // Rabatt-Alarm-Schwelle je beobachtetem Wirkstoff (Prozent). 0/null löscht sie.
    setWatchAlert(userId, wirkstoff, pct) {
      const key = norm(wirkstoff); if (!key) return;
      if (!watchAlerts.has(userId)) watchAlerts.set(userId, new Map());
      const m = watchAlerts.get(userId);
      if (pct && pct > 0) m.set(key, pct); else { m.delete(key); if (m.size === 0) watchAlerts.delete(userId); }
    },
    getWatchAlert(userId, wirkstoff) { const m = watchAlerts.get(userId); return (m && m.get(norm(wirkstoff))) || null; },
    // Dedup: eine konkrete Aktion (dealKey) nur einmal je Nutzer:in melden.
    wasDealAlerted(userId, dealKey) { const s = alertedDeals.get(userId); return !!(s && s.has(dealKey)); },
    markDealAlerted(userId, dealKey) { if (!alertedDeals.has(userId)) alertedDeals.set(userId, new Set()); alertedDeals.get(userId).add(dealKey); },
    // Alle Nutzer, die diesen Wirkstoff beobachten (für Statusänderungs-Alerts).
    usersWatching(wirkstoff) {
      const key = norm(wirkstoff);
      const out = [];
      for (const [userId, m] of watch) if (m.has(key)) out.push(userId);
      return out;
    },
    // Alle Beobachtungslisten auf einmal — fuer den Wirkstoff-Alarm zu
    // Behoerdenmeldungen (services/signalAlerts.js).
    //
    // Warum nicht `watchersForText` darunter: Der Alarm vergleicht STRENGER.
    // Eine Behoerdenmeldung ist ein Satz, dort steht der Wirkstoff als eigenes
    // Wort; eine Praeparat-Bezeichnung ist ein zusammengesetzter Name
    // („ASS100 Hexal"). Beide Regeln stehen in domain/wirkstoffTreffer.js,
    // mit Begruendung. Der Alarm braucht dafuer die rohen Listen.
    //
    // Gibt den ANZEIGENAMEN zurueck, nicht den Normschluessel: Was die Person
    // eingetragen hat, steht spaeter in ihrer Benachrichtigung.
    listWatchers() {
      const out = [];
      for (const [userId, m] of watch) {
        const wirkstoffe = [...m.values()];
        if (wirkstoffe.length) out.push({ userId, wirkstoffe });
      }
      return out;
    },
    // Beobachter:innen, deren Wirkstoff in einer Praeparat-Bezeichnung vorkommt
    // (Tauschangebot). Ein Treffer je Nutzer (erster passender Wirkstoff als Label).
    //
    // `praeparatTreffer` statt `includes`: Mit `includes` meldete ein
    // beobachtetes „ASS" jede „Kassenpackung" und jede „Massagecreme" — und wer
    // zwei Fehlalarme bekommt, schaltet die Benachrichtigung ab. Die Regel
    // grenzt links ab und laesst rechts ein Kompositum zu, damit „ASS100 Hexal"
    // und „Ibuprofenlysinat" weiter treffen (domain/wirkstoffTreffer.js).
    watchersForText(text) {
      const hay = String(text || '');
      if (!hay) return [];
      const out = [];
      for (const [userId, m] of watch) {
        for (const [key, display] of m) {
          if (key && praeparatTreffer(hay, key)) { out.push({ userId, wirkstoff: display }); break; }
        }
      }
      return out;
    },
    purgeUser(userId) {
      watch.delete(userId);
      watchNotes.delete(userId);
      watchAlerts.delete(userId);
      alertedDeals.delete(userId);
      // Melder-Identität anonymisieren, Bestätigungen des Nutzers entfernen (DSGVO).
      for (const s of shortages.values()) {
        if (s.reporter_user_id === userId) s.reporter_user_id = null;
        if (Array.isArray(s.confirmations)) s.confirmations = s.confirmations.filter(u => u !== userId);
      }
    },

    __dump() { return { shortages: [...shortages], watch: [...watch].map(([u, m]) => [u, [...m]]), watchNotes: [...watchNotes].map(([u, m]) => [u, [...m]]), watchAlerts: [...watchAlerts].map(([u, m]) => [u, [...m]]), alertedDeals: [...alertedDeals].map(([u, s]) => [u, [...s]]) }; },
    __load(data) {
      if (!data) return;
      // Rückwärtskompatibel: alter Snapshot war ein reines Engpass-Array.
      const rows = Array.isArray(data) ? data : data.shortages;
      if (rows) { shortages.clear(); for (const [k, v] of rows) shortages.set(k, v); }
      watch.clear();
      if (!Array.isArray(data) && data.watch) {
        for (const [u, entries] of data.watch) watch.set(u, new Map(entries));
      }
      watchNotes.clear();
      if (!Array.isArray(data) && data.watchNotes) {
        for (const [u, entries] of data.watchNotes) watchNotes.set(u, new Map(entries));
      }
      watchAlerts.clear();
      if (!Array.isArray(data) && data.watchAlerts) {
        for (const [u, entries] of data.watchAlerts) watchAlerts.set(u, new Map(entries));
      }
      alertedDeals.clear();
      if (!Array.isArray(data) && data.alertedDeals) {
        for (const [u, keys] of data.alertedDeals) alertedDeals.set(u, new Set(keys));
      }
    },
  };
}
