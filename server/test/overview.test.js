import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createShortagesRepo } from '../src/repo/shortagesRepo.js';
import { createPricesRepo } from '../src/repo/pricesRepo.js';
import { createRabatteRepo } from '../src/repo/rabatteRepo.js';
import { createExchangeRepo } from '../src/repo/exchangeRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';
import { createShortagesService } from '../src/services/shortages.js';
import { createRabatteService } from '../src/services/rabatte.js';
import { createExchangeService } from '../src/services/exchange.js';
import { createPricesService } from '../src/services/prices.js';
import { createOverviewService } from '../src/services/overview.js';
import { createAmrService } from '../src/services/amr.js';

function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  const shortages = createShortagesService(createShortagesRepo(), social);
  const rabatte = createRabatteService(createRabatteRepo({ today: '2026-07-07' }), social);
  const exchange = createExchangeService(createExchangeRepo(), social, repo);
  const prices = createPricesService(createPricesRepo(), social);
  const overview = createOverviewService({ shortages, exchange, social, rabatte, prices, amr: createAmrService() });
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  return { overview, exchange, shortages, a: A.user.id };
}

test('Übersicht bündelt Engpässe, Austausch, Benachrichtigungen, Top-Rabatt', () => {
  const { overview, exchange, a } = setup();
  exchange.create(a, { kind: 'biete', bezeichnung: 'Amoxicillin 1000 mg' });
  exchange.create(a, { kind: 'suche', bezeichnung: 'Salbutamol' });
  const o = overview.forUser(a);
  assert.ok(o.shortages.kritisch >= 1, 'kritische Engpässe aus Seed');
  assert.ok(o.shortages.top.length <= 3);
  assert.equal(o.exchange.biete, 1);
  assert.equal(o.exchange.suche, 1);
  assert.equal(o.exchange.recent.length, 2);
  assert.ok('unread' in o.notifications);
  assert.ok(o.top_rabatt && o.top_rabatt.rabatt_pct > 0);
  assert.ok(o.savings && o.savings.total_abs > 0, 'Sparpotenzial aus Preisdaten');
  // Antibiotika-Engpässe aus dem Seed (Amoxicillin, Clarithromycin sind kritisch).
  assert.ok(o.shortages.antibiotika >= 2, 'aktive Antibiotika-Engpässe gezählt');
  assert.ok(o.shortages.antibiotika <= o.shortages.total, 'nicht mehr als alle Engpässe');
});

test('watch_deals: beobachtete Wirkstoffe mit laufender Aktion', () => {
  const { overview, shortages, a } = setup();
  // Amoxicillin hat im Rabatt-Seed eine laufende Aktion (Kwizda), Ramipril auch.
  shortages.watch(a, 'Amoxicillin');
  shortages.watch(a, 'Gibtsnicht'); // ohne Aktion -> darf nicht auftauchen
  const o = overview.forUser(a);
  assert.equal(o.watch_deals.length, 1);
  assert.equal(o.watch_deals[0].wirkstoff, 'Amoxicillin');
  assert.ok(o.watch_deals[0].rabatt_pct > 0);
  assert.ok(o.watch_deals[0].supplier);
});

test('watch_deals: leer, wenn nichts beobachtet wird', () => {
  const { overview, a } = setup();
  assert.deepEqual(overview.forUser(a).watch_deals, []);
});

test('watch_offers: beobachteter Wirkstoff mit offenem Biete-Angebot', () => {
  const { overview, exchange, shortages, a } = setup();
  shortages.watch(a, 'Amoxicillin');
  exchange.create(a, { kind: 'biete', bezeichnung: 'Amoxicillin 1000 mg Filmtabletten' });
  exchange.create(a, { kind: 'suche', bezeichnung: 'Amoxicillin gesucht' }); // suche zählt NICHT
  const o = overview.forUser(a);
  const wo = o.watch_offers.find(x => x.wirkstoff === 'Amoxicillin');
  assert.ok(wo, 'Bezugsquelle vorhanden');
  assert.equal(wo.offers_count, 1);
});

