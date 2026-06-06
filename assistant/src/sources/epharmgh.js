// ePharmGH-Client (Stub) — reale Live-Verfügbarkeitsabfrage Apotheke ↔ Pharmagroßhandel (D-011).
// KEIN klassischer DB-Connect: ePharmGH ist ein Request/Response-Protokoll (Artikelanfrage),
// das normalerweise über das WWS der Apotheke läuft. Hier nur die Schnittstelle + Soll-Form.
export class EPharmGhClient {
  constructor(config = {}) {
    this.config = config; // z.B. { endpoint, apothekenId, credentials } — autorisierungspflichtig
  }

  /**
   * Sendet eine Artikelanfrage für eine PZN und gibt normalisierte Angebote zurück.
   * Soll-Form (identisch zu availability.json):
   *   [{ grosshaendler, lieferbar, aep_eur, lieferzeit_min, status }]
   */
  async checkAvailability(pzn) {
    throw new Error(
      `ePharmGH nicht konfiguriert (D-011 offen): Verfügbarkeitsanfrage für PZN ${pzn}. ` +
      'Erwartet: Anfrage über WWS/ePharmGH → normalisierte Angebote.'
    );
  }
}
