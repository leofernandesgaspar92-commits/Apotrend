// Fundament-Service: Registrierung, Login, Mitgliedschaften/Rollen und die
// zentrale Mandanten-Isolation. Kennt nur das Repository-Interface + Domaenen-
// regeln — keine DB-Details, kein HTTP.
import { hashPassword, verifyPassword } from '../domain/password.js';
import { generateRecoveryCodes, matchRecoveryCode } from '../domain/recoveryCodes.js';
import { ROLES, ORG_TYPES, roleAllowedForOrgType, can } from '../domain/roles.js';
import { AppError } from '../domain/errors.js';

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
      // Einmal-Wiederherstellungscodes erzeugen: Klartext EINMAL zurückgeben, nur Hashes speichern.
      const { codes, hashes } = generateRecoveryCodes();
      repo.setRecoveryHashes(user.id, hashes);
      return { organization: org, user: publicUser(user), membership, recoveryCodes: codes };
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
      if (!verifyPassword(oldPassword ?? '', user.password_hash)) throw new AppError('current_pw_wrong', 'Aktuelles Passwort ist falsch.');
      if (!newPassword || String(newPassword).length < 8) throw new AppError('new_pw_short', 'Neues Passwort: mindestens 8 Zeichen.');
      repo.setUserPassword(userId, hashPassword(newPassword));
      return { ok: true };
    },

    // Passwort per Einmal-Wiederherstellungscode zurücksetzen (ohne E-Mail-Dienst).
    // E-Mail + Code + neues Passwort. Ein falsches Paar liefert bewusst denselben
    // generischen Fehler (reset_invalid) — verrät nicht, ob die E-Mail existiert.
    resetPassword({ email, code, newPassword }) {
      if (!newPassword || String(newPassword).length < 8) throw new AppError('new_pw_short', 'Neues Passwort: mindestens 8 Zeichen.');
      const user = repo.getUserByEmail(email || '');
      const idx = user ? matchRecoveryCode(code, user.recovery_hashes || []) : -1;
      if (!user || idx === -1) throw new AppError('reset_invalid', 'E-Mail oder Wiederherstellungscode ist ungültig.');
      // Genutzten Code verbrauchen (einmalig gültig), dann Passwort setzen.
      const remaining = (user.recovery_hashes || []).filter((_, i) => i !== idx);
      repo.setRecoveryHashes(user.id, remaining);
      repo.setUserPassword(user.id, hashPassword(newPassword));
      return { ok: true, remaining_codes: remaining.length };
    },

    // Anzahl noch gültiger Wiederherstellungscodes (fürs eingeloggte Konto).
    remainingRecoveryCodes(userId) {
      const user = repo.getUserById(userId);
      return user ? (user.recovery_hashes || []).length : 0;
    },

    // Neue Codes erzeugen (invalidiert alle alten) — Klartext EINMAL zurückgeben.
    regenerateRecoveryCodes(userId) {
      const user = repo.getUserById(userId);
      if (!user) throw new Error('Unbekannter Nutzer.');
      const { codes, hashes } = generateRecoveryCodes();
      repo.setRecoveryHashes(userId, hashes);
      return { codes };
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

    // ── Team-Verwaltung (Mitglieder einer Organisation) ─────────────────────
    // Primäre Organisation des Nutzers (in der Praxis genau eine: die eigene Apotheke).
    primaryOrg(userId) {
      const ms = repo.getMembershipsForUser(userId);
      return ms[0] || null;
    },
    // Für die UI: eigene Rolle + ob Team-Verwaltung erlaubt ist.
    myMembership(userId) {
      const m = this.primaryOrg(userId);
      if (!m) return null;
      const org = repo.getOrganization(m.organization_id);
      return { organization_id: m.organization_id, org_name: org ? org.name : null, org_type: org ? org.type : null, role: m.role, can_manage_users: can(m.role, 'manage_users') };
    },
    // Team der eigenen Organisation (nur mit manage_users).
    teamMembers(actorUserId) {
      const m = this.primaryOrg(actorUserId);
      if (!m) throw new ForbiddenError('Keine Organisation.');
      this.assertCan(actorUserId, m.organization_id, 'manage_users');
      return repo.getMembershipsForOrganization(m.organization_id).map(mem => {
        const u = repo.getUserById(mem.user_id);
        return { user_id: mem.user_id, name: u ? u.name : null, email: u ? u.email : null, role: mem.role, is_self: mem.user_id === actorUserId, created_at: mem.created_at };
      }).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    },
    addTeamMember(actorUserId, { name, email, password, role }) {
      const m = this.primaryOrg(actorUserId);
      if (!m) throw new ForbiddenError('Keine Organisation.');
      this.assertCan(actorUserId, m.organization_id, 'manage_users');
      const nm = String(name ?? '').trim();
      const em = String(email ?? '').trim();
      if (nm.length < 2) throw new AppError('team_name', 'Name fehlt.', 400);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) throw new AppError('team_email', 'Gültige E-Mail erforderlich.', 400);
      if (!password || String(password).length < 8) throw new AppError('new_pw_short', 'Passwort: mindestens 8 Zeichen.', 400);
      // Doppelte E-Mail als 400-Feldfehler melden (nicht als 500), konsistent mit den übrigen Prüfungen.
      if (repo.getUserByEmail(em)) throw new AppError('team_email_taken', 'E-Mail ist bereits vergeben.', 400);
      // addMember prüft roleAllowedForOrgType (wirft bei ungültiger Rolle für den Org-Typ).
      return this.addMember({ organizationId: m.organization_id, name: nm, email: em, password, role });
    },
    setMemberRole(actorUserId, targetUserId, role) {
      const m = this.primaryOrg(actorUserId);
      if (!m) throw new ForbiddenError('Keine Organisation.');
      this.assertCan(actorUserId, m.organization_id, 'manage_users');
      const org = repo.getOrganization(m.organization_id);
      if (!roleAllowedForOrgType(role, org.type)) throw new AppError('team_role', 'Rolle im Org-Typ nicht zulässig.', 400);
      const members = repo.getMembershipsForOrganization(m.organization_id);
      const target = members.find(x => x.user_id === targetUserId);
      if (!target) throw new AppError('team_not_member', 'Kein Mitglied dieser Organisation.', 404);
      // Letzten Admin nicht herabstufen (sonst niemand mehr verwaltungsberechtigt).
      if (target.role === ROLES.ADMIN && role !== ROLES.ADMIN) {
        const admins = members.filter(x => x.role === ROLES.ADMIN).length;
        if (admins <= 1) throw new AppError('team_last_admin', 'Die letzte Admin-Rolle kann nicht entzogen werden.', 400);
      }
      const updated = repo.setMembershipRole(targetUserId, m.organization_id, role);
      return { user_id: targetUserId, role: updated ? updated.role : role };
    },
    removeTeamMember(actorUserId, targetUserId) {
      const m = this.primaryOrg(actorUserId);
      if (!m) throw new ForbiddenError('Keine Organisation.');
      this.assertCan(actorUserId, m.organization_id, 'manage_users');
      if (targetUserId === actorUserId) throw new AppError('team_self', 'Sich selbst kann man nicht entfernen.', 400);
      const members = repo.getMembershipsForOrganization(m.organization_id);
      const target = members.find(x => x.user_id === targetUserId);
      if (!target) throw new AppError('team_not_member', 'Kein Mitglied dieser Organisation.', 404);
      if (target.role === ROLES.ADMIN && members.filter(x => x.role === ROLES.ADMIN).length <= 1) {
        throw new AppError('team_last_admin', 'Die letzte Admin-Rolle kann nicht entfernt werden.', 400);
      }
      repo.removeMembership(targetUserId, m.organization_id);
      return { ok: true, removed: targetUserId };
    },
  };
}

export class ForbiddenError extends Error {
  constructor(msg) { super(msg); this.name = 'ForbiddenError'; this.status = 403; }
}

function publicUser(u) {
  const { password_hash, twofa_secret, recovery_hashes, ...safe } = u;
  return safe;
}
