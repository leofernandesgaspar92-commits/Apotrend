import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createOrgAuthService, ForbiddenError } from '../src/services/orgAuth.js';

function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const reg = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'Stadt-Apotheke' }, owner: { name: 'Chef', email: 'chef@a.at', password: 'geheim123' } });
  return { repo, orgAuth, owner: reg.user.id, orgId: reg.organization.id };
}

test('Team: Inhaber ist Admin und darf verwalten; Team enthält zunächst nur ihn', () => {
  const { orgAuth, owner } = setup();
  const me = orgAuth.myMembership(owner);
  assert.equal(me.role, 'admin');
  assert.equal(me.can_manage_users, true);
  const team = orgAuth.teamMembers(owner);
  assert.equal(team.length, 1);
  assert.equal(team[0].is_self, true);
});

test('Team: Mitglied hinzufügen (Rolle geprüft) und auflisten', () => {
  const { orgAuth, owner } = setup();
  const r = orgAuth.addTeamMember(owner, { name: 'PTA Meier', email: 'pta@a.at', password: 'Passwort1', role: 'pta' });
  assert.equal(r.membership.role, 'pta');
  const team = orgAuth.teamMembers(owner);
  assert.equal(team.length, 2);
  assert.ok(team.some(m => m.email === 'pta@a.at' && m.role === 'pta'));
  // Ungültige Rolle für Apotheke (pharmareferent gehört zu supplier)
  assert.throws(() => orgAuth.addTeamMember(owner, { name: 'Rolle Falsch', email: 'x@a.at', password: 'Passwort1', role: 'pharmareferent' }), /zulaessig|zulässig/i);
  // Validierung
  assert.throws(() => orgAuth.addTeamMember(owner, { name: 'Mail Fehlt', email: 'keinemail', password: 'Passwort1', role: 'pta' }), /E-Mail/);
  assert.throws(() => orgAuth.addTeamMember(owner, { name: 'Pw Kurz', email: 'z@a.at', password: 'kurz', role: 'pta' }), /8 Zeichen/);
});

test('Team: Nicht-Admin darf nicht verwalten', () => {
  const { orgAuth, owner } = setup();
  const r = orgAuth.addTeamMember(owner, { name: 'Azubi', email: 'azubi@a.at', password: 'Passwort1', role: 'lehrling' });
  const azubi = r.user.id;
  assert.equal(orgAuth.myMembership(azubi).can_manage_users, false);
  assert.throws(() => orgAuth.teamMembers(azubi), ForbiddenError);
  assert.throws(() => orgAuth.addTeamMember(azubi, { name: 'Q', email: 'q@a.at', password: 'Passwort1', role: 'pta' }), ForbiddenError);
});

test('Team: Rolle ändern; letzter Admin ist geschützt', () => {
  const { orgAuth, owner } = setup();
  const r = orgAuth.addTeamMember(owner, { name: 'Apo Zwei', email: 'apo2@a.at', password: 'Passwort1', role: 'apotheker' });
  const other = r.user.id;
  // hochstufen auf admin
  orgAuth.setMemberRole(owner, other, 'admin');
  assert.equal(orgAuth.myMembership(other).role, 'admin');
  // jetzt zwei Admins -> Inhaber darf herabgestuft werden
  orgAuth.setMemberRole(owner, owner, 'apotheker');
  assert.equal(orgAuth.myMembership(owner).role, 'apotheker');
  // 'other' ist jetzt einziger Admin -> nicht herabstufbar
  assert.throws(() => orgAuth.setMemberRole(other, other, 'pta'), /Admin/);
});

test('Team: Mitglied entfernen; nicht sich selbst; nicht letzten Admin', () => {
  const { orgAuth, owner } = setup();
  const r = orgAuth.addTeamMember(owner, { name: 'PTA', email: 'pta@a.at', password: 'Passwort1', role: 'pta' });
  const pta = r.user.id;
  assert.throws(() => orgAuth.removeTeamMember(owner, owner), /selbst/);
  orgAuth.removeTeamMember(owner, pta);
  assert.equal(orgAuth.teamMembers(owner).length, 1);
});
