// ============================================================================
//  Fachkreis-Schranke für Rx-Arzneimittel (Jurisdiction-Guard)
// ============================================================================
//  Diese Datei prüft eine SPERRE. Entsprechend prüfen fast alle Tests, dass
//  etwas NICHT sichtbar ist — und die wichtigsten prüfen, dass die Sperre auch
//  dann greift, wenn jemand sie umgehen will.
//
//  DER AUSGANGSBEFUND WAR ECHT: `GET /api/exchange` war angemeldet, aber nicht
//  auf Fachkreise beschränkt; im Code stand ausdrücklich „Privatnutzer:innen
//  können Einträge lesen". Da die Registrierung Selbstbedienung ist, waren
//  Angebote für verschreibungspflichtige Arzneimittel praktisch öffentlich
//  lesbar — in DACH ist Publikumswerbung dafür untersagt (HWG § 10).
//
//  Zwei Lecks, nicht eines: `list()` UND `byAuthor()` (die Profilansicht).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VERIFICATION_STATUS, RX_FACHKREIS_STATUS, istRxFachkreis, istGueltigerStatus,
  verificationStatusFor, rxErlaubt, normalizeRx, istGeschuetzt, rxSichtbar,
  rxGrund, filterRx,
} from '../src/domain/jurisdiction.js';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createExchangeRepo } from '../src/repo/exchangeRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';
import { createExchangeService } from '../src/services/exchange.js';

const fachkreis = (land = 'AT') => ({
  userId: 'u1', jurisdiction: land, verificationStatus: 'VERIFIED_PHARMACY',
});

// ─────────────────────────────────────────────────────────────────────────────
//  Stufen
// ─────────────────────────────────────────────────────────────────────────────

test('die Verifizierungsstufen sind die vereinbarten', () => {
  assert.deepEqual(VERIFICATION_STATUS, [
    'UNVERIFIED', 'PENDING', 'VERIFIED_PHARMACY',
    'VERIFIED_WHOLESALE', 'VERIFIED_MANUFACTURER', 'VERIFIED_LOGISTICS',
  ]);
  for (const s of VERIFICATION_STATUS) assert.equal(istGueltigerStatus(s), true);
  assert.equal(istGueltigerStatus('VERIFIED_IRGENDWAS'), false);
  assert.equal(istGueltigerStatus(''), false);
});

test('LOGISTIK gehoert NICHT zum Rx-Fachkreis', () => {
  // Ein Transportunternehmen befoerdert Arzneimittel, es erwirbt sie nicht.
  // Je mehr Gruppen hineinduerfen, desto weniger ist die Schranke wert.
  assert.deepEqual(RX_FACHKREIS_STATUS, ['VERIFIED_PHARMACY', 'VERIFIED_WHOLESALE', 'VERIFIED_MANUFACTURER']);
  assert.equal(istRxFachkreis('VERIFIED_LOGISTICS'), false);
  assert.equal(istRxFachkreis('VERIFIED_PHARMACY'), true);
  assert.equal(istRxFachkreis('PENDING'), false);
  assert.equal(istRxFachkreis('UNVERIFIED'), false);
});

test('die Stufe wird aus Kontotyp UND bestaetigter Verifizierung abgeleitet', () => {
  assert.equal(verificationStatusFor({ accountType: 'pharmacy', verified: true }), 'VERIFIED_PHARMACY');
  assert.equal(verificationStatusFor({ accountType: 'wholesale', verified: true }), 'VERIFIED_WHOLESALE');
  assert.equal(verificationStatusFor({ accountType: 'pharma', verified: true }), 'VERIFIED_MANUFACTURER');
  assert.equal(verificationStatusFor({ accountType: 'logistics', verified: true }), 'VERIFIED_LOGISTICS');
  // DER KERN: Der Kontotyp allein genuegt nicht. Ihn waehlt man bei der
  // Registrierung selbst — eine Schranke, die nur darauf prueft, ist mit
  // einem Klick im Anmeldeformular umgangen.
  assert.equal(verificationStatusFor({ accountType: 'pharmacy', verified: false }), 'UNVERIFIED');
  assert.equal(verificationStatusFor({ accountType: 'pharmacy', verified: false, verificationPending: true }), 'PENDING');
  // Behoerde und Privat bekommen keine Rx-Stufe: Sie handeln nicht mit
  // Arzneimitteln.
  assert.equal(verificationStatusFor({ accountType: 'authority', verified: true }), 'UNVERIFIED');
  assert.equal(verificationStatusFor({ accountType: 'private', verified: true }), 'UNVERIFIED');
});

