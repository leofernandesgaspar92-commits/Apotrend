// Daten-Loader (D-012): lädt die schema-treuen Sample-Daten und baut den PZN-Join.
// Reale Daten später: nur die Quelle hier tauschen (Warenverzeichnis / AVS-Export / ePharmGH / BASG),
// Schemas bleiben → der Rest des Codes ändert sich nicht.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_DIR = join(__dirname, '..', 'data', 'sample');

const loadJson = (name) => JSON.parse(readFileSync(join(SAMPLE_DIR, name), 'utf8'));

export function loadData() {
  const products = loadJson('products.json');       // ~ Warenverzeichnis
  const inventory = loadJson('inventory.json');     // ~ AVS-Export
  const availability = loadJson('availability.json'); // ~ ePharmGH
  const signals = loadJson('signals.json');         // ~ BASG/AGES

  return {
    products,
    inventory,
    availability,
    signals,
    // PZN-Indizes (Join-Key)
    productByPzn: new Map(products.map((p) => [p.pzn, p])),
    inventoryByPzn: new Map(inventory.positionen.map((p) => [p.pzn, p])),
    availByPzn: new Map(availability.verfuegbarkeit.map((v) => [v.pzn, v.angebote])),
  };
}
