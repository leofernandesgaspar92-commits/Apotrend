import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';

function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const srepo = createSocialRepo();
  const social = createSocialService(srepo, repo);
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  const B = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'B' }, owner: { name: 'Ben', email: 'b@b.at', password: 'geheim123' } });
  social.createProfile(B.user.id, { handle: 'ben', displayName: 'Ben' });
  return { srepo, social, a: A.user.id, b: B.user.id };
}

test('Einkaufsliste: hinzufügen, Summe, Menge ändern, entfernen, leeren', () => {
  const { social, a } = setup();
  const it = social.addToCart(a, { bezeichnung: 'Amoxi 1000', wirkstoff: 'Amoxicillin', supplier: 'GH Nord', aktionspreis: 4.5, rabattPct: 20, gueltigBis: '2026-12-31', menge: 10, sourceKind: 'rabatt' });
  assert.equal(it.bezeichnung, 'Amoxi 1000');
  assert.equal(it.menge, 10);
  let c = social.cart(a);
  assert.equal(c.count, 1);
  assert.equal(c.total_positions, 10);
  assert.equal(c.total_price, 45); // 4.5 * 10
  // Menge ändern
  social.updateCartItem(a, it.id, { menge: 3 });
  c = social.cart(a);
  assert.equal(c.total_positions, 3);
  assert.equal(c.total_price, 13.5);
  // Ungültige Menge -> mind. 1
  social.updateCartItem(a, it.id, { menge: 0 });
  assert.equal(social.cart(a).items[0].menge, 1);
  // Entfernen
  social.removeCartItem(a, it.id);
  assert.equal(social.cart(a).count, 0);
});

test('Bestellung: erwartetes Lieferdatum setzen/entfernen; fremde Order gesperrt', () => {
  const { social, a, b } = setup();
  social.addToCart(a, { bezeichnung: 'Amoxi 1000', supplier: 'GH Nord', aktionspreis: 4.5, menge: 2, sourceKind: 'rabatt' });
  const order = social.checkoutCart(a, { reference: 'KW40' });
  // Termin setzen
  const upd = social.setOrderExpected(a, order.id, '2026-09-30');
  assert.equal(upd.expected_delivery, '2026-09-30');
  assert.equal(social.listOrders(a).find(o => o.id === order.id).expected_delivery, '2026-09-30');
  // Termin entfernen (leer)
  const cleared = social.setOrderExpected(a, order.id, null);
  assert.equal(cleared.expected_delivery, null);
  // Fremde Bestellung ist gesperrt
  assert.throws(() => social.setOrderExpected(b, order.id, '2026-09-30'), /nicht gefunden|not_found/i);
});

test('Bestell-Historie: checkout schnappschottet + leert, reorder füllt neu, delete entfernt', () => {
  const { social, a } = setup();
  social.addToCart(a, { bezeichnung: 'Amoxi', supplier: 'Kwizda', aktionspreis: 7, listenpreis: 10, menge: 3, sourceKind: 'rabatt' });
  social.addToCart(a, { bezeichnung: 'Ibu', supplier: 'Herba', aktionspreis: 5, menge: 2, sourceKind: 'price' });
  // Abschließen -> Order angelegt, Liste geleert
  const order = social.checkoutCart(a, { reference: 'KW32' });
  assert.equal(order.reference, 'KW32');
  assert.equal(order.positions, 2);
  assert.equal(order.total_pieces, 5);
  assert.equal(order.total_price, 7 * 3 + 5 * 2); // 31
  assert.equal(order.total_savings, (10 - 7) * 3); // 9
  assert.equal(social.cart(a).count, 0, 'Liste geleert');
  assert.throws(() => social.checkoutCart(a), /leer|empty/i);
  // Historie
  const orders = social.listOrders(a);
  assert.equal(orders.length, 1);
  assert.equal(orders[0].items.length, 2);
  // Erneut bestellen -> Positionen zurück in die Liste
  social.reorder(a, order.id);
  const c = social.cart(a);
  assert.equal(c.count, 2);
  assert.equal(c.total_price, 31);
  // Löschen
  social.deleteOrder(a, order.id);
  assert.equal(social.listOrders(a).length, 0);
});

