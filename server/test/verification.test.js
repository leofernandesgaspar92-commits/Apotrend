// ============================================================================
//  Verifizierungs-Durchlauf — der Nachweis, auf dem die Rx-Schranke steht
// ============================================================================
//  Bis hierher war das ein Freitextfeld und ein Haken. Seit der
//  Fachkreis-Schranke (domain/jurisdiction.js) haengt daran, wer Angebote fuer
//  verschreibungspflichtige Arzneimittel ueberhaupt sehen darf — die
//  Lizenznummer ist damit die Grundlage der Freigabe, nicht Zierde.
//
//  Die beiden Zusicherungen, auf die es ankommt:
//   · OHNE LIZENZNUMMER kein Antrag (ausser Behoerden, die sich anders
//     legitimieren). Eine Freigabe auf Zuruf waere genau die Schranke auf dem
//     Papier, die die Rx-Sperre vermeiden soll.
//   · DIE FREIGABE RICHTET SICH NACH DEM KONTOTYP. Pauschal `isRxAllowed =
//     true` zu setzen waere falsch: Ein Transportunternehmen befoerdert
//     Arzneimittel, es erwirbt sie nicht.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';

function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  // Moderator = wer is_editorial im Profil hat
  const socialRepo = createSocialRepo();
  const social = createSocialService(socialRepo, repo, {
    isModerator: (uid) => { const p = socialRepo.getProfileByUserId(uid); return !!(p && p.is_editorial); },
  });
  const M = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'Red' }, owner: { name: 'Mod', email: 'm@m.at', password: 'geheim123' } });
  social.createProfile(M.user.id, { handle: 'mod', displayName: 'Moderation', isEditorial: true });
  let n = 0;
  const mach = (handle, accountType = 'pharmacy', country = 'AT') => {
    n++;
    const r = orgAuth.registerPharmacyWithOwner({
      pharmacy: { name: handle }, owner: { name: handle, email: `${handle}${n}@a.at`, password: 'geheim123' },
    });
    social.createProfile(r.user.id, { handle, displayName: handle, accountType, country });
    return r.user.id;
  };
  return { social, socialRepo, mod: M.user.id, a: mach('anna'), mach };
}

const LIZENZ = 'AT-K-2026-1188';

// ─────────────────────────────────────────────────────────────────────────────
//  Antrag
// ─────────────────────────────────────────────────────────────────────────────

test('Verifizierung beantragen -> in Moderations-Queue, mit allem zur Pruefung', () => {
  const { social, mod, a } = setup();
  social.requestVerification(a, { licenseNumber: LIZENZ, note: 'Apotheke Zum Hirschen, Wien' });
  const q = social.verificationQueue(mod);
  assert.equal(q.length, 1);
  assert.equal(q[0].handle, 'anna');
  assert.equal(q[0].license_number, LIZENZ);
  assert.match(q[0].note, /Zum Hirschen/);
  // Die Ansicht muss sagen, WAS eine Freigabe bedeutet — sonst drueckt jemand
  // „genehmigen", ohne zu wissen, ob damit Rx-Einblick entsteht.
  assert.equal(q[0].account_type, 'pharmacy');
  assert.equal(q[0].would_allow_rx, true);
  assert.equal(q[0].country, 'AT');
  assert.equal(social.myVerification(a).status, 'offen');
  assert.equal(social.myVerification(a).license_number, LIZENZ);
});

test('ohne Lizenznummer gibt es keinen Antrag', () => {
  const { social, a } = setup();
  assert.throws(() => social.requestVerification(a, { note: 'bin eine Apotheke, versprochen' }),
    (e) => e.code === 'verify_license_required');
  assert.throws(() => social.requestVerification(a, { licenseNumber: '  ' }),
    (e) => e.code === 'verify_license_required');
  // Zu kurz zaehlt nicht als Nummer.
  assert.throws(() => social.requestVerification(a, { licenseNumber: 'AT' }),
    (e) => e.code === 'verify_license_short');
});

test('eine Behoerde legitimiert sich anders — ohne Lizenznummer', () => {
  const { social, mod, mach } = setup();
  const b = mach('basg_at', 'authority');
  social.requestVerification(b, { note: 'Amtliche Stelle' });
  const q = social.verificationQueue(mod);
  assert.equal(q.length, 1);
  // Und eine Freigabe bedeutet hier KEINEN Rx-Einblick: Eine Behoerde liest
  // und meldet, sie handelt nicht mit Arzneimitteln.
  assert.equal(q[0].would_allow_rx, false);
});

test('Privatnutzer:innen koennen sie nicht beantragen', () => {
  const { social, mach } = setup();
  const p = mach('paul', 'private');
  // Ein Antrag, der nie bewilligt werden kann, ist kein Angebot, sondern eine
  // Sackgasse — und der Fehlertext sagt, was stattdessen zu tun ist.
  assert.throws(() => social.requestVerification(p, { licenseNumber: LIZENZ }),
    (e) => e.code === 'verify_private' && /Apotheke, Grosshandel, Logistik/.test(e.message));
});

test('der Kontotyp wird MIT DEM ANTRAG festgehalten', () => {
  // Das Profil laesst sich zwischen Antrag und Freigabe aendern. Wer als
  // Logistik beantragt und vor der Freigabe auf Apotheke umstellt, bekaeme
  // sonst eine Stufe freigeschaltet, die nie geprueft wurde.
  const { social, mod, mach } = setup();
  const l = mach('lea', 'logistics');
  social.requestVerification(l, { licenseNumber: 'AT-LOG-77' });
  social.updateProfile(l, { accountType: 'pharmacy' }); // Umstellung nach dem Antrag
  const q = social.verificationQueue(mod);
  assert.equal(q[0].account_type, 'logistics', 'der Antragszeitpunkt gilt');
  assert.equal(q[0].would_allow_rx, false);
  const r = social.resolveVerification(mod, l, true);
  assert.equal(r.rx_allowed, false, 'die Umstellung erschleicht keinen Rx-Einblick');
});

