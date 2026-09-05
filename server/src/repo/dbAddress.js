// ============================================================================
//  Führt die Verbindung über das interne Netz oder über das offene Internet?
// ============================================================================
//  Render bietet zu jeder Datenbank ZWEI Verbindungsadressen an, direkt
//  untereinander im Dashboard, und sie sehen fast gleich aus:
//
//    Internal Database URL   …@dpg-abc123-a/apopulse_db
//    External Database URL   …@dpg-abc123-a.frankfurt-postgres.render.com/…
//
//  Der Unterschied ist ein Punkt im Hostnamen — und er entscheidet, ob die
//  Daten das Rechenzentrum verlassen. Die interne Adresse gilt nur innerhalb
//  der Region; die externe geht über das öffentliche Internet und setzt
//  voraus, dass die Datenbank Verbindungen von außen annimmt.
//
//  WARUM DAS HIER GEPRÜFT WIRD
//
//  Die externe Adresse funktioniert. Genau das ist die Falle: Wer sie einträgt,
//  merkt nichts — die App läuft, die Daten kommen an. Unsichtbar bleibt, dass
//  die Datenbank dafür für die ganze Welt erreichbar stehen muss und dass
//  Kontodaten von Apotheken bei jedem Zugriff durchs offene Netz gehen. Bei
//  personenbezogenen Daten aus DE/AT ist das keine Geschmacksfrage.
//
//  Der Server verweigert deshalb NICHTS: Es gibt berechtigte Gründe für die
//  externe Adresse (Betrieb außerhalb von Render, Wartungszugriff). Aber er
//  sagt es — einmal beim Start, laut und mit dem konkreten Gegenmittel.
// ============================================================================

/** Kennungen von Anbietern, deren interne Adressen ohne Punkt auskommen. */
const INTERN_OHNE_PUNKT = /^dpg-[a-z0-9-]+$/i;

/**
 * Einstufung einer Datenbank-Adresse.
 *
 * Gibt `{ kind, host, hint }` zurück:
 *   'intern'    — internes Netz (Render-Kurzname oder localhost)
 *   'extern'    — öffentlich erreichbarer Name
 *   'unbekannt' — nicht auswertbar (dann wird NICHT gewarnt; eine Warnung auf
 *                 Verdacht wäre schlimmer als keine, sie stumpft ab)
 */
export function classifyDbUrl(url) {
  let host;
  try {
    host = new URL(String(url || '')).hostname.toLowerCase();
  } catch {
    return { kind: 'unbekannt', host: null, hint: null };
  }
  if (!host) return { kind: 'unbekannt', host: null, hint: null };

  // Eigener Rechner / Container-Netz: kein Weg über das Internet.
  if (host === 'localhost' || host === '::1' || /^127\./.test(host)) {
    return { kind: 'intern', host, hint: null };
  }
  // Render-interne Adresse: Kurzname ohne Punkt.
  if (INTERN_OHNE_PUNKT.test(host)) return { kind: 'intern', host, hint: null };
  // Jeder andere Name ohne Punkt ist ein Netzwerkname, kein öffentlicher.
  if (!host.includes('.')) return { kind: 'intern', host, hint: null };

  // Ab hier: ein öffentlich auflösbarer Name.
  const renderExtern = /\.render\.com$/i.test(host);
  return {
    kind: 'extern',
    host,
    hint: renderExtern
      ? 'Render bietet dieselbe Datenbank auch als „Internal Database URL" an — '
        + 'derselbe Name OHNE den Punkt-Teil. Diese eintragen: Der Verkehr bleibt '
        + 'dann im Rechenzentrum, und die Datenbank muss keine Verbindungen von '
        + 'außen mehr annehmen (Networking -> Inbound IP Restrictions).'
      : 'Prüfen, ob eine Adresse im internen Netz verfügbar ist.',
  };
}

/**
 * Warnzeile, oder `null`, wenn nichts zu sagen ist.
 * Der Hostname darf hinein, Benutzername und Passwort NIEMALS — eine Warnung,
 * die ein Geheimnis ins Protokoll schreibt, richtet mehr Schaden an als der
 * Zustand, vor dem sie warnt.
 */
export function dbAddressWarning(url) {
  const c = classifyDbUrl(url);
  if (c.kind !== 'extern') return null;
  return `ApoPulse DB: Die Verbindung läuft über eine ÖFFENTLICHE Adresse (${c.host}). `
    + `Die Daten verlassen damit bei jedem Zugriff das Rechenzentrum, und die Datenbank `
    + `muss für Verbindungen von außen offen stehen. ${c.hint}`;
}
