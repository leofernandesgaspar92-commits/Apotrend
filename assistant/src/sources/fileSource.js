// FileSource — heutige Implementierung: liest die schema-treuen Sample-Daten (D-012).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DataSource } from './DataSource.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_DIR = join(__dirname, '..', '..', 'data', 'sample');

export class FileSource extends DataSource {
  #cache = {};
  #load(name) {
    return (this.#cache[name] ??= JSON.parse(readFileSync(join(SAMPLE_DIR, name), 'utf8')));
  }
  async getProducts() { return this.#load('products.json'); }
  async getInventory() { return this.#load('inventory.json'); }
  async getSignals() { return this.#load('signals.json'); }
  async getAvailability(pzn) {
    return this.#load('availability.json').verfuegbarkeit.find((v) => v.pzn === pzn)?.angebote ?? [];
  }
}
