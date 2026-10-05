// ============================================================================
//  Jurisdiction-Guard: die Fachkreis-Schranke für Rx-Arzneimittel
// ============================================================================
//  ⚠️ Kein Rechtsrat. Wie domain/compliance.js ist das eine konservative
//     Gating-Einschätzung zur Produktsteuerung. Im Zweifel wurde die strengere
//     Variante gewählt.
//
//  ──────────────────────────────────────────────────────────────────────────
//  DAS PROBLEM, DAS DIESE DATEI LÖST — UND ES WAR EIN ECHTES
//  ──────────────────────────────────────────────────────────────────────────
//  `GET /api/exchange` war angemeldet, aber NICHT auf Fachkreise beschränkt.
//  Im Code stand sogar ausdrücklich: „Privatnutzer:innen können Einträge
//  lesen, aber keine anlegen." Da die Registrierung Selbstbedienung ist, heißt
//  das: Angebote für verschreibungspflichtige Arzneimittel waren praktisch
//  öffentlich lesbar. Für DACH ist Publikumswerbung für Rx-Arzneimittel
//  untersagt (HWG § 10), in den USA gelten FDA-/DSCSA-Vorgaben.
//
//  ──────────────────────────────────────────────────────────────────────────
//  DIE ENTSCHEIDENDE REGEL: FAIL CLOSED
//  ──────────────────────────────────────────────────────────────────────────
//  Ob „Amoxicillin 1000 mg" verschreibungspflichtig ist, lässt sich aus einer
//  Zeichenkette NICHT zuverlässig bestimmen. Es zu RATEN wäre hier besonders
//  teuer, weil der Fehler in die gefährliche Richtung geht: Ein falsches
//  „nicht verschreibungspflichtig" stellt ein Rx-Angebot öffentlich.
//
//  Deshalb wird nichts geraten. Ein Eintrag ist nur dann öffentlich sichtbar,
//  wenn die einstellende Fachperson ihn AUSDRÜCKLICH als nicht
//  verschreibungspflichtig gekennzeichnet hat. Alles andere — auch und gerade
//  „weiß ich nicht" — bleibt dem verifizierten Fachkreis vorbehalten.
//
//  Die Folge ist unbequem und richtig: Solange niemand verifiziert ist, sieht
//  fast niemand Rx-Einträge. Das ist der korrekte Zustand, nicht ein Defekt.
//
//  ──────────────────────────────────────────────────────────────────────────
//  WARUM `verified` UND NICHT NUR DER KONTOTYP
//  ──────────────────────────────────────────────────────────────────────────
//  Den Kontotyp wählt man bei der Registrierung selbst. Eine Schranke, die
//  nur „account_type !== 'private'" prüft, ist mit einem Klick im
//  Anmeldeformular umgangen — das wäre eine Schranke auf dem Papier. Verlangt
//  wird deshalb die von der Moderation bestätigte Verifizierung.
// ============================================================================

// --- Verifizierungsstufen ---------------------------------------------------
//  Die Stufen benennen, WAS für ein Betrieb bestätigt wurde. Das ist nicht
//  Kosmetik: Ein verifizierter Logistiker darf Transportkapazitäten anbieten,
//  aber keine Rx-Arzneimittel beziehen — er ist kein Erwerbsberechtigter.

export const VERIFICATION_STATUS = Object.freeze([
  'UNVERIFIED',
  'PENDING',
  'VERIFIED_PHARMACY',
  'VERIFIED_WHOLESALE',
  'VERIFIED_MANUFACTURER',
  'VERIFIED_LOGISTICS',
]);

/**
 * Stufen, die zum Rx-Fachkreis gehören.
 *
 * LOGISTIK fehlt hier mit Absicht: Ein Transportunternehmen befördert
 * Arzneimittel, es erwirbt sie nicht. Es in den Rx-Fachkreis aufzunehmen
 * hieße, die Schranke um eine Teilnehmergruppe zu öffnen, die sie fachlich
 * nicht braucht — und je mehr Gruppen hineindürfen, desto weniger ist die
 * Schranke wert.
 */
export const RX_FACHKREIS_STATUS = Object.freeze([
  'VERIFIED_PHARMACY',
  'VERIFIED_WHOLESALE',
  'VERIFIED_MANUFACTURER',
]);

