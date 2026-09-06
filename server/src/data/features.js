// ============================================================================
//  Funktionsschaltung — was die Plattform zeigt und was sie ruhen lässt
// ============================================================================
//  Ergebnis des Funktionsaudits vom 06.09.2026. Der Befund war nicht, dass
//  schlecht gebaut wurde, sondern dass zu viel gebaut wurde: rund 190
//  Schnittstellen und ~55 Bildschirme für vier funktionierende Datenquellen
//  und null Nutzer:innen.
//
//  ──────────────────────────────────────────────────────────────────────────
//  WARUM AUSBLENDEN UND NICHT LÖSCHEN
//  ──────────────────────────────────────────────────────────────────────────
//  Gelöschter Code ist eine Entscheidung, die sich nur mit Arbeit
//  zurücknehmen lässt. Ausgeblendeter Code ist eine Entscheidung, die sich
//  mit einer Umgebungsvariable zurücknehmen lässt — ohne Deploy.
//
//  Das ist hier keine Bequemlichkeit, sondern die ehrliche Konsequenz aus der
//  Grenze des Audits: Es gab KEINE Nutzungsdaten. Jede Bewertung ist ein
//  begründetes Urteil, kein Messwert. Wer auf dieser Grundlage Code löscht,
//  tut so, als hätte er gemessen. Wer ausblendet, kann sich korrigieren,
//  sobald die ersten fünf Apotheken widersprechen.
//
//  Die Tests der ausgeblendeten Bereiche bleiben deshalb ebenfalls bestehen:
//  Ein ruhender Bereich, dessen Tests verfallen, ist nicht ruhend, sondern
//  kaputt — man merkt es nur erst beim Wiedereinschalten.
//
//  ──────────────────────────────────────────────────────────────────────────
//  ZURÜCKSCHALTEN
//  ──────────────────────────────────────────────────────────────────────────
//    APOPULSE_FEATURE_TAUSCHBOERSE=an     schaltet einen Bereich wieder ein
//    APOPULSE_FEATURE_SOCIAL=aus          schaltet einen Bereich ab
//  Der Wert gilt sofort beim nächsten Start, ohne Codeänderung.
// ============================================================================

/** Zustände. `aktiv` = sichtbar und erreichbar. `ruht` = weder noch. */
export const ZUSTAende = ['aktiv', 'ruht'];

/**
 * Die Bereiche.
 *
 * `api` sind Muster auf den Pfad. Trifft eines und der Bereich ruht, antwortet
 * der Server mit 404 — als gäbe es die Schnittstelle nicht. Bewusst 404 und
 * nicht 403: Ein ruhender Bereich soll nichts über sich verraten, auch nicht
 * seine Existenz.
 */
