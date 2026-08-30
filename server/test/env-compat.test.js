// ============================================================================
//  Alte Variablennamen (APOTREND_*) weiterhin akzeptieren
// ============================================================================
//  Warum es diese Datei gibt: Bei der Umbenennung auf ApoPulse hätte ein
//  reines Suchen-und-Ersetzen vier Werte ins Leere laufen lassen, die NUR im
//  Render-Dashboard existieren — darunter das Sitzungsgeheimnis (alle
//  Nutzer:innen ausgeloggt) und das Moderationspasswort (nicht
//  wiederherstellbar). Diese Prüfungen halten das Verhalten fest, damit es
//  nicht beim nächsten Aufräumen still verschwindet.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { applyLegacyEnvAliases, legacyEnvNamesInUse, LEGACY_PREFIX, CURRENT_PREFIX } from '../src/env-compat.js';

test('ein alter Name wird auf den neuen gespiegelt', () => {
  const env = { APOTREND_TOKEN_SECRET: 'geheim', PATH: '/usr/bin' };
  const uebernommen = applyLegacyEnvAliases(env);

  assert.equal(env.APOPULSE_TOKEN_SECRET, 'geheim');
  assert.deepEqual(uebernommen, ['APOTREND_TOKEN_SECRET']);
  // Der alte Name bleibt stehen: Etwas anderes im Prozess könnte ihn noch
  // lesen, und Wegnehmen bringt hier keinen Vorteil.
  assert.equal(env.APOTREND_TOKEN_SECRET, 'geheim');
  assert.equal(env.PATH, '/usr/bin', 'Fremde Variablen bleiben unberührt');
});

test('der neue Name gewinnt und wird nie überschrieben', () => {
  // Sonst könnte der Owner nach der Umstellung in Render nicht mehr steuern,
  // welcher Wert gilt — der alte würde den neuen verdrängen.
  const env = { APOTREND_ADMIN_EMAIL: 'alt@example.at', APOPULSE_ADMIN_EMAIL: 'neu@example.at' };
  applyLegacyEnvAliases(env);
  assert.equal(env.APOPULSE_ADMIN_EMAIL, 'neu@example.at');
});

test('ein absichtlich LEERER neuer Wert bleibt leer', () => {
  // Leer heißt in diesem Projekt „abgeschaltet" (z. B. eine Quelle stilllegen).
  // Würde hier auf den Wahrheitswert geprüft statt auf das Vorhandensein des
  // Schlüssels, machte der alte Wert die Abschaltung wieder rückgängig — und
  // eine abgeschaltete Quelle liefe stillschweigend weiter.
  const env = { APOTREND_SOURCE_FDA_NEWS_URL: 'https://alt.example/feed', APOPULSE_SOURCE_FDA_NEWS_URL: '' };
  applyLegacyEnvAliases(env);
  assert.equal(env.APOPULSE_SOURCE_FDA_NEWS_URL, '');
});

test('mehrfaches Anwenden ändert nichts (idempotent)', () => {
  const env = { APOTREND_DATA_FILE: '/var/data/apotrend.json' };
  applyLegacyEnvAliases(env);
  const zweiter = applyLegacyEnvAliases(env);
  assert.deepEqual(zweiter, [], 'beim zweiten Lauf gibt es nichts mehr zu übernehmen');
  assert.equal(env.APOPULSE_DATA_FILE, '/var/data/apotrend.json');
});

test('die dynamischen Quellen-Variablen werden mitgenommen', () => {
  // Diese Namen stehen nirgends fest im Code — sie werden zur Laufzeit aus der
  // Umgebung gelesen. Ein Baustein, der nur eine feste Liste kennt, hätte sie
  // übersehen.
  const env = {
    APOTREND_SOURCE_MEINE_URL: 'https://example.at/feed.xml',
    APOTREND_SOURCE_MEINE_COUNTRY: 'AT',
    APOTREND_LIVE_SHORTAGES_DE: 'https://example.de/api',
  };
  applyLegacyEnvAliases(env);
  assert.equal(env.APOPULSE_SOURCE_MEINE_URL, 'https://example.at/feed.xml');
  assert.equal(env.APOPULSE_SOURCE_MEINE_COUNTRY, 'AT');
  assert.equal(env.APOPULSE_LIVE_SHORTAGES_DE, 'https://example.de/api');
});

test('leere Umgebung ergibt keine Übernahme', () => {
  assert.deepEqual(applyLegacyEnvAliases({}), []);
  assert.deepEqual(legacyEnvNamesInUse({}), []);
});

test('legacyEnvNamesInUse meldet, was in Render noch umzubenennen ist', () => {
  const env = { APOTREND_TOKEN_SECRET: 'x', APOTREND_ADMIN_EMAIL: 'y', APOPULSE_DATA_FILE: 'z', HOME: '/root' };
  assert.deepEqual(legacyEnvNamesInUse(env), ['APOTREND_ADMIN_EMAIL', 'APOTREND_TOKEN_SECRET']);
});

test('die Präfixe sind die erwarteten', () => {
  assert.equal(LEGACY_PREFIX, 'APOTREND_');
  assert.equal(CURRENT_PREFIX, 'APOPULSE_');
});