export function istGueltigerStatus(s) {
  return VERIFICATION_STATUS.includes(String(s || '').toUpperCase());
}

export function istRxFachkreis(s) {
  return RX_FACHKREIS_STATUS.includes(String(s || '').toUpperCase());
}

/**
 * Alle bestaetigten Betriebsstufen — Rx-Fachkreis PLUS Logistik.
 *
 * ZWEI PRUEFUNGEN, UND DIE VERWECHSLUNG WAERE TEUER IN BEIDE RICHTUNGEN:
 *
 *  · `istRxFachkreis` entscheidet ueber Rx-ANGEBOTE. Logistik gehoert nicht
 *    dazu: Ein Transportunternehmen befoerdert Arzneimittel, es erwirbt sie
 *    nicht.
 *  · `istVerifizierterBetrieb` entscheidet ueber B2B-Funktionen, bei denen
 *    Logistik die WICHTIGSTE Gruppe ist — Kuehlketten-Unterbrechungen und
 *    Zollverzoegerungen weiss zuerst die Spedition.
 *
 * Mit nur einer Pruefung waere entweder die Logistik vom Kuehlketten-Modul
 * ausgeschlossen (absurd) oder sie haette Rx-Einblick (falsch).
 */
export const VERIFIZIERTE_BETRIEBE = Object.freeze([...RX_FACHKREIS_STATUS, 'VERIFIED_LOGISTICS']);

export function istVerifizierterBetrieb(s) {
  return VERIFIZIERTE_BETRIEBE.includes(String(s || '').toUpperCase());
}

/**
 * Darf diese Person B2B-Logistikmeldungen sehen und einstellen?
 *
 * Wie `rxErlaubt`: bestaetigte Stufe plus brauchbarer Ländercode. Der
 * `isRxAllowed`-Entzug gilt hier NICHT — er betrifft die
 * Erwerbsberechtigung fuer Rx, nicht die Frage, ob jemand eine unterbrochene
 * Kuehlkette melden darf.
 */
export function logistikErlaubt(nutzer) {
  if (!nutzer) return false;
  if (!istVerifizierterBetrieb(nutzer.verificationStatus)) return false;
  return /^[A-Z]{2}$/.test(String(nutzer.jurisdiction || '').toUpperCase());
}

/**
 * Verifizierungsstufe aus dem Zustand der laufenden Anwendung ableiten.
 *
 * Die Anwendung führt heute zwei Angaben: `account_type` (Selbstauskunft) und
 * `verified` (von der Moderation bestätigt). Diese Funktion übersetzt beides
 * in die Stufe oben — damit das neue Vokabular von ECHTEN Daten gedeckt ist
 * und nicht von einem leeren Feld, das niemand füllt.
 *
 * `authority` wird NICHT zu einer VERIFIED_*-Rx-Stufe: Eine Behörde liest und
 * meldet, sie handelt nicht mit Arzneimitteln. Sie bekommt denselben
 * Lesezugang über den Fachkreis-Status ihres Kontotyps — siehe unten.
 */
export function verificationStatusFor({ accountType, verified = false, verificationPending = false } = {}) {
  const typ = String(accountType || '').toLowerCase();
  if (!verified) return verificationPending ? 'PENDING' : 'UNVERIFIED';
  if (typ === 'pharmacy') return 'VERIFIED_PHARMACY';
  if (typ === 'pharma') return 'VERIFIED_MANUFACTURER';
  if (typ === 'wholesale') return 'VERIFIED_WHOLESALE';
  if (typ === 'logistics') return 'VERIFIED_LOGISTICS';
  // Behörde und Privat: bestätigt, aber keine Rx-Erwerbsberechtigung.
  return 'UNVERIFIED';
}

// --- Die Schranke -----------------------------------------------------------

/**
 * Darf diese Person verschreibungspflichtige Angebote SEHEN?
 *
 * Drei Bedingungen, alle nötig:
 *   1. bestätigter Fachkreis-Status (nicht nur Selbstauskunft)
 *   2. ein brauchbarer Ländercode (ohne Jurisdiktion keine Zulässigkeit)
 *   3. kein ausdrücklicher Entzug (`isRxAllowed === false`)
 *
 * Punkt 3 ist der Hebel für die Moderation: Ein Betrieb, dessen Erlaubnis
 * erloschen ist, lässt sich sperren, ohne die Verifizierung zurückzunehmen.
 */
