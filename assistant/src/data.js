// Baut den Engine-Kontext aus EINER beliebigen Datenquelle (FileSource heute, DbSource später).
// Rückgabe-Form ist fix → engine.js bleibt unverändert, egal woher die Daten kommen.
import { FileSource } from './sources/fileSource.js';

export async function loadContext(source = new FileSource()) {
  const [products, inventory, signals] = await Promise.all([
    source.getProducts(),
    source.getInventory(),
    source.getSignals(),
  ]);

  // Verfügbarkeit wird nur für die RELEVANTE Teilmenge geholt (in Realität: ePharmGH-Live-Abfrage,
  // pro PZN, gebündelt/gecacht). Relevant = Eigenbestand ∪ Signal-Artikel ∪ empfohlene Alternativen.
  const neededPzns = new Set([
    ...inventory.positionen.map((p) => p.pzn),
    ...signals.signale.map((s) => s.pzn),
    ...signals.signale.map((s) => s.empfohlene_alternative_pzn).filter(Boolean),
  ]);
  const availByPzn = new Map();
  for (const pzn of neededPzns) {
    availByPzn.set(pzn, await source.getAvailability(pzn));
  }

  return {
    products,
    inventory,
    signals,
    productByPzn: new Map(products.map((p) => [p.pzn, p])),
    inventoryByPzn: new Map(inventory.positionen.map((p) => [p.pzn, p])),
    availByPzn,
  };
}
