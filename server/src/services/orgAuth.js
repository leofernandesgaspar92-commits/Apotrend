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
  };
}

export class ForbiddenError extends Error {
  constructor(msg) { super(msg); this.name = 'ForbiddenError'; this.status = 403; }
}

function publicUser(u) {
  const { password_hash, twofa_secret, recovery_hashes, ...safe } = u;
  return safe;
}
