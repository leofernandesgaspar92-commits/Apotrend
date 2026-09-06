import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createShortagesRepo } from '../src/repo/shortagesRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';
import { createShortagesService, weeklyChange } from '../src/services/shortages.js';

function setup() {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const socialRepo = createSocialRepo();
  const social = createSocialService(socialRepo, repo);
  const shortagesRepo = createShortagesRepo({ seed: true });
  const shortages = createShortagesService(shortagesRepo, social);
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  return { shortages, shortagesRepo, uid: A.user.id };
}

test('Watchlist: Wirkstoff beobachten liefert aktuellen Status (kritisch)', () => {
  const { shortages, uid } = setup();
  const items = shortages.watch(uid, 'Amoxicillin');
  const amox = items.find(i => i.wirkstoff.toLowerCase() === 'amoxicillin');
  assert.ok(amox, 'Amoxicillin in Liste');
  assert.equal(amox.status, 'kritisch');
  assert.ok(amox.shortage_id, 'shortage_id gesetzt');
});

test('Watchlist: unbekannter Wirkstoff -> Status unauffaellig', () => {
  const { shortages, uid } = setup();
  const items = shortages.watch(uid, 'Vitamin C');
  const v = items.find(i => i.wirkstoff === 'Vitamin C');
  assert.equal(v.status, 'unauffaellig');
  assert.equal(v.shortage_id, null);
});

test('Watchlist: kritische zuerst sortiert', () => {
  const { shortages, uid } = setup();
  shortages.watch(uid, 'Metformin');    // verfuegbar
  shortages.watch(uid, 'Vitamin C');    // unauffaellig
  const items = shortages.watch(uid, 'Amoxicillin'); // kritisch
  assert.equal(items[0].wirkstoff, 'Amoxicillin', 'kritisch ganz oben');
  assert.equal(items[items.length - 1].wirkstoff, 'Vitamin C', 'unauffaellig ganz unten');
});

test('Watchlist: kein Duplikat, unabhängig von Groß/Kleinschreibung', () => {
  const { shortages, uid } = setup();
  shortages.watch(uid, 'Amoxicillin');
  const items = shortages.watch(uid, 'amoxicillin');
  assert.equal(items.filter(i => i.wirkstoff.toLowerCase() === 'amoxicillin').length, 1);
});

test('Watchlist: entfernen', () => {
  const { shortages, uid } = setup();
  shortages.watch(uid, 'Amoxicillin');
  const items = shortages.unwatch(uid, 'AMOXICILLIN');
  assert.equal(items.length, 0);
});

test('Watchlist: leerer Wirkstoff wird abgelehnt', () => {
  const { shortages, uid } = setup();
  assert.throws(() => shortages.watch(uid, '   '), /Wirkstoff/);
});

test('Watchlist: watched-Flag in listWithCounts', () => {
  const { shortages, uid } = setup();
  shortages.watch(uid, 'Amoxicillin');
  const list = shortages.listWithCounts(uid);
  const amox = list.find(s => s.wirkstoff === 'Amoxicillin');
  assert.equal(amox.watched, true);
  const other = list.find(s => s.wirkstoff === 'Ibuprofen');
  assert.equal(other.watched, false);
});

test('Watchlist: Persistenz über __dump/__load', () => {
  const { shortages, shortagesRepo, uid } = setup();
  shortages.watch(uid, 'Amoxicillin');
  const dump = shortagesRepo.__dump();
  const fresh = createShortagesRepo({ seed: false });
  fresh.__load(dump);
  assert.equal(fresh.isWatched(uid, 'amoxicillin'), true);
  assert.deepEqual(fresh.listWatch(uid), ['Amoxicillin']);
});

test('Watchlist: __load bleibt rückwärtskompatibel zu altem Array-Snapshot', () => {
  const oldSnapshot = [['id1', { id: 'id1', wirkstoff: 'Alt', status: 'kritisch' }]];
  const repo = createShortagesRepo({ seed: false });
  repo.__load(oldSnapshot);
  assert.equal(repo.get('id1').wirkstoff, 'Alt');
});

