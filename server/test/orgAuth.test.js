import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createOrgAuthService, ForbiddenError } from '../src/services/orgAuth.js';

function fresh() {
  const repo = createMemoryRepo();
  return { repo, svc: createOrgAuthService(repo) };
}

test('Registrierung: Apotheke + erster Nutzer wird Admin, kein Hash nach aussen', () => {
  const { svc } = fresh();
  const r = svc.registerPharmacyWithOwner({
    pharmacy: { name: 'Apotheke am Markt', ort: 'Wien' },
    owner: { name: 'Dr. Huber', email: 'HUBER@apo.at', password: 'geheim123' },
  });
  assert.equal(r.organization.type, 'pharmacy');
  assert.equal(r.membership.role, 'admin');
  assert.equal(r.user.email, 'huber@apo.at'); // case-insensitive normalisiert
  assert.equal(r.user.password_hash, undefined); // niemals ausliefern
});

test('Login: korrekt vs. falsch', () => {
  const { svc } = fresh();
  svc.registerPharmacyWithOwner({
    pharmacy: { name: 'A', ort: 'Wien' },
    owner: { name: 'X', email: 'x@apo.at', password: 'geheim123' },
  });
  assert.equal(svc.login({ email: 'x@apo.at', password: 'geheim123' }).ok, true);
  assert.equal(svc.login({ email: 'x@apo.at', password: 'falsch' }).ok, false);
  assert.equal(svc.login({ email: 'unbekannt@apo.at', password: 'geheim123' }).ok, false);
});

test('E-Mail ist eindeutig', () => {
  const { svc } = fresh();
  svc.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'X', email: 'x@apo.at', password: 'geheim123' } });
  assert.throws(
    () => svc.addMember({ organizationId: 'egal', name: 'Y', email: 'x@apo.at', password: 'geheim123', role: 'pta' }),
    /Unbekannte Organisation|bereits vergeben/,
  );
});

test('Rolle muss zum Org-Typ passen (Pharmareferent nicht in Apotheke)', () => {
  const { svc } = fresh();
  const r = svc.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'X', email: 'x@apo.at', password: 'geheim123' } });
  // gueltig: PTA in Apotheke
  const pta = svc.addMember({ organizationId: r.organization.id, name: 'PTA', email: 'pta@apo.at', password: 'geheim123', role: 'pta' });
  assert.equal(pta.membership.role, 'pta');
  // ungueltig: Pharmareferent gehoert nicht in eine Apotheke
  assert.throws(
    () => svc.addMember({ organizationId: r.organization.id, name: 'Ref', email: 'ref@pharma.at', password: 'geheim123', role: 'pharmareferent' }),
    /nicht zulaessig/,
  );
});

test('Mandanten-Isolation: kein Zugriff ueber Apotheken-Grenzen', () => {
  const { svc } = fresh();
  const a = svc.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'AChef', email: 'a@apo.at', password: 'geheim123' } });
  const b = svc.registerPharmacyWithOwner({ pharmacy: { name: 'B' }, owner: { name: 'BChef', email: 'b@apo.at', password: 'geheim123' } });

  // A-Chef ist Mitglied in A, aber NICHT in B
  assert.ok(svc.membershipOf(a.user.id, a.organization.id));
  assert.equal(svc.membershipOf(a.user.id, b.organization.id), null);

  // Zugriff auf B mit A-Nutzer -> ForbiddenError
  assert.throws(() => svc.assertCan(a.user.id, b.organization.id, 'collab'), ForbiddenError);
  // Zugriff auf die eigene Apotheke -> ok
  assert.doesNotThrow(() => svc.assertCan(a.user.id, a.organization.id, 'collab'));
});

test('RBAC: Lehrling darf keine Aufgaben zuweisen, Apotheker schon', () => {
  const { svc } = fresh();
  const r = svc.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Chef', email: 'chef@apo.at', password: 'geheim123' } });
  const apo = svc.addMember({ organizationId: r.organization.id, name: 'Apo', email: 'apo@apo.at', password: 'geheim123', role: 'apotheker' });
  const azubi = svc.addMember({ organizationId: r.organization.id, name: 'Azubi', email: 'azubi@apo.at', password: 'geheim123', role: 'lehrling' });

  assert.doesNotThrow(() => svc.assertCan(apo.user.id, r.organization.id, 'assign_tasks'));
  assert.throws(() => svc.assertCan(azubi.user.id, r.organization.id, 'assign_tasks'), ForbiddenError);
});
