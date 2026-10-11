// ============================================================================
//  Wann trifft ein beobachteter Wirkstoff einen Text?
// ============================================================================
//  Zwei Oberflächen stellen diese Frage, und sie brauchen NICHT dieselbe
//  Antwort. Beide Regeln stehen hier zusammen, damit der Unterschied sichtbar
//  und begründet ist statt verstreut und zufällig.
//
//  Gemeinsam ist beiden: nicht `includes`. Damit träfe ein beobachtetes „ASS"
//  in „KLASSE", „PASSIERT", „GLASSPLITTER" und „KASSENPACKUNG". Genau diese
//  Klasse von Fehlalarm bringt Leute dazu, die Kategorie abzuschalten — und
//  dann fehlt auch der echte Alarm.
//
//  Gemeinsam ist beiden auch: nicht `\b`. Das ist in JavaScript ASCII-basiert
//  und zieht mitten durch „Paracetamolhaltige" und „Acetylsalicylsäure". Die
//  Grenze wird über Unicode-Buchstaben und -Zahlen gebildet — Bindestrich,
//  Leerzeichen, Komma, Klammerende sind Grenzen, ein Umlaut nicht.
//
//  ──────────────────────────────────────────────────────────────────────────
//  WORUM SIE SICH UNTERSCHEIDEN: BEHÖRDENSATZ vs. PACKUNGSAUFSCHRIFT
//  ──────────────────────────────────────────────────────────────────────────
//  `wortTreffer` (Behördenmeldungen) verlangt das Wort auf BEIDEN Seiten
//  abgegrenzt. Eine Behörde schreibt in Sätzen: „Rückruf ASS 100 mg" — der
//  Wirkstoff steht dort als eigenes Wort. „Paracetamolhaltige Präparate" ist
//  bewusst KEIN Treffer: Das ist eine Wirkstoffklasse, keine Meldung zum
//  beobachteten Präparat, und ein Alarm darauf wäre eine Behauptung über
//  etwas, das die Meldung nicht sagt.
//
//  `praeparatTreffer` (Tauschangebote) verlangt die Grenze nur LINKS. Eine
//  Packungsaufschrift ist kein Satz, sondern ein zusammengesetzter Name:
//
//    „ASS100 Hexal"          — ASS, direkt gefolgt von einer Ziffer
//    „Ibuprofenlysinat 400"  — Wirkstoff als Wortanfang eines Kompositums
//    „Eisentabletten"        — dito
//
//  Mit der beidseitigen Regel wäre keines davon ein Treffer, und „ASS100" ist
//  in einer deutschen Apotheke keine Ausnahme, sondern die Regel. Ein
//  verpasstes Tauschangebot kostet hier konkret: Die Apothekerin, die den
//  Wirkstoff beobachtet, erfährt nicht, dass jemand ihn abzugeben hat.
//
//  Die linke Grenze allein hält die gefährlichen Fälle draußen, denn dort
//  steht der Treffer immer MITTEN im Wort: „K-assenpackung", „M-assage",
//  „Gl-assplitter". Was durchkommt, ist ein Wirkstoffname als Wortanfang —
//  und das ist fast immer dasselbe Präparat.
// ============================================================================

/** Regex-Sonderzeichen entschärfen — Wirkstoffnamen enthalten „(", „+", „." */
const escape = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Gemeinsamer Rumpf. Ein kaputter Name darf keinen Abruf abbrechen. */
function treffer(heuhaufen, nadel, rechts) {
  const hay = String(heuhaufen || '');
  const n = String(nadel || '').trim();
  if (!hay || !n) return false;
  try {
    return new RegExp(`(?<![\\p{L}\\p{N}])${escape(n)}${rechts}`, 'iu').test(hay);
  } catch {
    // Sollte nicht vorkommen (escape oben). Dann lieber kein Treffer als ein
    // Absturz: Ein Alarm ist kein Grund, eine Seite scheitern zu lassen.
    return false;
  }
}

/**
 * Kommt `nadel` als eigenes Wort in `heuhaufen` vor? (Behördenmeldungen)
 *
 * Beidseitig abgegrenzt — Begründung im Kopf dieser Datei.
 */
export function wortTreffer(heuhaufen, nadel) {
  return treffer(heuhaufen, nadel, '(?![\\p{L}\\p{N}])');
}

/**
 * Beginnt in `heuhaufen` ein Wort mit `nadel`? (Präparat-Bezeichnungen)
 *
 * Nur links abgegrenzt — Begründung im Kopf dieser Datei. Für Fließtext aus
 * einer Behördenmeldung ist diese Regel zu weich; dort `wortTreffer` nehmen.
 */
export function praeparatTreffer(heuhaufen, nadel) {
  return treffer(heuhaufen, nadel, '');
}