test('Watchlist: purgeUser entfernt Beobachtungen (DSGVO)', () => {
  const { shortages, shortagesRepo, uid } = setup();
  shortages.watch(uid, 'Amoxicillin');
  shortagesRepo.purgeUser(uid);
  assert.equal(shortagesRepo.listWatch(uid).length, 0);
});

test('Sammel-Rabattalarm: setWatchAlertAll setzt/abschaltet für alle beobachteten; Validierung', () => {
  const { shortages, uid } = setup();
  shortages.watch(uid, 'Amoxicillin');
  shortages.watch(uid, 'Ibuprofen');
  shortages.watch(uid, 'Ramipril');
  // Für alle auf 10 % setzen.
  const r = shortages.setWatchAlertAll(uid, 10);
  assert.equal(r.count, 3);
  assert.equal(r.pct, 10);
  assert.ok(r.items.every(i => i.alert_pct === 10), 'alle Wirkstoffe auf 10 %');
  // Einzelnen überschreiben, dann erneut Sammel-Set -> wieder einheitlich.
  shortages.setWatchAlert(uid, 'Ibuprofen', 25);
  assert.equal(shortages.myWatchlist(uid).find(i => i.wirkstoff === 'Ibuprofen').alert_pct, 25);
  shortages.setWatchAlertAll(uid, 5);
  assert.ok(shortages.myWatchlist(uid).every(i => i.alert_pct === 5));
  // Alle ausschalten (null/leer).
  const off = shortages.setWatchAlertAll(uid, null);
  assert.equal(off.pct, null);
  assert.ok(off.items.every(i => i.alert_pct == null), 'alle Alarme aus');
  // 0 schaltet ebenfalls alle aus (dokumentiertes Verhalten), wirft nicht.
  shortages.setWatchAlertAll(uid, 15);
  const zero = shortages.setWatchAlertAll(uid, 0);
  assert.equal(zero.pct, null);
  assert.ok(zero.items.every(i => i.alert_pct == null), '0 => alle aus');
  // Ungültige Werte 1..99.
  assert.throws(() => shortages.setWatchAlertAll(uid, 120), /1.*99|Schwelle/);
  assert.throws(() => shortages.setWatchAlertAll(uid, -3), /1.*99|Schwelle/);
});

test('Wochenrückblick: weeklyChange erkennt neu / wieder verfügbar / Status / außerhalb Fenster', () => {
  const today = '2026-08-17';
  // Erstmeldung (genau ein History-Eintrag) vor 2 Tagen, aktiv -> neu
  assert.deepEqual(
    weeklyChange({ status: 'kritisch', history: [{ am: '2026-08-15', status: 'kritisch' }] }, today),
    { kind: 'neu', am: '2026-08-15', days_ago: 2, status: 'kritisch' });
  // Erstmeldung vor 10 Tagen -> außerhalb des 7-Tage-Fensters -> null
  assert.equal(
    weeklyChange({ status: 'kritisch', history: [{ am: '2026-08-05', status: 'kritisch' }] }, today), null);
  // Wieder verfügbar vor 1 Tag -> wieder_verfuegbar (unabhängig vom Erstmeldedatum)
  assert.deepEqual(
    weeklyChange({ status: 'verfuegbar', history: [{ am: '2026-07-01', status: 'kritisch' }, { am: '2026-08-16', status: 'verfuegbar' }] }, today),
    { kind: 'wieder_verfuegbar', am: '2026-08-16', days_ago: 1, status: 'verfuegbar' });
  // Statuswechsel (kritisch -> eingeschränkt) vor 3 Tagen -> status
  assert.deepEqual(
    weeklyChange({ status: 'eingeschraenkt', history: [{ am: '2026-07-01', status: 'kritisch' }, { am: '2026-08-14', status: 'eingeschraenkt' }] }, today),
    { kind: 'status', am: '2026-08-14', days_ago: 3, status: 'eingeschraenkt' });
  // Wieder verfügbar, aber Wechsel vor 30 Tagen -> außerhalb -> null
  assert.equal(
    weeklyChange({ status: 'verfuegbar', history: [{ am: '2026-07-01', status: 'kritisch' }, { am: '2026-07-18', status: 'verfuegbar' }] }, today), null);
  // Leere/fehlende history -> null
  assert.equal(weeklyChange({ status: 'kritisch', history: [] }, today), null);
  assert.equal(weeklyChange({ status: 'kritisch' }, today), null);
});

