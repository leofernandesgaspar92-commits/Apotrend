import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countryConfig } from '../src/data/countryFeatures.js';

const byId = (cfg, id) => cfg.active_features.find(f => f.feature_id === id);

test('countryConfig: liefert Framework-Schema (country/language/active_features)', () => {
  const ng = countryConfig('NG');
  assert.equal(ng.country, 'NG');
  assert.equal(ng.language, 'en');
  assert.equal(ng.currency, 'NGN');
  assert.ok(Array.isArray(ng.active_features) && ng.active_features.length > 0);
  // Kernfunktionen sind echt aktiv.
  for (const id of ['shortage_radar', 'price_compare', 'stock_exchange', 'currency_converter', 'live_data_status']) {
    assert.equal(byId(ng, id).enabled, true, `${id} aktiv`);
  }
});

test('countryConfig: regulator_source aktiv nur mit verifizierter URL', () => {
  // NG hat eine echte NAFDAC-URL -> aktiv, mit Link.
  const ng = byId(countryConfig('NG'), 'regulator_source');
  assert.equal(ng.enabled, true);
  assert.equal(ng.label, 'NAFDAC');
  assert.equal(ng.url, 'https://www.nafdac.gov.ng');
  // AO ohne belegte URL -> als geplant, kein Link.
  const ao = byId(countryConfig('AO'), 'regulator_source');
  assert.equal(ao.enabled, false);
  assert.equal(ao.planned, true);
  assert.equal(ao.url, undefined);
});

test('countryConfig: sicherheitskritische/geplante Module sind ehrlich enabled=false', () => {
  const de = countryConfig('DE');
  assert.equal(byId(de, 'recall_tracking').enabled, false, 'Rückrufe erst mit echter Quelle');
  assert.equal(byId(de, 'pzn_matching').enabled, false, 'DACH-spezifisch, geplant');
  // Anglophones Land bekommt das Echtheits-Modul (geplant), DACH nicht.
  assert.ok(byId(countryConfig('NG'), 'authenticity_check'));
  assert.equal(byId(de, 'authenticity_check'), undefined, 'kein Echtheits-Modul für DACH');
  // Lusophones Land bekommt Import-Logistik (geplant).
  assert.ok(byId(countryConfig('BR'), 'import_logistics'));
});

test('countryConfig: unbekannter Code fällt auf Standardland zurück (kein Absturz)', () => {
  const cfg = countryConfig('ZZ');
  assert.equal(cfg.country, 'AT');
  assert.ok(cfg.active_features.length > 0);
});