test('watch_offers: leer ohne passende Angebote', () => {
  const { overview, shortages, a } = setup();
  shortages.watch(a, 'Amoxicillin');
  assert.deepEqual(overview.forUser(a).watch_offers, []);
});

test('my_seeks: eigenes offenes Gesuch mit passendem Angebot einer anderen Apotheke', () => {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  const shortages = createShortagesService(createShortagesRepo(), social);
  const rabatte = createRabatteService(createRabatteRepo({ today: '2026-07-07' }), social);
  const exchange = createExchangeService(createExchangeRepo(), social, repo);
  const prices = createPricesService(createPricesRepo(), social);
  const overview = createOverviewService({ shortages, exchange, social, rabatte, prices, amr: createAmrService() });
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  const B = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'B' }, owner: { name: 'Bea', email: 'b@b.at', password: 'geheim123' } });
  social.createProfile(B.user.id, { handle: 'bea', displayName: 'Bea' });
  const a = A.user.id, b = B.user.id;

  // Ohne Angebot: Gesuch zählt, aber ohne Treffer.
  exchange.create(a, { kind: 'suche', bezeichnung: 'Salbutamol Dosieraerosol' });
  let o = overview.forUser(a);
  assert.equal(o.my_seeks.open, 1);
  assert.equal(o.my_seeks.with_matches, 0);
  assert.equal(o.my_seeks.items.length, 0);

  // Andere Apotheke bietet passenden Bestand -> Treffer taucht auf.
  exchange.create(b, { kind: 'biete', bezeichnung: 'Salbutamol Spray 100 mcg' });
  o = overview.forUser(a);
  assert.equal(o.my_seeks.with_matches, 1);
  assert.equal(o.my_seeks.items[0].bezeichnung, 'Salbutamol Dosieraerosol');
  assert.equal(o.my_seeks.items[0].match_count, 1);
  // Für die andere Apotheke (kein eigenes Gesuch) leer.
  assert.equal(overview.forUser(b).my_seeks.with_matches, 0);
});

test('Rabatt-Alarm: einmalige Benachrichtigung ab Schwelle, kein Duplikat; Validierung', () => {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  const shortages = createShortagesService(createShortagesRepo(), social);
  const rabatte = createRabatteService(createRabatteRepo({ today: '2026-07-07' }), social);
  const exchange = createExchangeService(createExchangeRepo(), social, repo);
  const prices = createPricesService(createPricesRepo(), social);
  const overview = createOverviewService({ shortages, exchange, social, rabatte, prices, amr: createAmrService() });
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  const a = A.user.id;

  const deal = rabatte.top10(a).find(r => r.wirkstoff);
  assert.ok(deal, 'Seed hat mindestens einen Rabatt mit Wirkstoff');
  // Ohne Alarm: keine Benachrichtigung, auch wenn beobachtet
  shortages.watch(a, deal.wirkstoff);
  overview.forUser(a);
  assert.equal(social.notifications(a).filter(n => n.type === 'price_alert').length, 0);
  // Validierung: nicht beobachtet -> Fehler; Bereich 1..99
  assert.throws(() => shortages.setWatchAlert(a, 'GarNichtBeobachtet', 20), /Beobachtungsliste/);
  assert.throws(() => shortages.setWatchAlert(a, deal.wirkstoff, 0), /1.*99|Schwelle/);
  assert.throws(() => shortages.setWatchAlert(a, deal.wirkstoff, 150), /1.*99|Schwelle/);
  // Alarm ab 1 % -> triggert einmalig
  shortages.setWatchAlert(a, deal.wirkstoff, 1);
  overview.forUser(a);
  const n1 = social.notifications(a).filter(n => n.type === 'price_alert');
  assert.equal(n1.length, 1);
  assert.ok(n1[0].label.includes(deal.wirkstoff));
  // Erneuter Aufruf -> kein Duplikat (Dedup)
  overview.forUser(a);
  assert.equal(social.notifications(a).filter(n => n.type === 'price_alert').length, 1);
});