test('Wochenrückblick: neu gemeldeter beobachteter Wirkstoff erscheint mit week_change=neu', () => {
  const { shortages, uid } = setup();
  shortages.watch(uid, 'Testophyllin');
  shortages.reportShortage(uid, { wirkstoff: 'Testophyllin', status: 'kritisch' });
  const item = shortages.myWatchlist(uid).find(i => i.wirkstoff === 'Testophyllin');
  assert.ok(item.week_change, 'week_change gesetzt (heute gemeldet)');
  assert.equal(item.week_change.kind, 'neu');
  assert.equal(item.week_change.days_ago, 0);
  // Auflösen -> wieder_verfuegbar
  shortages.resolveShortage(uid, item.shortage_id);
  const resolved = shortages.myWatchlist(uid).find(i => i.wirkstoff === 'Testophyllin');
  assert.equal(resolved.week_change.kind, 'wieder_verfuegbar');
  // Seed-Wirkstoff (Meldung Wochen alt) -> kein week_change
  shortages.watch(uid, 'Amoxicillin');
  const amox = shortages.myWatchlist(uid).find(i => i.wirkstoff === 'Amoxicillin');
  assert.equal(amox.week_change, null);
});

test('Premium-Notizen: nur mit Premium, nur für beobachtete Wirkstoffe, erscheinen in myWatchlist', () => {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const social = createSocialService(createSocialRepo(), repo);
  const shortagesRepo = createShortagesRepo({ seed: true });
  const premiumUsers = new Set();
  const shortages = createShortagesService(shortagesRepo, social, { hasPremium: (u) => premiumUsers.has(u) });
  const A = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'A' }, owner: { name: 'Anna', email: 'a@a.at', password: 'geheim123' } });
  social.createProfile(A.user.id, { handle: 'anna', displayName: 'Anna' });
  const uid = A.user.id;
  shortages.watch(uid, 'Amoxicillin');
  // ohne Premium -> premium_required
  assert.throws(() => shortages.setWatchNote(uid, 'Amoxicillin', 'Lieferant Großhandel B'), e => e.code === 'premium_required');
  premiumUsers.add(uid);
  // Notiz nur für beobachtete Wirkstoffe
  assert.throws(() => shortages.setWatchNote(uid, 'Ibuprofen', 'x'), e => e.code === 'not_watched');
  // setzen -> erscheint in myWatchlist
  shortages.setWatchNote(uid, 'Amoxicillin', 'Lieferant Großhandel B, Meldebestand 20');
  const item = shortages.myWatchlist(uid).find(i => i.wirkstoff === 'Amoxicillin');
  assert.equal(item.note, 'Lieferant Großhandel B, Meldebestand 20');
  // leeren -> Notiz weg; Persistenz-Roundtrip
  shortages.setWatchNote(uid, 'Amoxicillin', '  ');
  assert.equal(shortages.myWatchlist(uid).find(i => i.wirkstoff === 'Amoxicillin').note, '');
  shortages.setWatchNote(uid, 'Amoxicillin', 'wieder da');
  const fresh = createShortagesRepo({ seed: false });
  fresh.__load(shortagesRepo.__dump());
  assert.equal(fresh.getWatchNote(uid, 'Amoxicillin'), 'wieder da');
});
