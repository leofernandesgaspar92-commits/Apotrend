// Fundament-Service: Registrierung, Login, Mitgliedschaften/Rollen und die
// zentrale Mandanten-Isolation. Kennt nur das Repository-Interface + Domaenen-
// regeln — keine DB-Details, kein HTTP.
import { hashPassword, verifyPassword } from '../domain/password.js';
import { ROLES, ORG_TYPES, roleAllowedForOrgType, can } from '../domain/roles.js';

export function createOrgAuthService(repo) {
  return {
    // Neue Apotheke anlegen + erster Nutzer wird ADMIN dieser Apotheke.
    // Ersetzt die alte "erstes localStorage-Konto = Admin"-Simulation durch
    // echte, serverseitige Logik mit gehashtem Passwort.
    registerPharmacyWithOwner({ pharmacy, owner }) {
      const org = repo.createOrganization({ ...pharmacy, type: ORG_TYPES.PHARMACY });
      const user = repo.createUser({
        email: owner.email,
        name: owner.name,
        passwordHash: hashPassword(owner.password),
      });
      const membership = repo.createMembership({
        userId: user.id, organizationId: org.id, role: ROLES.ADMIN,
      });
      return { organization: org, user: publicUser(user), membership };
    },

    // Weiteren Nutzer in eine bestehende Organisation aufnehmen (Rolle geprueft).
    addMember({ organizationId, name, email, password, role }) {
      const org = repo.getOrganization(organizationId);
      if (!org) throw new Error('Unbekannte Organisation.');
      if (!roleAllowedForOrgType(role, org.type)) {
        throw new Error(`Rolle "${role}" ist im Org-Typ "${org.type}" nicht zulaessig.`);
      }
      const user = repo.createUser({ email, name, passwordHash: hashPassword(password) });
      const membership = repo.createMembership({ userId: user.id, organizationId, role });
      return { user: publicUser(user), membership };
    },

    // Login: E-Mail + Passwort. Gibt Nutzer + Mitgliedschaften zurueck (nie den Hash).
    login({ email, password }) {
      const user = repo.getUserByEmail(email);
      if (!user || !verifyPassword(password, user.password_hash)) {
        return { ok: false, error: 'E-Mail oder Passwort falsch.' };
      }
      if (user.status !== 'active') return { ok: false, error: 'Konto ist nicht aktiv.' };
      return { ok: true, user: publicUser(user), memberships: repo.getMembershipsForUser(user.id) };
    },

    // Passwort ändern (altes prüfen, neues gehasht setzen).
    changePassword(userId, { oldPassword, newPassword }) {
      const user = repo.getUserById(userId);
      if (!user) throw new Error('Unbekannter Nutzer.');
      if (!verifyPassword(oldPassword ?? '', user.password_hash)) throw new Error('Aktuelles Passwort ist falsch.');
      if (!newPassword || String(newPassword).length < 8) throw new Error('Neues Passwort: mindestens 8 Zeichen.');
      repo.setUserPassword(userId, hashPassword(newPassword));
      return { ok: true };
    },

    // Passwort eines eingeloggten Nutzers prüfen (z.B. vor Konto-Löschung).
    verifyUserPassword(userId, password) {
      const user = repo.getUserById(userId);
      return !!(user && verifyPassword(password ?? '', user.password_hash));
    },

    // ── Mandanten-Isolation (zentral, serverseitig) ─────────────────────────
    // Liefert die Rolle des Nutzers in einer Organisation — oder null, wenn er
    // NICHT Mitglied ist. Jede geschuetzte Aktion muss hierueber gehen.
    membershipOf(userId, organizationId) {
      return repo.getMembershipsForUser(userId).find(m => m.organization_id === organizationId) || null;
    },

    // Wirft, wenn der Nutzer die Faehigkeit in DIESER Organisation nicht hat.
    // Verhindert das Kernrisiko: Zugriff ueber Apotheken-Grenzen hinweg.
    assertCan(userId, organizationId, capability) {
      const m = this.membershipOf(userId, organizationId);
      if (!m) throw new ForbiddenError('Kein Mitglied dieser Organisation.');
      if (!can(m.role, capability)) throw new ForbiddenError(`Rolle "${m.role}" darf "${capability}" nicht.`);
      return m;
    },
  };
}

export class ForbiddenError extends Error {
  constructor(msg) { super(msg); this.name = 'ForbiddenError'; this.status = 403; }
}

function publicUser(u) {
  const { password_hash, twofa_secret, ...safe } = u;
  return safe;
}
