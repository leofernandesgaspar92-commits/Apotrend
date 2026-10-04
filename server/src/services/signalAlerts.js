// ============================================================================
//  Wirkstoff-Alarm: wenn eine Behörde etwas zu DEINEM Wirkstoff meldet
// ============================================================================
//  Bis hierher war ApoPulse ein Portal, in das man schauen muss. Die
//  Beobachtungsliste gab es schon, aber sie wurde nur beim Öffnen der Seite
//  ausgewertet — eine Rückrufmeldung um 3 Uhr nachts erreichte niemanden.
//  Dieses Modul schließt die Lücke: Kommt ein Live-Signal herein, dessen
//  Wirkstoff jemand beobachtet, bekommt diese Person eine Benachrichtigung.
//
//  ──────────────────────────────────────────────────────────────────────────
//  DER TEUERSTE FEHLER HIER IST NICHT EIN VERPASSTER ALARM
//  ──────────────────────────────────────────────────────────────────────────
//  Es ist ein Alarm zu viel. Eine Apothekerin, die dreimal am Tag „Neue
//  Meldung zu Ibuprofen" bekommt und jedes Mal eine Pressemitteilung
//  vorfindet, schaltet die Kategorie ab — und verpasst dann auch den
//  Chargenrückruf. Ein stummer Melder ist schlimmer als gar keiner, weil man
//  sich auf ihn verlässt.
//
//  Deshalb drei Bremsen, jede mit eigenem Grund:
//
//   1. WORTGRENZEN beim Treffer. „ASS" darf nicht in „KLASSE" treffen, und
//      ein Kürzel unter vier Zeichen wird in Fließtext überhaupt nicht
//      gesucht. Das ist die häufigste Quelle von Fehlalarmen.
//   2. EIN ALARM JE MELDUNG. Derselbe Behördenhinweis im nächsten
//      Fünf-Minuten-Takt meldet nicht erneut.
//   3. EIN ALARM JE WIRKSTOFF UND TAG. Fünf EMA-Meldungen zu Amoxicillin an
//      einem Tag ergeben einen Hinweis, nicht fünf.
//
//  ──────────────────────────────────────────────────────────────────────────
//  WAS DIESER ALARM NICHT TUT
//  ──────────────────────────────────────────────────────────────────────────
//  Er behauptet KEINEN Status. Er sagt: „Eine Behörde hat etwas gemeldet, in
//  dem dein Wirkstoff vorkommt — hier ist der Link." Die Einordnung macht die
//  Apothekerin an der Originalquelle. Das ist der Unterschied zu einem
//  Engpass-Datensatz, und er ist der Grund, warum ein Treffer im TITEL hier
//  zulässig ist, während er für einen Datensatz verboten wäre (sources.js):
//  Eine Meldung mit Link ist überprüfbar, ein geratener Statuswert nicht.
// ============================================================================

/** Mindestlänge für die Suche in Fließtext. Kürzeres trifft zu oft falsch. */
export const MIN_TITEL_LAENGE = 4;

/** Regex-Sonderzeichen entschärfen — Wirkstoffnamen enthalten „(", „+", „." */
const escape = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Kommt `nadel` als eigenes Wort in `heuhaufen` vor?
 *
 * Bewusst NICHT `includes`: Damit träfe ein beobachtetes „ASS" in „KLASSE",
 * „PASSIERT" und „GLASSPLITTER". Genau diese Klasse von Fehlalarm bringt
 * Leute dazu, die Kategorie abzuschalten.
 *
 * Und bewusst nicht `\b`: Das ist in JavaScript ASCII-basiert und zieht
 * mitten durch „Paracetamolhaltige" und „Acetylsalicylsäure". Die Grenze wird
 * deshalb über Unicode-Buchstaben und -Zahlen gebildet — ein Bindestrich,
 * Leerzeichen, Komma oder Klammerende gilt als Grenze, ein Umlaut nicht.
 */