test('rxErlaubt verlangt Fachkreis UND Land UND keinen Entzug', () => {
  assert.equal(rxErlaubt(fachkreis()), true);
  assert.equal(rxErlaubt({ ...fachkreis(), verificationStatus: 'UNVERIFIED' }), false);
  assert.equal(rxErlaubt({ ...fachkreis(), jurisdiction: '' }), false);
  assert.equal(rxErlaubt({ ...fachkreis(), jurisdiction: 'OESTERREICH' }), false);
  // Der Hebel fuer die Moderation: Ein Betrieb, dessen Erlaubnis erloschen
  // ist, laesst sich sperren, ohne die Verifizierung zurueckzunehmen.
  assert.equal(rxErlaubt({ ...fachkreis(), isRxAllowed: false }), false);
  assert.equal(rxErlaubt({ ...fachkreis(), isRxAllowed: undefined }), true, 'kein Entzug = erlaubt');
  assert.equal(rxErlaubt(null), false);
});

// ─────────────────────────────────────────────────────────────────────────────
//  Fail closed
// ─────────────────────────────────────────────────────────────────────────────

test('nur ein AUSDRUECKLICHES „otc" macht ein Angebot oeffentlich', () => {
  assert.equal(normalizeRx('otc'), false);
  assert.equal(normalizeRx(false), false);
  assert.equal(normalizeRx('rx'), true);
  assert.equal(normalizeRx(true), true);
  // ALLES andere bleibt geschuetzt — ein Tippfehler im Formular darf kein
  // Rx-Angebot oeffentlich machen.
  for (const w of [null, undefined, '', 'OTC ', 'ja', 'nein', 0, 1, {}, 'unbestimmt', 'verschreibungsfrei']) {
    assert.notEqual(normalizeRx(w), false, `"${String(w)}" haette nicht freigeben duerfen`);
  }
});

test('geschuetzt ist alles, was nicht ausdruecklich OTC ist', () => {
  assert.equal(istGeschuetzt({ rx: true }), true);
  assert.equal(istGeschuetzt({ rx: null }), true, 'unbestimmt gilt als Rx');
  assert.equal(istGeschuetzt({}), true, 'ohne Angabe gilt als Rx');
  assert.equal(istGeschuetzt({ rx: false }), false);
  assert.equal(istGeschuetzt({ rx: 'otc' }), false);
});

test('ein OTC-Angebot sieht jeder, ein Rx-Angebot nur der Fachkreis', () => {
  const otc = { id: '1', rx: false, country: 'AT', author_user_id: 'x' };
  const rx = { id: '2', rx: true, country: 'AT', author_user_id: 'x' };
  assert.equal(rxSichtbar(otc, null), true, 'OTC auch ohne Anmeldung');
  assert.equal(rxSichtbar(otc, { userId: 'p', verificationStatus: 'UNVERIFIED' }), true);
  assert.equal(rxSichtbar(rx, null), false);
  assert.equal(rxSichtbar(rx, { userId: 'p', jurisdiction: 'AT', verificationStatus: 'UNVERIFIED' }), false);
  assert.equal(rxSichtbar(rx, { ...fachkreis('AT'), userId: 'p' }), true);
});

test('ein selbst eingestelltes Angebot sieht man immer', () => {
  // Sonst koennte jemand sein eigenes Rx-Angebot einstellen und es
  // anschliessend nicht mehr finden — ein Fehlerbild, das wie Datenverlust
  // aussieht.
  const rx = { id: '2', rx: true, country: 'AT', author_user_id: 'ich' };
  assert.equal(rxSichtbar(rx, { userId: 'ich', verificationStatus: 'UNVERIFIED' }), true);
});

test('Rx bleibt in der eigenen Rechtsordnung', () => {
  const rx = { id: '2', rx: true, country: 'DE', author_user_id: 'x' };
  assert.equal(rxSichtbar(rx, fachkreis('DE')), true);
  assert.equal(rxSichtbar(rx, fachkreis('AT')), false, 'andere Jurisdiktion');
  // Ohne Land am Eintrag bleibt er geschuetzt — ein Angebot ohne Rechtsraum
  // ist keines, dessen Zulaessigkeit sich pruefen laesst.
  assert.equal(rxSichtbar({ id: '3', rx: true, author_user_id: 'x' }, fachkreis('AT')), false);
});

