// ============================================================================
//  Rechtsraum: B2B-Angebote und Aktionen bleiben im eigenen Land
// ============================================================================
//  Bis hierher sah eine Wiener Apotheke Angebote aus Brasilien. Bei
//  Arzneimitteln ist das nicht bloß Rauschen: Handel über Grenzen hinweg ist
//  genehmigungspflichtig (AMG §48, Einfuhrlizenzen je Land, siehe
//  docs/LEGAL_COUNTRY_MATRIX.md). Ein Angebot, das man gar nicht annehmen darf,
//  gehört nicht in die Liste.
//
//  Der zweite Punkt dieser Datei ist ebenso wichtig: Das Land kommt aus dem
//  PROFIL, nie aus der Anfrage. Sonst könnte jemand ein Angebot unter fremder
//  Rechtsordnung einstellen und die Regeln der eigenen umgehen.
// ============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createExchangeRepo } from '../src/repo/exchangeRepo.js';
import { createRabatteRepo } from '../src/repo/rabatteRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';
import { createExchangeService } from '../src/services/exchange.js';
import { createDealsService } from '../src/services/deals.js';

function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  const exchange = createExchangeService(createExchangeRepo(), social, repo);

  const anlegen = (name, email, handle, country) => {
    const r = orgAuth.registerPharmacyWithOwner({
      pharmacy: { name }, owner: { name, email, password: 'geheim123' },
    });
    social.createProfile(r.user.id, { handle, displayName: name, country, accountType: 'pharmacy' });
    return r.user.id;
  };

  return {
    exchange, social,
    at: anlegen('Wien Apotheke', 'wien@a.at', 'wien', 'AT'),
    de: anlegen('Berlin Apotheke', 'berlin@a.de', 'berlin', 'DE'),
    br: anlegen('Farmacia SP', 'sp@a.br', 'saopaulo', 'BR'),
  };
}

// ── Tauschbörse ─────────────────────────────────────────────────────────────

test('ein Angebot ist nur im eigenen Rechtsraum sichtbar', () => {
  const { exchange, at, de, br } = setup();
  exchange.create(at, { kind: 'biete', bezeichnung: 'Pantoprazol 40 mg' });
  exchange.create(br, { kind: 'biete', bezeichnung: 'Pantoprazol 40 mg do Brasil' });

  const inAT = exchange.list(de, { country: 'AT' }).map((e) => e.bezeichnung);
  const inBR = exchange.list(de, { country: 'BR' }).map((e) => e.bezeichnung);

  assert.deepEqual(inAT, ['Pantoprazol 40 mg']);
  assert.deepEqual(inBR, ['Pantoprazol 40 mg do Brasil']);
  // Ohne Filter weiterhin alles — die Einschränkung passiert bewusst in der
  // Route, nicht im Service, damit interne Aufrufe (Matchmaking) alles sehen.
  assert.equal(exchange.list(de, {}).length, 2);
});

test('das Land kommt aus dem Profil, nicht aus der Eingabe', () => {
  const { exchange, at } = setup();
  // Der Versuch, ein Angebot brasilianischem Recht zuzuschreiben, verpufft.
  const e = exchange.create(at, { kind: 'biete', bezeichnung: 'X', country: 'BR' });
  assert.equal(e.country, 'AT', 'das Profil-Land gewinnt gegen die Eingabe');
  const sichtbar = exchange.list(at, { country: 'AT' });
  assert.equal(sichtbar.length, 1, 'der Eintrag gehört nach AT, nicht nach BR');
  assert.equal(exchange.list(at, { country: 'BR' }).length, 0);
});

test('Altbestand ohne Land wird aus dem Profil abgeleitet, statt zu verschwinden', () => {
  // Sonst leerte sich die gesamte bestehende Börse in dem Moment, in dem der
  // Filter eingeschaltet wird — und niemand wüsste, warum.
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  const exRepo = createExchangeRepo();
  const exchange = createExchangeService(exRepo, social, repo);
  const r = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'Alt' }, owner: { name: 'Alt', email: 'alt@a.at', password: 'geheim123' } });
  social.createProfile(r.user.id, { handle: 'alt', displayName: 'Alt', country: 'AT', accountType: 'pharmacy' });

  // Zeile wie aus einem alten Snapshot: ohne country-Feld.
  exRepo.create({ kind: 'biete', authorUserId: r.user.id, bezeichnung: 'Altbestand' });

  assert.equal(exchange.list(r.user.id, { country: 'AT' }).length, 1);
  assert.equal(exchange.list(r.user.id, { country: 'DE' }).length, 0);
});

test('die Freitext-Suche findet den Wirkstoff auch in der Notiz', () => {
  // Bei Börsen-Einträgen steht der INN oft nur in der Notiz. Eine Suche, die
  // ihn dort nicht findet, wirkt für die Nutzerin schlicht kaputt.
  const { exchange, at } = setup();
  exchange.create(at, { kind: 'biete', bezeichnung: 'Pantozol 40 mg', note: 'INN: Pantoprazol, 3 Packungen' });

  assert.equal(exchange.list(at, { q: 'Pantoprazol' }).length, 1, 'Wirkstoff aus der Notiz');
  assert.equal(exchange.list(at, { q: 'Pantozol' }).length, 1, 'Handelsname');
  assert.equal(exchange.list(at, { q: 'Ibuprofen' }).length, 0);
});

