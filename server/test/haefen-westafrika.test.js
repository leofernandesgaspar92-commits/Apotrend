// Frankophones Westafrika: Dakar und Abidjan fehlten in der Hafenliste (Wetter-/Sturmhinweis, Schiffe vor Anker,
// Ankunft im Kostenrechner). Senegal und Côte d'Ivoire bekamen deshalb keinen Hafen-Hinweis.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HAEFEN } from '../src/services/extern/wetter.js';
import { HAFEN_FUER_LAND } from '../src/services/sourcing.js';

test('Dakar und Abidjan mit plausiblen Koordinaten; Senegal → Dakar, Côte d\'Ivoire → Abidjan', () => {
  const dakar = HAEFEN.find((h) => h.id === 'dakar'), abidjan = HAEFEN.find((h) => h.id === 'abidjan');
  assert.ok(dakar && abidjan, 'Hafen fehlt');
  assert.deepEqual([dakar.land, abidjan.land], ['SN', 'CI']);
  // Grobe Lage (Atlantikküste): Dakar ~14,7° N 17,4° W; Abidjan ~5,3° N 4,0° W.
  assert.ok(Math.abs(dakar.lat - 14.68) < 0.1 && Math.abs(dakar.lon + 17.42) < 0.1, 'Dakar falsch verortet');
  assert.ok(Math.abs(abidjan.lat - 5.28) < 0.1 && Math.abs(abidjan.lon + 4.01) < 0.1, 'Abidjan falsch verortet');
  assert.equal(HAFEN_FUER_LAND.SN, 'dakar');
  assert.equal(HAFEN_FUER_LAND.CI, 'abidjan');
  // Binnenländer mit mehreren üblichen Häfen bekommen bewusst KEINE Zuordnung (nur wo eindeutig).
  for (const cc of ['ML', 'BF']) assert.equal(HAFEN_FUER_LAND[cc], undefined, cc);
  // Jede Zuordnung zeigt auf einen Hafen der Liste.
  for (const [cc, id] of Object.entries(HAFEN_FUER_LAND)) assert.ok(HAEFEN.some((h) => h.id === id), `${cc} → ${id} fehlt`);
});