export const FEATURES = [
  // ── Kern: bleibt an ──────────────────────────────────────────────────────
  {
    id: 'engpaesse', zustand: 'aktiv',
    titel: 'Lieferengpässe',
    grund: 'Der einzige Grund, aus dem jemand die Seite täglich öffnet.',
    api: [/^\/api\/shortages/, /^\/api\/wirkstoff/, /^\/api\/watchlist/],
  },
  {
    id: 'news', zustand: 'aktiv',
    titel: 'Behörden-News',
    grund: 'Meldungen mit Quelle und Datum — die belegbare Grundlage.',
    api: [/^\/api\/news/, /^\/api\/live/, /^\/api\/feed/, /^\/api\/db\//],
  },
  {
    id: 'konten', zustand: 'aktiv',
    titel: 'Konten und Profile',
    grund: 'Selbstverständlichkeit. Ohne Anmeldung kein Rest.',
    api: [/^\/api\/(login|register|auth|me|password|recovery-codes|profiles?|handles|verify|account-types|countries|country-config|health|data-status)/],
  },

  // ── Reparieren: bleibt an, aber die Daten werden ehrlicher ───────────────
  {
    id: 'preise', zustand: 'aktiv',
    titel: 'Preisvergleich',
    grund: 'Bleibt sichtbar, aber ohne erfundene Preise unter echten Firmennamen.',
    api: [/^\/api\/prices/],
  },
  {
    id: 'rabatte', zustand: 'aktiv',
    titel: 'Rabatte und Aktionen',
    grund: 'Wie Preise: Mechanik gut, Lieferantennamen neutralisiert.',
    api: [/^\/api\/(rabatte|deals|promotions)/],
  },

  // ── Parken: plausibel, aber setzt Nutzer:innen oder Partner voraus ───────
  {
    id: 'tauschboerse', zustand: 'ruht',
    titel: 'Tauschbörse (Biete/Suche)',
    grund: 'Inhaltlich die stärkste Idee — braucht aber Liquidität. '
      + 'Mit fünf Apotheken findet niemand einen Tauschpartner.',
    api: [/^\/api\/exchange/],
  },
  {
    id: 'bestellung', zustand: 'ruht',
    titel: 'Warenkorb und Bestellungen',
    grund: 'Bestellen ohne angebundenen Großhandel ist eine Bühnenrequisite.',
    api: [/^\/api\/(cart|orders)/],
  },
  {
    id: 'zahlungen', zustand: 'ruht',
    titel: 'Premium-Tarife',
    grund: 'Monetarisierung vor Nutzen: Solange vier Quellen laufen, gibt es nichts, '
      + 'wofür jemand 9,99 € zahlt. Betrifft NUR die Tarif-/Upsell-Fläche.',
    // ── ACHTUNG, DIE WICHTIGSTE ZEILE DIESER DATEI ──────────────────────────
    // Hier steht /api/plans und NICHT /api/payments. Das ist kein Versehen.
    //
    // Die Krypto-Zahlung liegt unter /api/payments/crypto — also INNERHALB des
    // Bereichs, den das Audit zum Parken vorgeschlagen hatte. Wer hier
    // /^\/api\/payments/ einträgt, schaltet damit die Krypto-Zahlung ab.
    //
    // Der Owner hat festgelegt: Krypto bleibt zu 100 %, weil es die Grundlage
    // der Afrika-Strategie ist (NG, KE, GH, AO, MZ). Dort ist Krypto kein
    // Spielzeug, sondern die Antwort auf Waehrungsverfall, Kapitalverkehrs-
    // kontrollen und duenne Kartenakzeptanz im B2B. Meine urspruengliche
    // Bewertung („kein belegbarer Nutzen") war zu eng — sie sah nur Wien.
    //
    // Die gesamte Zahlungsschnittstelle bleibt deshalb aktiv. Geparkt wird
    // allein die Tarif-Flaeche, die zum Kauf draengt. Ein Test in
    // test/features.test.js schlaegt fehl, sobald irgendein Bereich einen
    // Krypto-Pfad einfaengt — damit kann diese Entscheidung nicht
    // versehentlich rueckgaengig gemacht werden.
    api: [/^\/api\/plans/],
  },
  {
    id: 'zusammenarbeit', zustand: 'ruht',
    titel: 'Team, Aufgaben, Notizen',
    grund: 'Konkurriert mit WhatsApp und dem Zettel am Rezepturschrank.',
    api: [/^\/api\/(team|tasks|notes|collab)/],
  },
  {
    id: 'termine', zustand: 'ruht',
    titel: 'Videosprechstunde, Termine und Live-Sessions',
    grund: 'Eigenes Produkt, eigener Markt, eigene regulatorische Fragen.',
    // ACHTUNG, doppelt belegter Pfad: /api/live traegt ZWEI verschiedene
    // Dinge. /api/live/status und /api/live/run/* gehoeren zur
    // Nachrichten-Aufnahme und muessen laufen; /api/live und /api/live/<id>/…
    // sind die Video-Live-Sessions und gehoeren hierher. Ein pauschales
    // /^\/api\/live/ haette die Nachrichten-Automatik mit stillgelegt —
    // deshalb sind die Muster hier eng gefasst und enden auf $.
    api: [
      /^\/api\/appointments/,
      /^\/api\/live$/,
      /^\/api\/live\/mine$/,
      /^\/api\/live\/[^/]+\/(start|end|delete|interest|report)$/,
    ],
  },
  {
    id: 'patienteninfo', zustand: 'ruht',
    titel: 'Patienten-Infokarten und Antibiotika-Hinweise',
    grund: 'Fachlich sauber, aber Nebenschauplatz solange die Hauptsache wackelt.',
    api: [/^\/api\/(patient-info|compliance)/],
  },
  {
    id: 'waehrungsrechner', zustand: 'ruht',
    titel: 'Währungsrechner',
    grund: 'Echte Kurse, aber nur für Import-Fälle relevant.',
    // ACHTUNG: NICHT dasselbe wie die Krypto-Kurse. Siehe Hinweis unten.
    api: [/^\/api\/fx-rates/],
  },
  {
    id: 'verzeichnis', zustand: 'ruht',
    titel: 'Verzeichnis und Kolleg:innen in der Nähe',
    grund: 'Ein leeres Verzeichnis signalisiert „hier ist nichts los".',
    api: [/^\/api\/(directory|colleagues)/],
  },

  // ── Streichen: kein Mehrwert für diese Zielgruppe ────────────────────────
  {
    id: 'social', zustand: 'ruht',
    titel: 'Social-Mechanik',
    grund: 'Follower, Hashtags, Trending, Repost, Umfragen, Reaktionen, Lesezeichen. '
      + 'Eine Apothekerin will keine Reichweite, sondern eine Antwort — und dann weiterarbeiten.',
    api: [
      /^\/api\/(follow|unfollow|mute|unmute|muted)/,
      /^\/api\/(hashtag|trending|polls|bookmarks)/,
      /^\/api\/(suggestions|recommendations|discover)/,
    ],
  },
  {
    id: 'direktnachrichten', zustand: 'ruht',
    titel: 'Direktnachrichten',
    grund: 'Der teuerste Posten: Sobald Menschen einander schreiben, entstehen '
      + 'Moderationspflichten, Meldewege und Datenschutzfragen (DSA). '
      + 'Telefon und E-Mail kennen die Nutzer:innen bereits.',
    api: [/^\/api\/dm/],
  },
  {
    id: 'werbung', zustand: 'ruht',
    titel: 'Anzeigenfläche',
    grund: 'Werbung neben einer Engpassmeldung verkauft genau das Vertrauen, '
      + 'das die Herkunftskennzeichnung gerade aufbaut.',
    api: [], // rein im Frontend
  },
  {
    id: 'bindungsmechanik', zustand: 'ruht',
    titel: 'Wochenrückblick und Anstupser',
    grund: 'Engagement-Werkzeuge aus dem Consumer-Baukasten. '
      + 'Bei Berufstätigen erzeugen sie Genervtheit, keine Bindung.',
    api: [],
  },
];

// ────────────────────────────────────────────────────────────────────────────
//  KRYPTO — was hier NIE ruhen darf
// ────────────────────────────────────────────────────────────────────────────
//  Diese Liste ist bewusst KEINE Ausnahmeregel im Server. Eine Ausnahme im
//  Ablauf würde stillschweigend greifen und niemandem auffallen, wenn oben ein
//  falsches Muster steht. Stattdessen ist sie eine BEHAUPTUNG, die ein Test
//  prüft (test/features.test.js): Kein Bereich darf einen dieser Pfade
//  einfangen. Trägt jemand später /^\/api\/payments/ in einen ruhenden Bereich
//  ein, schlägt der Test fehl — vor dem Deploy, nicht danach.
//
//  So bleibt die Zusage „Krypto zu 100 %" durchsetzbar statt bloß
//  aufgeschrieben. Die Afrika-Strategie (NG, KE, GH, AO, MZ) haengt daran.
//
//  Die Methode steht dabei, weil mehrere dieser Wege nur POST annehmen. Ein
//  GET darauf ergibt zu Recht 404 — ein Test, der das uebersieht, meldet einen
//  Ausfall, wo keiner ist, und wird dann irgendwann abgeschaltet statt
//  ernstgenommen.
export const KRYPTO_PFADE = [
  { methode: 'GET', pfad: '/api/payments/crypto' },
  { methode: 'GET', pfad: '/api/payments/wallets' },
  { methode: 'GET', pfad: '/api/payments/methods' },
  { methode: 'GET', pfad: '/api/payments/products' },
  { methode: 'GET', pfad: '/api/payments/pending' },
  { methode: 'POST', pfad: '/api/payments/checkout' },
  { methode: 'POST', pfad: '/api/payments/crypto/start' },
  { methode: 'POST', pfad: '/api/payments/crypto/abc123/claim' },
  { methode: 'POST', pfad: '/api/payments/abc123/confirm' },
];

/** Umgebungsvariablen-Name eines Bereichs. */
export const featureEnvKey = (id) => `APOPULSE_FEATURE_${id.toUpperCase()}`;

/**
 * Der tatsächliche Zustand eines Bereichs — Umgebung schlägt Voreinstellung.
 * Ein unbekannter Wert wird IGNORIERT (Voreinstellung gilt weiter), nicht als
 * „aus" gedeutet: Ein Tippfehler darf keinen Bereich stilllegen.
 */
export function zustandVon(feature, env = process.env) {
  const wert = String(env[featureEnvKey(feature.id)] || '').trim().toLowerCase();
  if (wert === 'an' || wert === 'on' || wert === 'true') return 'aktiv';
  if (wert === 'aus' || wert === 'off' || wert === 'false') return 'ruht';
  return feature.zustand;
}

/** Alle Bereiche mit ihrem tatsächlichen Zustand. */
export function featureListe(env = process.env) {
  return FEATURES.map((f) => ({
    id: f.id, titel: f.titel, grund: f.grund, zustand: zustandVon(f, env),
  }));
}

/** Ist ein Bereich aktiv? Unbekannte Kennung gilt als aktiv (nichts verstecken, was nicht benannt ist). */
export function istAktiv(id, env = process.env) {
  const f = FEATURES.find((x) => x.id === id);
  return f ? zustandVon(f, env) === 'aktiv' : true;
}

/**
 * Gehört dieser Pfad zu einem ruhenden Bereich?
 * Gibt den Bereich zurück (für die Protokollzeile) oder `null`.
 */
export function ruhenderBereichFuer(pathname, env = process.env) {
  for (const f of FEATURES) {
    if (zustandVon(f, env) !== 'ruht') continue;
    if (f.api.some((rx) => rx.test(pathname))) return f;
  }
  return null;
}