test('Checkout je Lieferant: nur die Positionen eines Großhandels abschließen, Rest bleibt', () => {
  const { social, a } = setup();
  social.addToCart(a, { bezeichnung: 'Amoxi', supplier: 'Kwizda', aktionspreis: 7, listenpreis: 10, menge: 3, sourceKind: 'rabatt' });
  social.addToCart(a, { bezeichnung: 'Clari', supplier: 'Kwizda', aktionspreis: 4, menge: 2, sourceKind: 'price' });
  social.addToCart(a, { bezeichnung: 'Ibu', supplier: 'Herba', aktionspreis: 5, menge: 2, sourceKind: 'price' });
  social.addToCart(a, { bezeichnung: 'Handschuhe', menge: 1, sourceKind: 'manual' }); // ohne Lieferant

  // Nur Kwizda abschließen: eigene Order mit korrekten Summen NUR aus Kwizda-Positionen.
  const order = social.checkoutCart(a, { reference: 'KW32', supplier: 'Kwizda' });
  assert.equal(order.positions, 2);
  assert.equal(order.total_pieces, 5); // 3 + 2
  assert.equal(order.total_price, 7 * 3 + 4 * 2); // 29 — Herba/manuell NICHT enthalten
  assert.equal(order.total_savings, (10 - 7) * 3); // 9
  assert.ok(order.items.every(i => i.supplier === 'Kwizda'));

  // Rest bleibt in der Liste (Herba + Handschuhe).
  const c = social.cart(a);
  assert.equal(c.count, 2);
  assert.ok(c.items.some(i => i.bezeichnung === 'Ibu'));
  assert.ok(c.items.some(i => i.bezeichnung === 'Handschuhe'));
  assert.equal(c.total_price, 5 * 2); // nur Ibu hat einen Preis

  // Groß-/Kleinschreibung des Lieferantennamens ist egal.
  const order2 = social.checkoutCart(a, { supplier: 'herba' });
  assert.equal(order2.positions, 1);
  assert.equal(order2.items[0].bezeichnung, 'Ibu');
  assert.equal(social.cart(a).count, 1); // nur noch Handschuhe

  // Gruppe „ohne Lieferant" gezielt abschließen (supplier: '').
  const order3 = social.checkoutCart(a, { supplier: '' });
  assert.equal(order3.positions, 1);
  assert.equal(order3.items[0].bezeichnung, 'Handschuhe');
  assert.equal(social.cart(a).count, 0);

  // Drei getrennte Bestellungen in der Historie.
  assert.equal(social.listOrders(a).length, 3);
});

test('Checkout je Lieferant: unbekannter Lieferant wirft, ganze Liste bleibt unangetastet', () => {
  const { social, a } = setup();
  social.addToCart(a, { bezeichnung: 'Amoxi', supplier: 'Kwizda', aktionspreis: 7, menge: 3, sourceKind: 'rabatt' });
  assert.throws(() => social.checkoutCart(a, { supplier: 'GibtsNicht' }), /Lieferanten|supplier/i);
  assert.equal(social.cart(a).count, 1, 'nichts entfernt');
  assert.equal(social.listOrders(a).length, 0, 'keine Order angelegt');
});

test('Bestell-Vorlagen: speichern, anwenden (Merge in Liste), löschen; leere Liste wirft', () => {
  const { social, a } = setup();
  // Leere Liste -> Speichern nicht möglich.
  assert.throws(() => social.saveCartAsTemplate(a, 'Woche'), /leer|empty/i);
  // Name-Validierung.
  social.addToCart(a, { bezeichnung: 'Amoxi', supplier: 'Kwizda', aktionspreis: 7, listenpreis: 10, menge: 3, sourceKind: 'rabatt' });
  social.addToCart(a, { bezeichnung: 'Ibu', supplier: 'Herba', aktionspreis: 5, menge: 2, sourceKind: 'price' });
  assert.throws(() => social.saveCartAsTemplate(a, ' '), /Namen|name/i);
  // Vorlage speichern -> Zusammenfassung stimmt; Liste bleibt unangetastet.
  const tpl = social.saveCartAsTemplate(a, '  Wochenbestellung  ');
  assert.equal(tpl.name, 'Wochenbestellung'); // getrimmt
  assert.equal(tpl.positions, 2);
  assert.equal(tpl.total_pieces, 5);
  assert.equal(tpl.total_price, 7 * 3 + 5 * 2); // 31
  assert.equal(social.cart(a).count, 2, 'Liste durch Speichern nicht verändert');
  assert.equal(social.listCartTemplates(a).length, 1);

  // Liste leeren, dann Vorlage anwenden -> Positionen zurück in der Liste.
  social.clearCart(a);
  assert.equal(social.cart(a).count, 0);
  const cart = social.applyCartTemplate(a, tpl.id);
  assert.equal(cart.count, 2);
  assert.equal(cart.total_price, 31);
  // Erneut anwenden -> Merge summiert Mengen (keine Dubletten).
  social.applyCartTemplate(a, tpl.id);
  const merged = social.cart(a);
  assert.equal(merged.count, 2, 'gleiche Positionen zusammengeführt');
  assert.equal(merged.items.find(i => i.bezeichnung === 'Amoxi').menge, 6);

  // Löschen.
  social.deleteCartTemplate(a, tpl.id);
  assert.equal(social.listCartTemplates(a).length, 0);
});

