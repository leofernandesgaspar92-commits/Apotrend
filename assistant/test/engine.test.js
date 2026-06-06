// Eval-Harness (Reviewer/Standards): fixiert die Decision-Engine-Logik gegen Regressionen.
// Läuft mit Node-Bordmitteln: `node --test` (keine Dependencies).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRecommendations, compareProducts, bestOffer, daysUntil } from '../src/engine.js';
import { loadContext } from '../src/data.js';
import { FileSource } from '../src/sources/fileSource.js';

// Hilfsfunktion: baut einen Engine-Kontext aus reinen Objekten (für Unit-Edge-Cases ohne Dateien).
function ctx({ products = [], positionen = [], signale = [], availability = {}, stand = '2026-06-06' }) {
  return {
    products,
    inventory: { apotheke_name: 'Test', stand, positionen },
    signals: { signale },
    productByPzn: new Map(products.map((p) => [p.pzn, p])),
    inventoryByPzn: new Map(positionen.map((p) => [p.pzn, p])),
    availByPzn: new Map(Object.entries(availability)),
  };
}
const TODAY = new Date('2026-06-06T08:00:00+02:00');

// ---------- Integration: gegen die echten Sample-Daten ----------

test('Sample-Briefing: erwartete Typen in Schweregrad-Reihenfolge', async () => {
  const data = await loadContext(new FileSource());
  const recs = buildRecommendations(data, new Date(data.inventory.stand));
  assert.deepEqual(
    recs.map((r) => r.typ),
    ['rueckruf', 'engpass', 'nachbestellung', 'ueberbestand', 'hinweis'],
  );
});

test('Sample: Rückruf trifft Eigenbestand (PZN 1000035, Charge belegt)', async () => {
  const data = await loadContext(new FileSource());
  const recs = buildRecommendations(data, new Date(data.inventory.stand));
  const r = recs.find((x) => x.typ === 'rueckruf');
  assert.equal(r.pzn, '1000035');
  assert.equal(r.schweregrad, 'kritisch');
  assert.match(r.details, /IBU400-2410-B/);
  assert.deepEqual(r.quellen, ['signals:SIG-003', 'inventory:1000035']);
});

test('Sample: Engpass mit lieferbarem Substitut, Original nicht lieferbar → hoch', async () => {
  const data = await loadContext(new FileSource());
  const recs = buildRecommendations(data, new Date(data.inventory.stand));
  const r = recs.find((x) => x.typ === 'engpass');
  assert.equal(r.pzn, '1000011');
  assert.equal(r.schweregrad, 'hoch');
  assert.match(r.details, /Levothyr/);
  assert.ok(r.quellen.includes('products:1000028') && r.quellen.includes('availability:1000028'));
});

test('Sample: Nachbestellung wählt günstigsten Großhändler (Kwizda)', async () => {
  const data = await loadContext(new FileSource());
  const recs = buildRecommendations(data, new Date(data.inventory.stand));
  const r = recs.find((x) => x.typ === 'nachbestellung');
  assert.equal(r.pzn, '1000042');
  assert.match(r.details, /15 Stk/);
  assert.match(r.details, /Kwizda/);
});

test('Sample: Produktvergleich erkennt Substituierbarkeit + günstigeren', async () => {
  const data = await loadContext(new FileSource());
  const c = compareProducts(data, '1000011', '1000028');
  assert.equal(c.gleicherWirkstoff, true);
  assert.equal(c.guenstigerePzn, '1000028');
});

// ---------- Unit: Edge-Cases der Logik ----------

test('Rückruf nur bei passender Charge', () => {
  const data = ctx({
    products: [{ pzn: '1', name: 'X' }],
    positionen: [{ pzn: '1', bestand: 5, min_bestand: 2, max_bestand: 10, abverkauf_30d: 5, charge: 'A', verfall: '2027-01-01' }],
    signale: [{ id: 'S', typ: 'rueckruf', pzn: '1', charge: 'B', text: 'rec' }],
  });
  const recs = buildRecommendations(data, TODAY);
  assert.equal(recs.filter((r) => r.typ === 'rueckruf').length, 0);
});

test('Engpass ohne lieferbares Substitut → "Verfügbarkeit prüfen"', () => {
  const data = ctx({
    products: [{ pzn: '1', name: 'Orig', atc: 'X', wirkstoff: 'W' }, { pzn: '2', name: 'Alt', atc: 'X', wirkstoff: 'W' }],
    positionen: [{ pzn: '1', bestand: 1, min_bestand: 5, max_bestand: 10, abverkauf_30d: 3, charge: 'C', verfall: '2027-01-01' }],
    signale: [{ id: 'S', typ: 'engpass', pzn: '1', schweregrad: 'hoch', empfohlene_alternative_pzn: '2', text: 'e' }],
    availability: { '1': [{ grosshaendler: 'H', lieferbar: false, aep_eur: 1 }], '2': [{ grosshaendler: 'H', lieferbar: false, aep_eur: 1 }] },
  });
  const r = buildRecommendations(data, TODAY).find((x) => x.typ === 'engpass');
  assert.match(r.details, /Verfügbarkeit prüfen/);
});

test('Unterschreitung Mindestbestand ohne Engpass → Nachbestellung', () => {
  const data = ctx({
    products: [{ pzn: '9', name: 'Y' }],
    positionen: [{ pzn: '9', bestand: 1, min_bestand: 4, max_bestand: 12, abverkauf_30d: 6, charge: 'Z', verfall: '2027-01-01' }],
    availability: { '9': [{ grosshaendler: 'Phoenix', lieferbar: true, aep_eur: 2.5 }] },
  });
  const r = buildRecommendations(data, TODAY).find((x) => x.typ === 'nachbestellung');
  assert.equal(r.pzn, '9');
  assert.match(r.details, /11 Stk/); // 12 - 1
});

test('bestOffer: günstigster lieferbarer, sonst null', () => {
  assert.equal(bestOffer([{ lieferbar: true, aep_eur: 5 }, { lieferbar: true, aep_eur: 3 }, { lieferbar: false, aep_eur: 1 }]).aep_eur, 3);
  assert.equal(bestOffer([{ lieferbar: false, aep_eur: 1 }]), null);
  assert.equal(bestOffer([]), null);
});

test('daysUntil rechnet Tage bis Datum / null ohne Datum', () => {
  assert.equal(daysUntil(null, TODAY), null);
  assert.equal(daysUntil('2026-06-16T08:00:00+02:00', TODAY), 10);
});
