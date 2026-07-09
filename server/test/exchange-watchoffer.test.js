import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createExchangeRepo } from '../src/repo/exchangeRepo.js';
import { createShortagesRepo } from '../src/repo/shortagesRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';
import { createExchangeService } from '../src/services/exchange.js';

function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  const shortagesRepo = createShortagesRepo({ seed: false });
  const exchange = createExchangeService(createExchangeRepo(), social, repo, shortagesRepo);
  const mk = (n, h) => { const r = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: n }, owner: { name: n, email: h + '@a.at', password: 'geheim123' } }); social.createProfile(r.user.id, { handle: h, displayName: n }); return r.user.id; };
  return { social, exchange, shortagesRepo, watcher: mk('Wächter', 'watch'), offerer: mk('Bieter', 'offer') };
}

test('watch_offer: Beobachter:in wird bei passendem Biete-Angebot benachrichtigt', () => {
  const { social, exchange, shortagesRepo, watcher, offerer } = setup();
  shortagesRepo.addWatch(watcher, 'Amoxicillin');
  exchange.create(offerer, { kind: 'biete', bezeichnung: 'Amoxicillin 1000 mg Filmtabletten' });
  const n = social.notifications(watcher).find(x => x.type === 'watch_offer');
  assert.ok(n, 'watch_offer Benachrichtigung');
  assert.equal(n.label, 'Amoxicillin');
});

test('watch_offer: keine Benachrichtigung bei "suche" (nur biete)', () => {
  const { social, exchange, shortagesRepo, watcher, offerer } = setup();
  shortagesRepo.addWatch(watcher, 'Amoxicillin');
  exchange.create(offerer, { kind: 'suche', bezeichnung: 'Amoxicillin 1000 mg' });
  assert.equal(social.notifications(watcher).filter(x => x.type === 'watch_offer').length, 0);
});

test('watch_offer: nicht an den/die Anbietende:n selbst', () => {
  const { social, exchange, shortagesRepo, offerer } = setup();
  shortagesRepo.addWatch(offerer, 'Amoxicillin'); // Anbieter beobachtet selbst
  exchange.create(offerer, { kind: 'biete', bezeichnung: 'Amoxicillin 1000 mg' });
  assert.equal(social.notifications(offerer).filter(x => x.type === 'watch_offer').length, 0);
});

test('watch_offer: kein Treffer, wenn Wirkstoff nicht in der Bezeichnung', () => {
  const { social, exchange, shortagesRepo, watcher, offerer } = setup();
  shortagesRepo.addWatch(watcher, 'Metformin');
  exchange.create(offerer, { kind: 'biete', bezeichnung: 'Amoxicillin 1000 mg' });
  assert.equal(social.notifications(watcher).filter(x => x.type === 'watch_offer').length, 0);
});

test('watch_offer: ein Treffer je Nutzer, auch bei mehreren beobachteten Treffern', () => {
  const { social, exchange, shortagesRepo, watcher, offerer } = setup();
  shortagesRepo.addWatch(watcher, 'Amoxicillin');
  shortagesRepo.addWatch(watcher, '1000'); // beide würden matchen
  exchange.create(offerer, { kind: 'biete', bezeichnung: 'Amoxicillin 1000 mg' });
  assert.equal(social.notifications(watcher).filter(x => x.type === 'watch_offer').length, 1);
});
