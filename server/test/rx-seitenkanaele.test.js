// ============================================================================
//  Fachkreis-Schranke: die Seitenkanäle des Matchings
// ============================================================================
//  `list()` und `byAuthor()` filtern Rx-Einträge für Unbefugte heraus. Das
//  Matching lief daran vorbei, auf drei Wegen:
//
//   A. `exchange_offer` / `exchange_want`: Wer ein passendes Gesuch hatte,
//      bekam den NAMEN des Rx-Angebots in die Benachrichtigung — verifiziert
//      oder nicht.
//   B. `watch_offer`: Wer den Wirkstoff beobachtete, erfuhr, DASS und VON WEM
//      ein Rx-Präparat angeboten wird (mit Verweis auf den Eintrag).
//   C. `match_count`: Am eigenen Gesuch stand „3 passende Angebote" — ein
//      Klick, und die Liste war leer. Die Zahl zählte, was die Liste verbarg.
//
//  Eine Benachrichtigung ist eine Anzeige. Was die Liste nicht zeigen darf,
//  darf auch keine Glocke melden.
// ============================================================================

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
  const socialRepo = createSocialRepo();
  const social = createSocialService(socialRepo, repo);
  const shortagesRepo = createShortagesRepo({ seed: false });
  const exchange = createExchangeService(createExchangeRepo(), social, repo, shortagesRepo);

  const anlegen = (name, handle, country, { verifiziert }) => {
    const r = orgAuth.registerPharmacyWithOwner({
      pharmacy: { name }, owner: { name, email: handle + '@a.at', password: 'geheim123' },
    });
    social.createProfile(r.user.id, { handle, displayName: name, country, accountType: 'pharmacy' });
    if (verifiziert) socialRepo.setProfileVerified(r.user.id, true);
    return r.user.id;
  };

  return {
    social, exchange, shortagesRepo,
    bieter: anlegen('Bieter AT', 'bieter', 'AT', { verifiziert: true }),
    befugt: anlegen('Befugt AT', 'befugt', 'AT', { verifiziert: true }),
    unbefugt: anlegen('Unbefugt AT', 'unbefugt', 'AT', { verifiziert: false }),
    ausland: anlegen('Befugt DE', 'ausland', 'DE', { verifiziert: true }),
  };
}

const glocke = (social, userId, type) => social.notifications(userId).filter((n) => n.type === type);

// ── A. exchange_offer / exchange_want ──────────────────────────────────────

test('A: Rx-Angebot meldet sich NICHT bei einem unverifizierten Gesuch', () => {
  const s = setup();
  s.exchange.create(s.unbefugt, { kind: 'suche', bezeichnung: 'Semaglutid Pen', rx: 'rx' });
  s.exchange.create(s.bieter, { kind: 'biete', bezeichnung: 'Semaglutid Pen 1 mg', rx: 'rx' });
  assert.equal(glocke(s.social, s.unbefugt, 'exchange_offer').length, 0,
    'der Name des Rx-Angebots ging an ein unverifiziertes Konto');
});

test('A: Rx-Angebot meldet sich weiter bei einem verifizierten Gesuch im selben Land', () => {
  // Die Gegenseite der Schranke: Sie darf das Matching nicht für alle abstellen.
  const s = setup();
  s.exchange.create(s.befugt, { kind: 'suche', bezeichnung: 'Semaglutid Pen', rx: 'rx' });
  s.exchange.create(s.bieter, { kind: 'biete', bezeichnung: 'Semaglutid Pen 1 mg', rx: 'rx' });
  assert.equal(glocke(s.social, s.befugt, 'exchange_offer').length, 1);
});

test('A: Rx-Angebot meldet sich NICHT über die Landesgrenze', () => {
  // Rx-Erwerbsberechtigung gilt je Land (domain/jurisdiction.js) — auch für
  // verifizierte Betriebe.
  const s = setup();
  s.exchange.create(s.ausland, { kind: 'suche', bezeichnung: 'Semaglutid Pen', rx: 'rx' });
  s.exchange.create(s.bieter, { kind: 'biete', bezeichnung: 'Semaglutid Pen 1 mg', rx: 'rx' });
  assert.equal(glocke(s.social, s.ausland, 'exchange_offer').length, 0);
});

test('A: ein Rx-GESUCH meldet sich nicht bei unverifizierten Anbietern', () => {
  // Auch ein Gesuch ist ein Rx-Eintrag hinter der Schranke.
  const s = setup();
  s.exchange.create(s.unbefugt, { kind: 'biete', bezeichnung: 'Semaglutid Pen 1 mg', rx: 'otc' });
  s.exchange.create(s.bieter, { kind: 'suche', bezeichnung: 'Semaglutid Pen', rx: 'rx' });
  assert.equal(glocke(s.social, s.unbefugt, 'exchange_want').length, 0);
});

test('A: OTC-Angebote melden sich weiter bei allen', () => {
  const s = setup();
  s.exchange.create(s.unbefugt, { kind: 'suche', bezeichnung: 'Ibuprofen Saft', rx: 'otc' });
  s.exchange.create(s.bieter, { kind: 'biete', bezeichnung: 'Ibuprofen Saft 100 ml', rx: 'otc' });
  assert.equal(glocke(s.social, s.unbefugt, 'exchange_offer').length, 1);
});