test('der Grund wird benannt, damit die Oberflaeche nicht „hier ist nichts" sagt', () => {
  assert.equal(rxGrund(null), 'anmeldung');
  assert.equal(rxGrund({ userId: 'p', verificationStatus: 'UNVERIFIED' }), 'unverifiziert');
  assert.equal(rxGrund({ userId: 'p', verificationStatus: 'PENDING' }), 'pruefung');
  assert.equal(rxGrund({ userId: 'p', verificationStatus: 'VERIFIED_PHARMACY', isRxAllowed: false }), 'entzogen');
  assert.equal(rxGrund({ userId: 'p', verificationStatus: 'VERIFIED_PHARMACY', jurisdiction: '' }), 'kein_land');
  assert.equal(rxGrund(fachkreis('AT')), 'anderes_land');
});

test('filterRx zaehlt, was es verbirgt', () => {
  const liste = [
    { id: '1', rx: false, country: 'AT', author_user_id: 'x' },
    { id: '2', rx: true, country: 'AT', author_user_id: 'x' },
    { id: '3', rx: null, country: 'AT', author_user_id: 'x' },
  ];
  const r = filterRx(liste, { userId: 'p', jurisdiction: 'AT', verificationStatus: 'UNVERIFIED' });
  assert.deepEqual(r.eintraege.map((e) => e.id), ['1']);
  // Die Zahl ist der Punkt: Nur mit ihr kann die Oberflaeche „2 Angebote nur
  // fuer verifizierte Fachkreise" sagen.
  assert.equal(r.verborgen, 2);
  assert.equal(r.grund, 'unverifiziert');
  // Nichts verborgen -> kein Grund (sonst stuende dort eine Erklaerung fuer
  // etwas, das nicht passiert ist).
  const alles = filterRx(liste, fachkreis('AT'));
  assert.equal(alles.verborgen, 0);
  assert.equal(alles.grund, null);
  assert.deepEqual(filterRx(null, null), { eintraege: [], verborgen: 0, grund: null });
});

// ─────────────────────────────────────────────────────────────────────────────
//  Im echten Dienst
// ─────────────────────────────────────────────────────────────────────────────

function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const socialRepo = createSocialRepo();
  const social = createSocialService(socialRepo, repo);
  const exchange = createExchangeService(createExchangeRepo(), social, repo);
  const mach = (name, handle, email, { verifiziert = false, accountType = null, land = null } = {}) => {
    const r = orgAuth.registerPharmacyWithOwner({ pharmacy: { name }, owner: { name, email, password: 'geheim123' } });
    social.createProfile(r.user.id, { handle, displayName: name });
    if (accountType) social.updateProfile(r.user.id, { accountType });
    if (land) social.updateProfile(r.user.id, { country: land });
    if (verifiziert) socialRepo.setProfileVerified(r.user.id, true);
    return r.user.id;
  };
  return { exchange, social, socialRepo, mach };
}

test('eine unverifizierte Apotheke sieht fremde Rx-Angebote NICHT', () => {
  const { exchange, mach } = setup();
  const anbieter = mach('A', 'anna', 'a@a.at', { verifiziert: true });
  const leser = mach('B', 'ben', 'b@b.at', { verifiziert: false });
  exchange.create(anbieter, { kind: 'biete', bezeichnung: 'Amoxicillin 1000 mg' });

  const r = exchange.list(leser);
  assert.deepEqual(r.eintraege, []);
  assert.equal(r.verborgen, 1);
  assert.equal(r.grund, 'unverifiziert');
});

test('eine verifizierte Apotheke im selben Land sieht sie', () => {
  const { exchange, mach } = setup();
  const anbieter = mach('A', 'anna', 'a@a.at', { verifiziert: true });
  const leser = mach('B', 'ben', 'b@b.at', { verifiziert: true });
  exchange.create(anbieter, { kind: 'biete', bezeichnung: 'Amoxicillin 1000 mg' });
  const r = exchange.list(leser);
  assert.equal(r.eintraege.length, 1);
  assert.equal(r.verborgen, 0);
});

test('ein als OTC gekennzeichnetes Angebot sieht auch die unverifizierte Apotheke', () => {
  const { exchange, mach } = setup();
  const anbieter = mach('A', 'anna', 'a@a.at', { verifiziert: true });
  const leser = mach('B', 'ben', 'b@b.at', { verifiziert: false });
  exchange.create(anbieter, { kind: 'biete', bezeichnung: 'Vitamin D3 Tropfen', rx: 'otc' });
  const r = exchange.list(leser);
  assert.equal(r.eintraege.length, 1);
  assert.equal(r.eintraege[0].rx, false);
  assert.equal(r.verborgen, 0);
});