test('Bestellung: Lieferstatus setzen/zurücksetzen; fremde Order gesperrt; Persistenz', () => {
  const { srepo, social, a, b } = setup();
  social.addToCart(a, { bezeichnung: 'Amoxi', supplier: 'Kwizda', aktionspreis: 7, menge: 3, sourceKind: 'rabatt' });
  const order = social.checkoutCart(a);
  assert.equal(order.received_at ?? null, null, 'frisch: noch nicht geliefert');
  // Als geliefert markieren -> received_at gesetzt; in der Liste sichtbar.
  const up = social.setOrderReceived(a, order.id, true);
  assert.ok(up.received_at, 'received_at gesetzt');
  assert.ok(social.listOrders(a)[0].received_at, 'in der Historie geliefert');
  // Zurücksetzen.
  assert.equal(social.setOrderReceived(a, order.id, false).received_at, null);
  // Fremde Order gesperrt.
  assert.throws(() => social.setOrderReceived(b, order.id, true), /nicht gefunden|not_found/i);
  // Persistenz-Roundtrip des Flags.
  social.setOrderReceived(a, order.id, true);
  const srepo2 = createSocialRepo(); srepo2.__load(srepo.__dump());
  assert.ok(srepo2.getOrder(order.id).received_at, 'Lieferstatus übersteht dump/load');
});

test('Bestell-Vorlagen: strikt pro Nutzer:in; fremde Vorlage nicht anwendbar/löschbar', () => {
  const { social, a, b } = setup();
  social.addToCart(a, { bezeichnung: 'X', aktionspreis: 1, menge: 1, sourceKind: 'manual' });
  const tpl = social.saveCartAsTemplate(a, 'Nur A');
  assert.equal(social.listCartTemplates(b).length, 0, 'B sieht A-Vorlage nicht');
  assert.throws(() => social.applyCartTemplate(b, tpl.id), /nicht gefunden|not_found/i);
  assert.throws(() => social.deleteCartTemplate(b, tpl.id), /nicht gefunden|not_found/i);
});

test('Bestell-Historie: fremde Order nicht abrufbar/änderbar', () => {
  const { social, a, b } = setup();
  social.addToCart(a, { bezeichnung: 'X', aktionspreis: 1, menge: 1, sourceKind: 'manual' });
  const order = social.checkoutCart(a);
  assert.throws(() => social.reorder(b, order.id), /nicht gefunden|not_found/i);
  assert.throws(() => social.deleteOrder(b, order.id), /nicht gefunden|not_found/i);
  assert.equal(social.listOrders(b).length, 0);
});

test('Einkaufsliste: Gesamtersparnis aus Listen- vs. Aktionspreis', () => {
  const { social, a } = setup();
  // Rabatt-Position mit Listenpreis 10, Aktionspreis 7, Menge 4 -> Ersparnis 12
  social.addToCart(a, { bezeichnung: 'Amoxi', supplier: 'Kwizda', aktionspreis: 7, listenpreis: 10, menge: 4, sourceKind: 'rabatt' });
  // Position ohne Listenpreis zählt nicht zur Ersparnis
  social.addToCart(a, { bezeichnung: 'Ibu', supplier: 'Herba', aktionspreis: 5, menge: 2, sourceKind: 'price' });
  const c = social.cart(a);
  assert.equal(c.total_savings, 12);
  assert.equal(c.total_price, 7 * 4 + 5 * 2); // 38
  // Listenpreis <= Aktionspreis darf keine negative Ersparnis erzeugen
  social.addToCart(a, { bezeichnung: 'Pantop', supplier: 'GH', aktionspreis: 9, listenpreis: 8, menge: 1, sourceKind: 'rabatt' });
  assert.equal(social.cart(a).total_savings, 12);
  // Listenpreis ohne Aktionspreis darf KEINE erfundene Ersparnis erzeugen (null != 0)
  social.addToCart(a, { bezeichnung: 'OhnePreis', supplier: 'GH', listenpreis: 10, menge: 5, sourceKind: 'manual' });
  assert.equal(social.cart(a).total_savings, 12);
});