test('A: ohne Rx-Angabe gilt der Eintrag als geschützt (fail closed)', () => {
  const s = setup();
  s.exchange.create(s.unbefugt, { kind: 'suche', bezeichnung: 'Semaglutid Pen', rx: 'otc' });
  s.exchange.create(s.bieter, { kind: 'biete', bezeichnung: 'Semaglutid Pen 1 mg' });
  assert.equal(glocke(s.social, s.unbefugt, 'exchange_offer').length, 0);
});

// ── B. watch_offer ─────────────────────────────────────────────────────────

test('B: Beobachtung meldet ein Rx-Angebot NICHT an Unverifizierte', () => {
  const s = setup();
  s.shortagesRepo.addWatch(s.unbefugt, 'Semaglutid');
  s.exchange.create(s.bieter, { kind: 'biete', bezeichnung: 'Semaglutid Pen 1 mg', rx: 'rx' });
  assert.equal(glocke(s.social, s.unbefugt, 'watch_offer').length, 0,
    'ein unverifiziertes Konto erfuhr, dass und von wem ein Rx-Präparat angeboten wird');
});

test('B: Beobachtung meldet ein Rx-Angebot weiter an Verifizierte im selben Land', () => {
  const s = setup();
  s.shortagesRepo.addWatch(s.befugt, 'Semaglutid');
  s.exchange.create(s.bieter, { kind: 'biete', bezeichnung: 'Semaglutid Pen 1 mg', rx: 'rx' });
  assert.equal(glocke(s.social, s.befugt, 'watch_offer').length, 1);
});

test('B: Beobachtung meldet OTC weiter an alle', () => {
  const s = setup();
  s.shortagesRepo.addWatch(s.unbefugt, 'Ibuprofen');
  s.exchange.create(s.bieter, { kind: 'biete', bezeichnung: 'Ibuprofen Saft 100 ml', rx: 'otc' });
  assert.equal(glocke(s.social, s.unbefugt, 'watch_offer').length, 1);
});

// ── C. match_count ─────────────────────────────────────────────────────────

test('C: match_count zählt nur, was die Betrachterin auch sehen darf', () => {
  const s = setup();
  s.exchange.create(s.unbefugt, { kind: 'suche', bezeichnung: 'Semaglutid Pen', rx: 'otc' });
  s.exchange.create(s.bieter, { kind: 'biete', bezeichnung: 'Semaglutid Pen 1 mg', rx: 'rx' });

  const eigenes = s.exchange.mine(s.unbefugt)[0];
  const sichtbar = s.exchange.list(s.unbefugt, { kind: 'biete', q: 'semaglutid' }).eintraege.length;
  assert.equal(sichtbar, 0, 'Vorbedingung: das Rx-Angebot ist für sie verborgen');
  assert.equal(eigenes.match_count, 0,
    `„${eigenes.match_count} passende Angebote" am Gesuch, aber die Liste zeigt ${sichtbar} — die Zahl verrät, was die Liste verbirgt`);
});

test('C: match_count zählt für Befugte weiter', () => {
  const s = setup();
  s.exchange.create(s.befugt, { kind: 'suche', bezeichnung: 'Semaglutid Pen', rx: 'rx' });
  s.exchange.create(s.bieter, { kind: 'biete', bezeichnung: 'Semaglutid Pen 1 mg', rx: 'rx' });
  assert.equal(s.exchange.mine(s.befugt)[0].match_count, 1);
});

test('C: die Zahl in der öffentlichen Liste folgt der Betrachterin, nicht der Autorin', () => {
  // Ein OTC-Gesuch des Unbefugten, angesehen von einer Befugten: SIE sieht das
  // Rx-Gegenstück, also zählt es für sie. Für ihn selbst nicht.
  const s = setup();
  s.exchange.create(s.unbefugt, { kind: 'suche', bezeichnung: 'Semaglutid Pen', rx: 'otc' });
  s.exchange.create(s.bieter, { kind: 'biete', bezeichnung: 'Semaglutid Pen 1 mg', rx: 'rx' });
  const fuerBefugt = s.exchange.list(s.befugt, { kind: 'suche' }).eintraege.find((e) => e.author_user_id === s.unbefugt);
  const fuerIhn = s.exchange.list(s.unbefugt, { kind: 'suche' }).eintraege.find((e) => e.author_user_id === s.unbefugt);
  assert.equal(fuerBefugt.match_count, 1);
  assert.equal(fuerIhn.match_count, 0);
});

// ── Die anderen Auslöser des Matchings ─────────────────────────────────────

test('A: auch Umbenennen und Wiederöffnen melden kein Rx-Angebot an Unbefugte', () => {
  // `notifyMatches` läuft auch bei `update` (neue Bezeichnung) und `reopen`.
  // Die Schranke sitzt deshalb IN notifyMatches, nicht in `create` — sonst
  // wäre Umbenennen ein Weg um sie herum.
  const s = setup();
  s.exchange.create(s.unbefugt, { kind: 'suche', bezeichnung: 'Semaglutid Pen', rx: 'otc' });
  const e = s.exchange.create(s.bieter, { kind: 'biete', bezeichnung: 'Platzhalter', rx: 'rx' });
  s.exchange.update(s.bieter, e.id, { bezeichnung: 'Semaglutid Pen 1 mg' });
  s.exchange.markResolved(s.bieter, e.id);
  s.exchange.reopen(s.bieter, e.id);
  assert.equal(glocke(s.social, s.unbefugt, 'exchange_offer').length, 0);
});
