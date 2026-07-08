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

function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  const shortages = createShortagesService(createShortagesRepo(), social);
  const rabatte = createRabatteService(createRabatteRepo({ today: '2026-07-07' }), social);
  const exchange = createExchangeService(createExchangeRepo(), social, repo);
  const prices = createPricesService(createPricesRepo(), social);
  const overview = createOverviewService({ shortages, exchange, social, rabatte, prices });
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  return { overview, exchange, a: A.user.id };
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
});