// ─────────────────────────────────────────────────────────────────────────────
//  Freigabe
// ─────────────────────────────────────────────────────────────────────────────

test('Genehmigen setzt verified, Rx-Einblick und Lizenz am Profil + benachrichtigt', () => {
  const { social, mod, a } = setup();
  social.requestVerification(a, { licenseNumber: LIZENZ });
  const r = social.resolveVerification(mod, a, true);
  assert.equal(r.status, 'verifiziert');
  assert.equal(r.rx_allowed, true);
  const prof = social.getProfile('anna');
  assert.equal(prof.verified, true);
  assert.equal(prof.is_rx_allowed, true);
  assert.equal(prof.license_number, LIZENZ, 'die geprüfte Nummer bleibt am Profil');
  const mine = social.myVerification(a);
  assert.equal(mine.status, 'verifiziert');
  assert.equal(mine.rx_allowed, true);
  assert.equal(social.verificationQueue(mod).length, 0);
  assert.ok(social.notifications(a).some((n) => n.type === 'verified'));
});

test('ein Logistiker wird verifiziert, bekommt aber KEINEN Rx-Einblick', () => {
  const { social, mod, mach } = setup();
  const l = mach('lea', 'logistics');
  social.requestVerification(l, { licenseNumber: 'AT-LOG-42' });
  const r = social.resolveVerification(mod, l, true);
  assert.equal(r.rx_allowed, false);
  const prof = social.getProfile('lea');
  assert.equal(prof.verified, true, 'verifiziert ist er trotzdem');
  assert.equal(prof.is_rx_allowed, false);
  // DER PUNKT dieser Zusicherung: Er ist verifiziert und sieht kein Rx. Ohne
  // die Angabe im Status sieht das aus wie ein Fehler — deshalb nennt
  // myVerification sie ausdruecklich.
  assert.equal(social.myVerification(l).rx_allowed, false);
});

test('ein Grosshaendler bekommt Rx-Einblick', () => {
  const { social, mod, mach } = setup();
  const g = mach('gerd', 'wholesale');
  social.requestVerification(g, { licenseNumber: 'AT-GH-9' });
  assert.equal(social.resolveVerification(mod, g, true).rx_allowed, true);
});

test('Ablehnen setzt nichts', () => {
  const { social, mod, a } = setup();
  social.requestVerification(a, { licenseNumber: LIZENZ });
  social.resolveVerification(mod, a, false);
  const prof = social.getProfile('anna');
  assert.equal(prof.verified, false);
  assert.notEqual(prof.is_rx_allowed, true);
  assert.equal(social.myVerification(a).status, 'abgelehnt');
});

test('Nicht-Moderator darf Queue nicht sehen; bereits Verifizierte nicht erneut beantragen', () => {
  const { social, mod, a } = setup();
  assert.throws(() => social.verificationQueue(a), /Nur Moderation/);
  social.requestVerification(a, { licenseNumber: LIZENZ });
  assert.throws(() => social.resolveVerification(a, a, true), /Nur Moderation/);
  social.resolveVerification(mod, a, true);
  assert.throws(() => social.requestVerification(a, { licenseNumber: LIZENZ }),
    (e) => e.code === 'verify_already');
});

test('ohne Antrag gibt es nichts zu entscheiden', () => {
  const { social, mod, mach } = setup();
  const x = mach('xaver');
  assert.throws(() => social.resolveVerification(mod, x, true), (e) => e.code === 'verify_no_request');
});

// ─────────────────────────────────────────────────────────────────────────────
//  Entziehen
// ─────────────────────────────────────────────────────────────────────────────

test('der Rx-Einblick laesst sich entziehen, OHNE die Verifizierung zurueckzunehmen', () => {
  // Der Hebel, den das Schema verspricht: Eine erloschene Betriebserlaubnis
  // muss sich sperren lassen, ohne die Historie zu verlieren, warum der
  // Betrieb einmal verifiziert war.
  const { social, mod, a } = setup();
  social.requestVerification(a, { licenseNumber: LIZENZ });
  social.resolveVerification(mod, a, true);
  assert.equal(social.myVerification(a).rx_allowed, true);

  const r = social.setRxAllowed(mod, a, false);
  assert.equal(r.rx_allowed, false);
  assert.equal(social.getProfile('anna').verified, true, 'verifiziert bleibt verifiziert');
  assert.equal(social.myVerification(a).rx_allowed, false);

  // Und zurueckgeben laesst er sich auch.
  social.setRxAllowed(mod, a, true);
  assert.equal(social.myVerification(a).rx_allowed, true);
});

test('nur die Moderation darf entziehen', () => {
  const { social, mod, a, mach } = setup();
  const b = mach('ben');
  social.requestVerification(a, { licenseNumber: LIZENZ });
  social.resolveVerification(mod, a, true);
  assert.throws(() => social.setRxAllowed(b, a, false), /Nur Moderation/);
  assert.equal(social.myVerification(a).rx_allowed, true, 'unveraendert');
});

test('ohne Antrag steht „keine" und der Kontotyp dabei', () => {
  const { social, mach } = setup();
  const x = mach('xaver', 'wholesale');
  const v = social.myVerification(x);
  assert.equal(v.status, 'keine');
  // Der Kontotyp gehoert dazu, damit die Oberflaeche weiss, ob sie das
  // Formular ueberhaupt anbieten darf (Privat: nein).
  assert.equal(v.account_type, 'wholesale');
});
