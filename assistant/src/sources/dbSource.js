// DbSource — Skelett für die ECHTE Anbindung (D-004 Datenschicht). Noch nicht verdrahtet:
// Methoden werfen klare Fehler, solange DB/ePharmGH fehlen, damit nichts versehentlich „leer" läuft.
//
// Architektur: Stamm-/Bestands-/Signaldaten kommen aus UNSERER eigenen DB (befüllt durch Ingestion-Jobs),
// Verfügbarkeit live via ePharmGH. Ergebnisse werden auf dieselbe Form wie FileSource normalisiert.
//   products   ← Warenverzeichnis-Import (monatlich, Lizenz D-010)
//   inventory  ← AVS-Export-Sync (pro Apotheke, D-005)
//   signals    ← BASG/Rückruf-Feeds (geplanter Abruf)
//   availability ← ePharmGH live (D-011)
import { DataSource } from './DataSource.js';
import { EPharmGhClient } from './epharmgh.js';

export class DbSource extends DataSource {
  constructor({ db = null, epharmgh = new EPharmGhClient(), apothekeId = null } = {}) {
    super();
    this.db = db;             // Tech offen (D-006/Datenresidenz AT/EU): z.B. Postgres-Client
    this.epharmgh = epharmgh;
    this.apothekeId = apothekeId; // Mandant — Bestand ist pro Apotheke isoliert (DSGVO)
  }

  #requireDb() {
    if (!this.db) {
      throw new Error(
        'Keine DB konfiguriert (D-004/D-006 offen). Ingestion erwartet: ' +
        'Warenverzeichnis-Import (D-010), AVS-Export-Sync (D-005), BASG-Feeds.'
      );
    }
    return this.db;
  }

  // Katalog — tenant-unabhängig. Ergebnis muss zur products.json-Form normalisiert werden.
  async getProducts() {
    return this.#requireDb().query('SELECT * FROM products');
  }

  // Eigenbestand — PRO APOTHEKE (Mandanten-Filter). Form: { apotheke_name, stand, positionen[] }.
  async getInventory() {
    if (!this.apothekeId) throw new Error('apothekeId fehlt (Mandanten-Isolation).');
    return this.#requireDb().query('SELECT * FROM inventory WHERE apotheke_id = $1', [this.apothekeId]);
  }

  // Gültige Signale (Engpässe/Rückrufe). Form: { signale[] }.
  async getSignals() {
    return this.#requireDb().query('SELECT * FROM signals WHERE gueltig_bis IS NULL OR gueltig_bis >= now()');
  }

  // Verfügbarkeit — LIVE, kein DB-Query (D-011).
  async getAvailability(pzn) {
    return this.epharmgh.checkAvailability(pzn);
  }
}