export function wortTreffer(heuhaufen, nadel) {
  const hay = String(heuhaufen || '');
  const n = String(nadel || '').trim();
  if (!hay || !n) return false;
  try {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escape(n)}(?![\\p{L}\\p{N}])`, 'iu');
    return re.test(hay);
  } catch {
    // Sollte nicht vorkommen (escape oben), aber ein kaputter Wirkstoffname
    // darf keinen Abruf abbrechen. Dann lieber kein Treffer als ein Absturz.
    return false;
  }
}

/**
 * Woher stammt der Treffer? Das steht später an der Benachrichtigung.
 *
 * Reihenfolge ist Aussagekraft: Der von der KI extrahierte Wirkstoff ist
 * belastbarer als ein Wort im Titel. Wer wissen will, wie sicher ein Alarm
 * ist, soll es sehen können.
 */
export function trefferQuelle(signal, wirkstoff) {
  if (!signal || !wirkstoff) return null;
  const w = String(wirkstoff).trim();
  if (!w) return null;
  if (wortTreffer(signal.wirkstoff, w)) return 'wirkstoff';
  if (wortTreffer(signal.handelsname, w)) return 'handelsname';
  // Fließtext: erst ab vier Zeichen. „ASS", „BCG", „HES" sind in einer
  // Behördenüberschrift nicht sicher von Abkürzungen zu unterscheiden.
  if (w.length >= MIN_TITEL_LAENGE && wortTreffer(signal.title, w)) return 'titel';
  return null;
}

/**
 * Länder, die EU-weite Meldungen (EMA) mitbekommen.
 *
 * Nicht „alle europäischen": Die EMA-Zulassung gilt im EU-/EWR-Raum. AT, DE
 * und PT sind EU, LI gehört über den EWR dazu. Die SCHWEIZ ist bewusst NICHT
 * dabei — Swissmedic entscheidet eigenständig, und eine EMA-Meldung ist dort
 * keine Behördenaussage. Wer sie trotzdem sehen will, findet sie im Reiter
 * „Live-Warnungen" über den Länder-Umschalter; ein unaufgeforderter Alarm aus
 * einer fremden Jurisdiktion ist etwas anderes.
 */
export const EU_WEIT_EMPFAENGER = Object.freeze(['AT', 'DE', 'PT', 'LI']);

/** Betrifft eine Meldung aus `signalLand` jemanden in `nutzerLand`? */
export function landPasst(signalLand, nutzerLand) {
  const s = String(signalLand || '').toUpperCase();
  const u = String(nutzerLand || '').toUpperCase();
  if (!s || !u) return false;
  if (s === u) return true;
  return s === 'EU' && EU_WEIT_EMPFAENGER.includes(u);
}

/** Tagesschlüssel für die Flutbremse — UTC, damit er nicht von der Zeitzone abhängt. */
export const tagesSchluessel = (wirkstoff, jetzt) =>
  `sigday:${String(wirkstoff).trim().toLowerCase()}:${new Date(jetzt).toISOString().slice(0, 10)}`;

/** Schlüssel „diese Meldung an diese Person" — gegen Doppelmeldung. */
export const meldungsSchluessel = (signal) => `sig:${signal.dedupeKey}`;

/**
 * Wer soll zu diesem Signal benachrichtigt werden?
 *
 * REIN — kein Zugriff auf Repos, kein Schreiben. Dadurch ist die eigentliche
 * Entscheidung („wer, warum, warum nicht") vollständig testbar, ohne einen
 * Server zu starten. Das Eintragen passiert in `benachrichtigeZuSignal`.
 *
 * `beobachter`: [{ userId, country, wirkstoffe: [...] }]
 * `schonGemeldet(userId, schluessel) -> bool`
 */
export function alarmeFuerSignal({ signal, beobachter = [], schonGemeldet = () => false, jetzt = Date.now() }) {
  const out = [];
  if (!signal || !signal.dedupeKey || !signal.title) return out;
  const meldung = meldungsSchluessel(signal);

  for (const b of beobachter) {
    if (!b || !b.userId) continue;
    if (!landPasst(signal.country, b.country)) continue;
    // Diese Meldung hat diese Person schon bekommen.
    if (schonGemeldet(b.userId, meldung)) continue;

    for (const wirkstoff of (b.wirkstoffe || [])) {
      const quelle = trefferQuelle(signal, wirkstoff);
      if (!quelle) continue;
      // Tagesbremse je Wirkstoff. Sie steht NACH dem Treffer, damit ein
      // Wirkstoff ohne Treffer nicht das Tagesbudget eines anderen verbraucht.
      const tag = tagesSchluessel(wirkstoff, jetzt);
      if (schonGemeldet(b.userId, tag)) continue;
      out.push({ userId: b.userId, wirkstoff, quelle, meldungsSchluessel: meldung, tagesSchluessel: tag });
      // EIN Treffer je Person je Meldung. Wer Amoxicillin UND Amoxicillin-Natrium
      // beobachtet, bekommt zu derselben Meldung nicht zwei Hinweise.
      break;
    }
  }
  return out;
}

/**
 * Die Benachrichtigungen tatsächlich eintragen.
 *
 * Alle Abhängigkeiten werden hereingegeben — derselbe Seam wie bei den übrigen
 * Diensten. `notify` darf werfen, ohne den Abruf mitzunehmen: Eine
 * Benachrichtigung ist eine Verbesserung, die Meldung selbst steht auch ohne
 * sie im Feed.
 */
export function benachrichtigeZuSignal(signal, {
  beobachter, schonGemeldet, merkeGemeldet, notify, jetzt = Date.now(), log = null,
}) {
  const alarme = alarmeFuerSignal({ signal, beobachter, schonGemeldet, jetzt });
  let gesendet = 0;
  for (const a of alarme) {
    try {
      // Label-Form wie bei watch_alert: „<Wirkstoff> · <Quelle>". Das Frontend
      // schneidet den Wirkstoff vor dem Trennzeichen heraus, um die Ansicht
      // darauf zu filtern — gleiche Form, gleiche Behandlung.
      notify({
        userId: a.userId,
        wirkstoff: a.wirkstoff,
        quelle: a.quelle,
        label: `${a.wirkstoff} · ${signal.sourceName}`,
        refId: signal.dedupeKey,
      });
      // ERST nach erfolgreichem Eintragen merken. Andersherum wäre eine
      // fehlgeschlagene Benachrichtigung für immer als „schon gemeldet"
      // verbucht und die Person hätte sie nie bekommen.
      merkeGemeldet(a.userId, a.meldungsSchluessel);
      merkeGemeldet(a.userId, a.tagesSchluessel);
      gesendet++;
    } catch (e) {
      log?.(`ApoPulse Alarm: ${a.wirkstoff} an ${a.userId} nicht zugestellt — ${(e && e.message) || e}`);
    }
  }
  return { gesendet, geprueft: beobachter.length };
}