test('Einkaufsliste: Merge trägt fehlenden Listenpreis nach (Ersparnis aktiv)', () => {
  const { social, a } = setup();
  const base = { bezeichnung: 'Amoxi', wirkstoff: 'Amoxicillin', supplier: 'Kwizda', aktionspreis: 7, sourceKind: 'rabatt' };
  social.addToCart(a, { ...base, menge: 2 });                 // ohne Listenpreis
  assert.equal(social.cart(a).total_savings, 0);
  social.addToCart(a, { ...base, listenpreis: 10, menge: 1 }); // identische Position, jetzt mit Listenpreis
  const c = social.cart(a);
  assert.equal(c.count, 1, 'zusammengeführt');
  assert.equal(c.items[0].menge, 3);
  assert.equal(c.total_savings, (10 - 7) * 3); // Listenpreis nachgetragen -> 9
});

test('Einkaufsliste: identisches Angebot doppelt hinzufügen führt Menge zusammen (keine Dublette)', () => {
  const { social, a } = setup();
  const base = { bezeichnung: 'Amoxi 1000', wirkstoff: 'Amoxicillin', supplier: 'Kwizda', aktionspreis: 4.5, sourceKind: 'rabatt' };
  social.addToCart(a, { ...base, menge: 2 });
  social.addToCart(a, { ...base, menge: 3 }); // dieselbe Position -> Menge 5
  let c = social.cart(a);
  assert.equal(c.count, 1, 'nur eine Position');
  assert.equal(c.items[0].menge, 5, 'Mengen summiert');
  // Anderer Lieferant -> eigene Position
  social.addToCart(a, { ...base, supplier: 'Herba', menge: 1 });
  c = social.cart(a);
  assert.equal(c.count, 2, 'anderer Lieferant = neue Position');
  // Anderer Aktionspreis (andere Aktion) -> eigene Position
  social.addToCart(a, { ...base, aktionspreis: 4.9, menge: 1 });
  assert.equal(social.cart(a).count, 3);
  // Manuelle Position mit gleichem Namen mehrfach -> zusammenführen
  social.addToCart(a, { bezeichnung: 'Handschuhe', menge: 1, sourceKind: 'manual' });
  social.addToCart(a, { bezeichnung: 'Handschuhe', menge: 4, sourceKind: 'manual' });
  const glove = social.cart(a).items.find(i => i.bezeichnung === 'Handschuhe');
  assert.equal(glove.menge, 5);
});

test('Einkaufsliste: leere Bezeichnung abgelehnt, Standardmenge 1', () => {
  const { social, a } = setup();
  assert.throws(() => social.addToCart(a, { bezeichnung: '   ' }), /Bezeichnung/);
  const it = social.addToCart(a, { bezeichnung: 'Ibuprofen' });
  assert.equal(it.menge, 1);
  assert.equal(it.source_kind, 'manual');
});

test('Einkaufsliste: Notiz setzen und wieder leeren', () => {
  const { social, a } = setup();
  const it = social.addToCart(a, { bezeichnung: 'Amoxi', note: 'bis Freitag' });
  assert.equal(it.note, 'bis Freitag');
  const up = social.updateCartItem(a, it.id, { note: '  für Rezeptur  ' });
  assert.equal(up.note, 'für Rezeptur'); // getrimmt
  const cleared = social.updateCartItem(a, it.id, { note: '' });
  assert.equal(cleared.note, null);
});

test('Einkaufsliste: strikt pro Nutzer:in getrennt; fremde Position nicht änderbar/löschbar', () => {
  const { social, a, b } = setup();
  const it = social.addToCart(a, { bezeichnung: 'Metformin' });
  assert.equal(social.cart(b).count, 0); // Ben sieht Annas Liste nicht
  assert.throws(() => social.updateCartItem(b, it.id, { menge: 5 }));
  assert.throws(() => social.removeCartItem(b, it.id));
});

test('Einkaufsliste: leeren betrifft nur die eigene Liste; dump/load erhält Positionen', () => {
  const { srepo, social, a, b } = setup();
  social.addToCart(a, { bezeichnung: 'A1' });
  social.addToCart(a, { bezeichnung: 'A2' });
  social.addToCart(b, { bezeichnung: 'B1' });
  social.clearCart(a);
  assert.equal(social.cart(a).count, 0);
  assert.equal(social.cart(b).count, 1); // Bens Liste bleibt
  // dump/load
  const srepo2 = createSocialRepo(); srepo2.__load(srepo.__dump());
  const repo2Social = createSocialService(srepo2, createMemoryRepo());
  // Nutzer existiert in repo2Social nicht -> requireUser würde werfen; deshalb direkt Repo prüfen
  assert.equal(srepo2.listCartItems(b).length, 1);
});