test('mehrere Suchwörter müssen ALLE vorkommen, Reihenfolge egal', () => {
  // Bei ODER würde „pantoprazol 40" jede Zeile mit irgendeiner 40 liefern.
  const { exchange, at } = setup();
  exchange.create(at, { kind: 'biete', bezeichnung: 'Pantoprazol 40 mg' });
  exchange.create(at, { kind: 'biete', bezeichnung: 'Ibuprofen 40 Stück' });

  assert.equal(exchange.list(at, { q: 'pantoprazol 40' }).length, 1);
  assert.equal(exchange.list(at, { q: '40 pantoprazol' }).length, 1, 'Reihenfolge darf egal sein');
  assert.equal(exchange.list(at, { q: '40' }).length, 2);
  assert.equal(exchange.list(at, { q: 'pantoprazol ibuprofen' }).length, 0);
});

// ── Aktionen/Rabatte ────────────────────────────────────────────────────────

test('Aktionen werden nach Rechtsraum gefiltert', () => {
  const rabatteRepo = createRabatteRepo({ seed: false, today: '2026-08-01' });
  rabatteRepo.upsert({ bezeichnung: 'A-AT', wirkstoff: 'Pantoprazol', supplier: 'S', listenpreis: 5, aktionspreis: 4, gueltig_bis: '2026-12-31', country: 'AT' });
  rabatteRepo.upsert({ bezeichnung: 'A-BR', wirkstoff: 'Pantoprazol', supplier: 'S', listenpreis: 5, aktionspreis: 3, gueltig_bis: '2026-12-31', country: 'BR' });

  assert.deepEqual(rabatteRepo.listTop10({ country: 'AT' }).map((r) => r.bezeichnung), ['A-AT']);
  assert.deepEqual(rabatteRepo.listTop10({ country: 'BR' }).map((r) => r.bezeichnung), ['A-BR']);
});

test('Aktionen OHNE Land bleiben sichtbar, statt geraten zu werden', () => {
  // Kuratierte Referenzdaten tragen kein Land. Sie einem zuzuordnen wäre
  // geraten; sie zu verstecken leerte beim Einschalten die halbe Ansicht.
  const rabatteRepo = createRabatteRepo({ seed: false, today: '2026-08-01' });
  rabatteRepo.upsert({ bezeichnung: 'Ohne Land', wirkstoff: 'X', supplier: 'S', listenpreis: 5, aktionspreis: 4, gueltig_bis: '2026-12-31' });
  assert.equal(rabatteRepo.listTop10({ country: 'AT' }).length, 1);
  assert.equal(rabatteRepo.listTop10({ country: 'KE' }).length, 1);
});

test('die Aktions-Suche greift auf Wirkstoff (INN) und Handelsname zu', () => {
  const rabatteRepo = createRabatteRepo({ seed: false, today: '2026-08-01' });
  rabatteRepo.upsert({ bezeichnung: 'Pantozol 40 mg', wirkstoff: 'Pantoprazol', supplier: 'Kwizda', listenpreis: 5, aktionspreis: 4, gueltig_bis: '2026-12-31' });
  rabatteRepo.upsert({ bezeichnung: 'Nurofen', wirkstoff: 'Ibuprofen', supplier: 'Herba', listenpreis: 3, aktionspreis: 2, gueltig_bis: '2026-12-31' });

  assert.deepEqual(rabatteRepo.listTop10({ q: 'pantoprazol' }).map((r) => r.bezeichnung), ['Pantozol 40 mg']);
  assert.deepEqual(rabatteRepo.listTop10({ q: 'nurofen' }).map((r) => r.bezeichnung), ['Nurofen']);
  assert.deepEqual(rabatteRepo.listTop10({ q: 'kwizda' }).map((r) => r.bezeichnung), ['Pantozol 40 mg']);
  assert.equal(rabatteRepo.listTop10({ q: 'gibtsnicht' }).length, 0);
});

test('eine selbst eingetragene Aktion bekommt das Land des eigenen Betriebs', () => {
  // Rabattwerbung für Arzneimittel ist länderabhängig reguliert. Dürfte man
  // sein Land selbst angeben, ließen sich die Regeln des eigenen umgehen.
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  const rabatteRepo = createRabatteRepo({ seed: false, today: '2026-08-01' });
  const r = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'P' }, owner: { name: 'P', email: 'p@a.de', password: 'geheim123' } });
  social.createProfile(r.user.id, { handle: 'pharma', displayName: 'P', country: 'DE', accountType: 'pharmacy' });

  const deals = createDealsService({
    rabatteRepo, social,
    accountTypeOf: () => 'pharmacy',
    today: '2026-08-01',
  });
  const angelegt = deals.create(r.user.id, {
    bezeichnung: 'Aktion', supplier: 'Wir', listenpreis: 10, aktionspreis: 8,
    gueltig_bis: '2026-10-01', country: 'BR', // Wunschdenken
  });

  assert.equal(angelegt.country, 'DE', 'das Profil-Land gewinnt gegen die Eingabe');
  assert.equal(rabatteRepo.listTop10({ country: 'BR' }).length, 0);
  assert.equal(rabatteRepo.listTop10({ country: 'DE' }).length, 1);
});
