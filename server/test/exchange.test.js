import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createExchangeRepo } from '../src/repo/exchangeRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';
import { createExchangeService } from '../src/services/exchange.js';

function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  const exchange = createExchangeService(createExchangeRepo(), social, repo);
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna Huber' });
  const B = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'B' }, owner: { name: 'Ben', email: 'b@b.at', password: 'geheim123' } });
  social.createProfile(B.user.id, { handle: 'ben', displayName: 'Ben Mayer' });
  return { exchange, a: A.user.id, b: B.user.id };
}

test('Biete-Eintrag anlegen: mit Autor-Profil, Status offen', () => {
  const { exchange, a } = setup();
  const e = exchange.create(a, { kind: 'biete', bezeichnung: 'Amoxicillin 1000 mg', menge: '20 Packungen', ort: '1010 Wien' });
  assert.equal(e.kind, 'biete');
  assert.equal(e.status, 'offen');
  assert.equal(e.author.handle, 'anna');
  assert.equal(e.menge, '20 Packungen');
});

test('Liste zeigt nur offene, nach Art filterbar', () => {
  const { exchange, a, b } = setup();
  exchange.create(a, { kind: 'biete', bezeichnung: 'Metformin 850' });
  exchange.create(b, { kind: 'suche', bezeichnung: 'Salbutamol Spray' });
  assert.equal(exchange.list(a).length, 2);
  assert.equal(exchange.list(a, { kind: 'suche' }).length, 1);
  assert.equal(exchange.list(a, { kind: 'biete' })[0].bezeichnung, 'Metformin 850');
});

test('Als erledigt markieren: nur Ersteller, danach nicht mehr in offener Liste', () => {
  const { exchange, a, b } = setup();
  const e = exchange.create(a, { kind: 'biete', bezeichnung: 'Ibuprofen 400' });
  assert.throws(() => exchange.markResolved(b, e.id), /Nur der Ersteller/);
  exchange.markResolved(a, e.id);
  assert.equal(exchange.list(a).length, 0);
  assert.equal(exchange.list(a, { status: 'erledigt' }).length, 1);
});

test('Ungültige Art und leere Bezeichnung werden abgelehnt', () => {
  const { exchange, a } = setup();
  assert.throws(() => exchange.create(a, { kind: 'tausch', bezeichnung: 'X' }), /biete.*suche/);
  assert.throws(() => exchange.create(a, { kind: 'biete', bezeichnung: '   ' }), /erforderlich/);
});