test('ohne Kennzeichnung ist ein neues Angebot geschuetzt', () => {
  const { exchange, mach } = setup();
  const anbieter = mach('A', 'anna', 'a@a.at', { verifiziert: true });
  const leser = mach('B', 'ben', 'b@b.at', { verifiziert: false });
  // Genau der Normalfall: Niemand kreuzt etwas an. FAIL CLOSED.
  const e = exchange.create(anbieter, { kind: 'biete', bezeichnung: 'Irgendein Praeparat' });
  assert.equal(e.rx, null, 'unbestimmt gespeichert, nicht geraten');
  assert.equal(exchange.list(leser).eintraege.length, 0);
});

test('eine Privatnutzerin sieht gar kein Rx — auch nicht verifiziert', () => {
  const { exchange, mach } = setup();
  const anbieter = mach('A', 'anna', 'a@a.at', { verifiziert: true });
  const privat = mach('P', 'paul', 'p@p.at', { verifiziert: true, accountType: 'private' });
  exchange.create(anbieter, { kind: 'biete', bezeichnung: 'Amoxicillin 1000 mg' });
  assert.deepEqual(exchange.list(privat).eintraege, []);
});

test('ein verifizierter Logistiker sieht kein Rx', () => {
  const { exchange, mach } = setup();
  const anbieter = mach('A', 'anna', 'a@a.at', { verifiziert: true });
  const spedition = mach('L', 'lea', 'l@l.at', { verifiziert: true, accountType: 'logistics' });
  exchange.create(anbieter, { kind: 'biete', bezeichnung: 'Amoxicillin 1000 mg' });
  assert.deepEqual(exchange.list(spedition).eintraege, []);
});

test('ein verifizierter Grosshaendler sieht Rx', () => {
  const { exchange, mach } = setup();
  const anbieter = mach('A', 'anna', 'a@a.at', { verifiziert: true });
  const gh = mach('G', 'gerd', 'g@g.at', { verifiziert: true, accountType: 'wholesale' });
  exchange.create(anbieter, { kind: 'biete', bezeichnung: 'Amoxicillin 1000 mg' });
  assert.equal(exchange.list(gh).eintraege.length, 1);
});

test('die eigenen Eintraege bleiben in „Meine Eintraege" sichtbar', () => {
  const { exchange, mach } = setup();
  const anbieter = mach('A', 'anna', 'a@a.at', { verifiziert: false });
  const e = exchange.create(anbieter, { kind: 'biete', bezeichnung: 'Amoxicillin 1000 mg' });
  // Unverifiziert, eigenes Rx-Angebot: Es MUSS auffindbar bleiben.
  assert.ok(exchange.mine(anbieter).some((x) => x.id === e.id));
  assert.equal(exchange.list(anbieter).eintraege.length, 1, 'auch in der Liste das eigene');
});

test('das Land eines Angebots kommt aus dem PROFIL, nicht aus der Anfrage', () => {
  // Sonst waere der Rechtsraum eine Anzeigeoption statt der Grundlage dafuer,
  // ob der Handel ueberhaupt zulaessig ist — und die Jurisdiktions-Pruefung
  // der Schranke liesse sich von der einstellenden Seite aus umgehen.
  const { exchange, social, mach } = setup();
  const anbieter = mach('A', 'anna', 'a@a.at', { verifiziert: true, land: 'DE' });
  const e = exchange.create(anbieter, { kind: 'biete', bezeichnung: 'Amoxicillin', country: 'AT' });
  assert.equal(e.country, 'DE', 'das Profil-Land gewinnt');
  assert.equal(social.getProfile(anbieter).country, 'DE');
});

test('ein Fachkreis im ANDEREN Land sieht das Angebot nicht', () => {
  const { exchange, mach } = setup();
  const de = mach('A', 'anna', 'a@a.at', { verifiziert: true, land: 'DE' });
  const at = mach('B', 'ben', 'b@b.at', { verifiziert: true, land: 'AT' });
  exchange.create(de, { kind: 'biete', bezeichnung: 'Amoxicillin 1000 mg' });
  const r = exchange.list(at);
  assert.deepEqual(r.eintraege, []);
  assert.equal(r.grund, 'anderes_land');
});
