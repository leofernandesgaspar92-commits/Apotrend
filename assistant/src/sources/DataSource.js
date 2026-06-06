// Datenquelle-Schnittstelle (der Umschalt-Punkt).
// Implementierungen: FileSource (Sample-Daten, heute) · DbSource (eigene DB + ePharmGH, später).
// Alle Methoden liefern dieselbe Form wie die Sample-JSONs → engine.js bleibt unverändert.
export class DataSource {
  /** Produktkatalog (~ Warenverzeichnis). → Array von Produkten */
  async getProducts() { throw new Error('DataSource.getProducts() nicht implementiert'); }
  /** Eigenbestand der Apotheke (~ AVS-Export). → { apotheke_name, stand, positionen[] } */
  async getInventory() { throw new Error('DataSource.getInventory() nicht implementiert'); }
  /** Regulatorische Signale (~ BASG/Rückrufe). → { signale[] } */
  async getSignals() { throw new Error('DataSource.getSignals() nicht implementiert'); }
  /** Großhändler-Verfügbarkeit für eine PZN (~ ePharmGH, live). → angebote[] */
  async getAvailability(_pzn) { throw new Error('DataSource.getAvailability() nicht implementiert'); }
}
