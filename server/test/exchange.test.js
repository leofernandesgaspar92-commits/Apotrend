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

test('match_count: passende offene Gegen-Einträge je Autor:in, sich selbst nicht mitzählen', () => {
  const { exchange, a, b } = setup();
  // A bietet Amoxicillin, noch kein Gesuch -> 0 Matches
  const offer = exchange.create(a, { kind: 'biete', bezeichnung: 'Amoxicillin 1000 mg Filmtabletten' });
  assert.equal(exchange.mine(a).find(e => e.id === offer.id).match_count, 0);
  // B sucht Amoxicillin -> A sieht 1 passendes Gesuch, B sieht 1 passendes Angebot
  exchange.create(b, { kind: 'suche', bezeichnung: 'Amoxicillin dringend gesucht' });
  assert.equal(exchange.mine(a).find(e => e.id === offer.id).match_count, 1);
  assert.equal(exchange.list(b, { kind: 'suche' })[0].match_count, 1);
  // Eigenes zweites Gesuch von A zählt für A NICHT (nur fremde Autor:innen)
  exchange.create(a, { kind: 'suche', bezeichnung: 'Amoxicillin auch hier' });
  assert.equal(exchange.mine(a).find(e => e.id === offer.id).match_count, 1, 'weiterhin nur B');
  // Nicht-übereinstimmender Wirkstoff -> 0
  const other = exchange.create(a, { kind: 'biete', bezeichnung: 'Pantoprazol 40 mg' });
  assert.equal(exchange.mine(a).find(e => e.id === other.id).match_count, 0);
});

test('Verfallsdatum: gültig gespeichert + Rest-Tage berechnet; ungültig abgelehnt; änderbar', () => {
  const { exchange, a } = setup();
  const future = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  const offer = exchange.create(a, { kind: 'biete', bezeichnung: 'Ibuprofen 400 mg', menge: '30 Pkg', ablauf: future });
  assert.equal(offer.ablauf, future);
  assert.ok(offer.days_until_expiry >= 9 && offer.days_until_expiry <= 10, 'Rest-Tage ~10');
  // Ungültiges Kalenderdatum abgelehnt
  assert.throws(() => exchange.create(a, { kind: 'biete', bezeichnung: 'X', ablauf: '2026-02-31' }), /Verfallsdatum/);
  assert.throws(() => exchange.create(a, { kind: 'biete', bezeichnung: 'X', ablauf: '31.12.2026' }), /Verfallsdatum/);
  // Ohne Verfallsdatum -> null
  const noAbl = exchange.create(a, { kind: 'biete', bezeichnung: 'Ohne Datum' });
  assert.equal(noAbl.ablauf, null);
  assert.equal(noAbl.days_until_expiry, null);
  // Änderbar (auch entfernbar)
  const upd = exchange.update(a, offer.id, { ablauf: '' });
  assert.equal(upd.ablauf, null);
});

test('Matching ignoriert Darreichungsform- und Zahl-Wörter (keine Fehltreffer)', () => {
  const { exchange, a, b } = setup();
  // Gemeinsam nur das Formwort „Tabletten" -> KEIN Match
  const aspirin = exchange.create(a, { kind: 'biete', bezeichnung: 'Aspirin Tabletten' });
  exchange.create(b, { kind: 'suche', bezeichnung: 'Metformin Tabletten' });
  assert.equal(exchange.mine(a).find(e => e.id === aspirin.id).match_count, 0, 'nur Formwort teilen -> kein Treffer');
  // Gemeinsam nur die Zahl „1000" -> KEIN Match
  const amoxi = exchange.create(a, { kind: 'biete', bezeichnung: 'Amoxicillin 1000 mg' });
  exchange.create(b, { kind: 'suche', bezeichnung: 'Metformin 1000 mg' });
  assert.equal(exchange.mine(a).find(e => e.id === amoxi.id).match_count, 0, 'nur Zahl teilen -> kein Treffer');
  // Echter Substanz-Match trotz unterschiedlicher Form/Dosis -> Treffer
  exchange.create(b, { kind: 'suche', bezeichnung: 'Amoxicillin 500 mg Filmtabletten' });
  assert.equal(exchange.mine(a).find(e => e.id === amoxi.id).match_count, 1, 'gleiche Substanz -> Treffer');
});