export function rxErlaubt(nutzer) {
  if (!nutzer) return false;
  if (nutzer.isRxAllowed === false) return false;
  if (!istRxFachkreis(nutzer.verificationStatus)) return false;
  return /^[A-Z]{2}$/.test(String(nutzer.jurisdiction || '').toUpperCase());
}

/** Rx-Kennzeichnung eines Angebots. `null` = unbestimmt, gilt als Rx. */
export const RX_MARKIERUNG = Object.freeze({ rx: true, otc: false, unbestimmt: null });

/**
 * Kennzeichnung normalisieren.
 *
 * ALLES, was nicht ausdrücklich „otc"/false ist, wird zu `true` oder `null` —
 * beides gilt als geschützt. Ein Tippfehler im Formular darf kein Rx-Angebot
 * öffentlich machen.
 */
export function normalizeRx(wert) {
  if (wert === false || wert === 'otc' || wert === 'false') return false;
  if (wert === true || wert === 'rx' || wert === 'true') return true;
  return null; // unbestimmt
}

/** Ist dieses Angebot geschützt (also nicht ausdrücklich OTC)? */
export const istGeschuetzt = (eintrag) => normalizeRx(eintrag && eintrag.rx) !== false;

/**
 * Darf `betrachter` dieses Angebot sehen?
 *
 * `null` als Betrachter heißt „nicht angemeldet" — dann nur ausdrücklich
 * nicht verschreibungspflichtige Angebote.
 */
export function rxSichtbar(eintrag, betrachter) {
  if (!eintrag) return false;
  // Eigene Einträge sieht man immer. Sonst könnte jemand sein eigenes Angebot
  // einstellen und es anschließend nicht mehr finden — ein Fehlerbild, das
  // wie ein Datenverlust aussieht.
  if (betrachter && betrachter.userId && eintrag.author_user_id === betrachter.userId) return true;
  if (!istGeschuetzt(eintrag)) return true;
  if (!rxErlaubt(betrachter)) return false;
  // Jurisdiktion: Rx-Verkehr ist national geregelt. Ein deutsches Rx-Angebot
  // einer österreichischen Apotheke zu zeigen, ist nicht dasselbe wie Handel —
  // aber die Erwerbsberechtigung gilt je Land, und die strengere Variante ist
  // hier die richtige. Ohne Land am Eintrag bleibt er geschützt.
  const land = String(eintrag.country || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(land)) return false;
  return land === String(betrachter.jurisdiction || '').toUpperCase();
}

/**
 * Warum ist etwas verborgen? Für eine ehrliche Meldung in der Oberfläche.
 *
 * Eine Schranke ohne Erklärung sieht aus wie ein leerer Bereich — und genau
 * das Signal („hier ist nichts") ist falsch: Es ist etwas da, nur nicht für
 * diese Person. Die Oberfläche muss den Unterschied sagen können.
 */
export function rxGrund(betrachter) {
  if (!betrachter || !betrachter.userId) return 'anmeldung';
  if (betrachter.isRxAllowed === false) return 'entzogen';
  if (String(betrachter.verificationStatus || '').toUpperCase() === 'PENDING') return 'pruefung';
  if (!istRxFachkreis(betrachter.verificationStatus)) return 'unverifiziert';
  if (!/^[A-Z]{2}$/.test(String(betrachter.jurisdiction || '').toUpperCase())) return 'kein_land';
  return 'anderes_land';
}

/**
 * Eine Liste filtern und dabei ZÄHLEN, was verborgen wurde.
 *
 * Die Zahl ist der Punkt. Nur mit ihr kann die Oberfläche „3 Angebote nur für
 * verifizierte Fachkreise" sagen, statt eine kürzere Liste ohne Hinweis zu
 * zeigen.
 */
export function filterRx(eintraege, betrachter) {
  const sichtbar = [];
  let verborgen = 0;
  for (const e of (eintraege || [])) {
    if (rxSichtbar(e, betrachter)) sichtbar.push(e);
    else verborgen++;
  }
  return { eintraege: sichtbar, verborgen, grund: verborgen ? rxGrund(betrachter) : null };
}
