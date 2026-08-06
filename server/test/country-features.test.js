import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countryConfig, featureStatus, isFeatureBlocked } from '../src/data/countryFeatures.js';

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

test('featureStatus/isFeatureBlocked: rechtliche Länder-Sperren aus der Matrix', () => {
  // Hart blockiert laut LEGAL_COUNTRY_MATRIX.md
  assert.equal(featureStatus('DE', 'deals'), 'blocked');
  assert.equal(featureStatus('PT', 'deals'), 'blocked');
  assert.equal(featureStatus('US', 'stock_exchange'), 'blocked');
  assert.equal(featureStatus('AO', 'stock_exchange'), 'blocked');
  assert.equal(featureStatus('MZ', 'stock_exchange'), 'blocked');
  assert.equal(isFeatureBlocked('DE', 'deals'), true);
  // Eingeschränkt, nicht gesperrt
  assert.equal(featureStatus('AT', 'deals'), 'restricted');
  assert.equal(isFeatureBlocked('AT', 'deals'), false);
  assert.equal(featureStatus('DE', 'stock_exchange'), 'restricted');
  // Unkritische Kernfunktion überall erlaubt
  assert.equal(featureStatus('DE', 'shortage_radar'), 'allowed');
  assert.equal(featureStatus('US', 'deals'), 'restricted');
});

test('countryConfig: gesperrte Funktion ist enabled=false mit status+legal_reason', () => {
  const de = byId(countryConfig('DE'), 'deals');
  assert.equal(de.status, 'blocked');
  assert.equal(de.enabled, false);
  assert.equal(de.legal_reason, 'deals_blocked');
  // Restricted bleibt nutzbar (enabled=true), trägt aber Status + Grund.
  const at = byId(countryConfig('AT'), 'deals');
  assert.equal(at.status, 'restricted');
  assert.equal(at.enabled, true);
  assert.equal(at.legal_reason, 'deals_restricted');
  // country_name für die Meldung vorhanden.
  assert.equal(countryConfig('DE').country_name, 'Deutschland');
});