test('Eintrag bearbeiten: nur Ersteller; Felder aktualisiert; neue Bezeichnung löst Matching aus', () => {
  const { exchange, a, b } = setup();
  const e = exchange.create(a, { kind: 'biete', bezeichnung: 'Amoxi 1000', menge: '10', ort: 'Wien' });
  // Fremde dürfen nicht bearbeiten
  assert.throws(() => exchange.update(b, e.id, { menge: '99' }), /Ersteller/);
  // Ersteller aktualisiert Menge/Ort/Notiz
  const u = exchange.update(a, e.id, { menge: '25', ort: 'Graz', note: 'nur Originalware' });
  assert.equal(u.menge, '25');
  assert.equal(u.ort, 'Graz');
  assert.equal(u.note, 'nur Originalware');
  assert.equal(u.bezeichnung, 'Amoxi 1000', 'Bezeichnung unverändert');
  // Leere Bezeichnung abgelehnt
  assert.throws(() => exchange.update(a, e.id, { bezeichnung: '  ' }), /erforderlich|required/i);
  // Bezeichnung auf einen Wirkstoff ändern, zu dem B ein Gesuch hat -> Matching benachrichtigt B
  exchange.create(b, { kind: 'suche', bezeichnung: 'Pantoprazol dringend' });
  const before = exchange.mine(a).find(x => x.id === e.id).match_count;
  const u2 = exchange.update(a, e.id, { bezeichnung: 'Pantoprazol 40 mg' });
  assert.equal(u2.bezeichnung, 'Pantoprazol 40 mg');
  assert.ok(u2.match_count >= 1 && u2.match_count > before, 'neue Bezeichnung findet Gegenstück');
});

test('Biete-Eintrag anlegen: mit Autor-Profil, Status offen', () => {
  const { exchange, a } = setup();
  const e = exchange.create(a, { kind: 'biete', bezeichnung: 'Amoxicillin 1000 mg', menge: '20 Packungen', ort: '1010 Wien' });
  assert.equal(e.kind, 'biete');
  assert.equal(e.status, 'offen');
  assert.equal(e.author.handle, 'anna');
  assert.equal(e.menge, '20 Packungen');
});

test('Kontotyp-Rechte: Privatnutzer:in darf keinen Austausch-Eintrag anlegen; Fachkreis schon', () => {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  const exchange = createExchangeService(createExchangeRepo(), social, repo);
  const pro = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'Pro' }, owner: { name: 'Pro', email: 'pro@a.at', password: 'geheim123' } });
  social.createProfile(pro.user.id, { handle: 'pro_apo', displayName: 'Profi-Apotheke', accountType: 'pharmacy' });
  assert.doesNotThrow(() => exchange.create(pro.user.id, { kind: 'biete', bezeichnung: 'Amoxicillin 1000 mg' }));
  const priv = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'Priv' }, owner: { name: 'Priv', email: 'priv@a.at', password: 'geheim123' } });
  social.createProfile(priv.user.id, { handle: 'privat_x', displayName: 'Privat', accountType: 'private' });
  assert.throws(() => exchange.create(priv.user.id, { kind: 'suche', bezeichnung: 'Ibuprofen 400 mg' }), /Apotheken und Fachkreisen|reserved for pharmacies/);
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

test('Text-Filter (q) findet Einträge nach Präparat', () => {
  const { exchange, a, b } = setup();
  exchange.create(a, { kind: 'biete', bezeichnung: 'Amoxicillin 1000 mg' });
  exchange.create(b, { kind: 'suche', bezeichnung: 'Amoxicillin 500 mg' });
  exchange.create(a, { kind: 'biete', bezeichnung: 'Metformin 850' });
  assert.equal(exchange.list(a, { q: 'amoxicillin' }).length, 2);
  assert.equal(exchange.list(a, { q: 'metformin' }).length, 1);
});

