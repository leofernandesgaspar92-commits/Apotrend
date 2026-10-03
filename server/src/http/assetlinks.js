// ============================================================================
//  Digital Asset Links — der Beweis, dass App und Website zusammengehören
// ============================================================================
//  WOFÜR DAS GEBRAUCHT WIRD
//
//  Die Android-App ist eine „Trusted Web Activity": Sie zeigt www.apopulse.com
//  im Vollbild, ohne Browser-Adressleiste. Dass die Adressleiste verschwindet,
//  ist keine Einstellung in der App — Android prüft es. Beim Start holt das
//  Gerät
//
//      https://www.apopulse.com/.well-known/assetlinks.json
//
//  und vergleicht den dort hinterlegten Fingerabdruck mit dem der installierten
//  App. Stimmen sie überein, läuft die App wie eine native App. Stimmen sie
//  nicht — oder antwortet die Datei nicht sauber —, erscheint eine
//  Browser-Leiste mit der URL darin. Die App funktioniert dann zwar, sieht aber
//  aus wie ein Browser-Fenster mit Logo. Das ist der häufigste Grund, warum
//  eine TWA im Play Store billig wirkt.
//
//  ──────────────────────────────────────────────────────────────────────────
//  WARUM DAS EINE EIGENE ROUTE BRAUCHT UND NICHT NUR EINE DATEI
//  ──────────────────────────────────────────────────────────────────────────
//  Der Server liefert für unbekannte Pfade `index.html` aus (SPA-Rückfall).
//  Eine fehlende assetlinks.json käme damit als HTML-Seite mit Status 200
//  zurück. Android bekäme kein JSON, die Prüfung schlüge fehl — und zwar
//  STILL: kein Fehler im Protokoll, keine Meldung, nur eine Adressleiste, die
//  niemand erklären kann. Diese Route steht deshalb VOR dem Rückfall und
//  antwortet mit 404, wenn nichts konfiguriert ist.
//
//  ──────────────────────────────────────────────────────────────────────────
//  DER FEHLER, DEN FAST ALLE MACHEN: ZWEI SCHLÜSSEL
//  ──────────────────────────────────────────────────────────────────────────
//  Wer die App bei Google hochlädt, signiert sie mit seinem UPLOAD-Schlüssel.
//  Google signiert sie danach neu, mit dem APP-SIGNING-Schlüssel (Play App
//  Signing, bei neuen Apps Pflicht). Auf dem Gerät landet also ein ANDERER
//  Fingerabdruck als der, mit dem man selbst signiert hat.
//
//  Trägt man nur den eigenen ein, funktioniert die App beim Testen vom eigenen
//  Rechner — und zeigt nach der Installation aus dem Play Store eine
//  Adressleiste. Deshalb nimmt diese Datei MEHRERE Fingerabdrücke
//  (kommagetrennt): den von Google (Play Console → Setup → App-Integrität) und
//  den eigenen Upload-Schlüssel.
// ============================================================================

/** Umgebungsvariablen, aus denen die Datei gebaut wird. */
export const ASSETLINKS_ENV = {
  paket: 'APOPULSE_ANDROID_PACKAGE',
  fingerabdruecke: 'APOPULSE_ANDROID_SHA256',
};

/**
 * Fingerabdrücke normalisieren.
 *
 * Erlaubt ist, was Menschen tatsächlich einfügen: mit oder ohne Doppelpunkte,
 * groß oder klein, durch Komma, Semikolon, Leerzeichen oder Zeilenumbruch
 * getrennt. Zurück kommt die von Android erwartete Form
 * `AB:CD:…` in Großbuchstaben.
 *
 * Ungültiges wird VERWORFEN, nicht durchgereicht: Ein halb abgetippter
 * Fingerabdruck in der Datei sieht aus wie eine Konfiguration und ist keine —
 * dann lieber gar kein Eintrag und eine ehrliche 404.
 */
export function parseFingerprints(roh) {
  return String(roh || '')
    .split(/[,;\s]+/)
    .map((f) => f.trim().replace(/:/g, '').toUpperCase())
    .filter((f) => /^[0-9A-F]{64}$/.test(f))
    .map((f) => f.match(/.{2}/g).join(':'))
    // Doppelte entfernen: Upload- und App-Signing-Schlüssel sind oft identisch,
    // wenn jemand seinen eigenen Schlüssel hochgeladen hat.
    .filter((f, i, a) => a.indexOf(f) === i);
}

/** Paketname prüfen (Android: Punkt-getrennte Bezeichner, kleingeschrieben üblich). */
export function istPaketname(s) {
  return /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(String(s || '').trim());
}

/**
 * Der Inhalt von /.well-known/assetlinks.json — oder `null`, wenn nichts
 * konfiguriert ist. `null` heißt für den Aufrufer: 404 liefern.
 */
export function assetlinksDokument(env = process.env) {
  const paket = String(env[ASSETLINKS_ENV.paket] || '').trim();
  const fp = parseFingerprints(env[ASSETLINKS_ENV.fingerabdruecke]);
  if (!istPaketname(paket) || !fp.length) return null;
  return [{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: paket,
      sha256_cert_fingerprints: fp,
    },
  }];
}

/**
 * Was beim Start ins Protokoll gehört.
 *
 * Eine fehlende Konfiguration ist KEIN Fehler — die Website läuft ohne App
 * vollständig. Sie ist aber auch nichts, was man stillschweigend übergehen
 * sollte, wenn jemand gerade eine App veröffentlicht. Deshalb eine Zeile, die
 * sagt, was gilt.
 */
export function assetlinksStatus(env = process.env) {
  const paket = String(env[ASSETLINKS_ENV.paket] || '').trim();
  const roh = String(env[ASSETLINKS_ENV.fingerabdruecke] || '').trim();
  const fp = parseFingerprints(roh);

  if (!paket && !roh) return null; // Niemand will hier eine App — kein Thema.

  if (!istPaketname(paket)) {
    return `ApoPulse Android: ${ASSETLINKS_ENV.paket} fehlt oder ist kein Paketname `
      + `("${paket}"). /.well-known/assetlinks.json bleibt aus — die App zeigt eine Adressleiste.`;
  }
  if (!fp.length) {
    return `ApoPulse Android: ${ASSETLINKS_ENV.fingerabdruecke} enthält keinen gültigen `
      + `SHA-256-Fingerabdruck (64 Hex-Zeichen). /.well-known/assetlinks.json bleibt aus — `
      + 'die App zeigt eine Adressleiste.';
  }
  if (fp.length === 1) {
    return `ApoPulse Android: assetlinks.json aktiv für ${paket} mit EINEM Fingerabdruck. `
      + 'Bei Play App Signing braucht es meist ZWEI: den von Google (Play Console → '
      + 'App-Integrität) und den eigenen Upload-Schlüssel. Mit nur einem funktioniert die '
      + 'App beim Selbsttest und zeigt nach Installation aus dem Store eine Adressleiste.';
  }
  return `ApoPulse Android: assetlinks.json aktiv für ${paket} (${fp.length} Fingerabdrücke).`;
}