test('Ungültige Art und leere Bezeichnung werden abgelehnt', () => {
  const { exchange, a } = setup();
  assert.throws(() => exchange.create(a, { kind: 'tausch', bezeichnung: 'X' }), /biete.*suche/);
  assert.throws(() => exchange.create(a, { kind: 'biete', bezeichnung: '   ' }), /erforderlich/);
});

test('Aktives Matching: neues Angebot benachrichtigt die passende Suche', () => {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  const exchange = createExchangeService(createExchangeRepo(), social, repo);
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  const B = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'B' }, owner: { name: 'Ben', email: 'b@b.at', password: 'geheim123' } });
  social.createProfile(B.user.id, { handle: 'ben', displayName: 'Ben' });

  exchange.create(A.user.id, { kind: 'suche', bezeichnung: 'Amoxicillin 500 mg' });   // Anna sucht
  exchange.create(B.user.id, { kind: 'biete', bezeichnung: 'Amoxicillin 1000 mg' });    // Ben bietet -> Match

  const n = social.notifications(A.user.id).find(x => x.type === 'exchange_offer');
  assert.ok(n, 'Anna wird über das passende Angebot benachrichtigt');
  assert.equal(n.label, 'Amoxicillin 1000 mg');
  assert.equal(n.actor.handle, 'ben');
  // kein Match bei anderem Wirkstoff
  exchange.create(B.user.id, { kind: 'biete', bezeichnung: 'Metformin 850' });
  assert.equal(social.notifications(A.user.id).filter(x => x.type === 'exchange_offer').length, 1);
});

test('Meine Einträge + Wieder öffnen', () => {
  const { exchange, a } = setup();
  const e = exchange.create(a, { kind: 'biete', bezeichnung: 'Ibuprofen 400' });
  exchange.markResolved(a, e.id);
  // in der offenen Liste weg, in "meine" (alle Status) da
  assert.equal(exchange.list(a).length, 0);
  assert.equal(exchange.mine(a).length, 1);
  assert.equal(exchange.mine(a, { status: 'erledigt' }).length, 1);
  // wieder öffnen -> erscheint wieder in offener Liste
  exchange.reopen(a, e.id);
  assert.equal(exchange.list(a).length, 1);
  assert.equal(exchange.mine(a, { status: 'offen' }).length, 1);
});

test('Bundesland-Filter: nur Einträge aus dem gewählten Bundesland', () => {
  const { exchange, a, b } = setup();
  exchange.create(a, { kind: 'biete', bezeichnung: 'Amoxicillin', bundesland: 'Wien' });
  exchange.create(b, { kind: 'biete', bezeichnung: 'Amoxicillin', bundesland: 'Tirol' });
  assert.equal(exchange.list(a, { bundesland: 'Wien' }).length, 1);
  assert.equal(exchange.list(a, { bundesland: 'Wien' })[0].bundesland, 'Wien');
  assert.equal(exchange.list(a, { bundesland: 'Tirol' }).length, 1);
});

test('Ungültiges Bundesland wird abgelehnt', () => {
  const { exchange, a } = setup();
  assert.throws(() => exchange.create(a, { kind: 'biete', bezeichnung: 'X', bundesland: 'Bayern' }), /Bundesland/);
});

test('Eintrag mit Bild (data:image) ok, Fremd-URL abgelehnt', () => {
  const { exchange, a } = setup();
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const e = exchange.create(a, { kind: 'biete', bezeichnung: 'Amoxicillin 1000 mg', image: PNG });
  assert.equal(e.image, PNG);
  assert.throws(() => exchange.create(a, { kind: 'biete', bezeichnung: 'X', image: 'https://evil/x.png' }), /Bildformat/);
});
