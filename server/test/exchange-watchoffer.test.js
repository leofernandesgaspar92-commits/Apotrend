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
  const social = createSocialService(createSocialRepo(), repo);
  const shortagesRepo = createShortagesRepo({ seed: false });
  const exchange = createExchangeService(createExchangeRepo(), social, repo, shortagesRepo);
  const mk = (n, h) => { const r = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: n }, owner: { name: n, email: h + '@a.at', password: 'geheim123' } }); social.createProfile(r.user.id, { handle: h, displayName: n }); return r.user.id; };
  return { social, exchange, shortagesRepo, watcher: mk('Wächter', 'watch'), offerer: mk('Bieter', 'offer') };
}

test('watch_offer: Beobachter:in wird bei passendem Biete-Angebot benachrichtigt', () => {
  const { social, exchange, shortagesRepo, watcher, offerer } = setup();
  shortagesRepo.addWatch(watcher, 'Amoxicillin');
  exchange.create(offerer, { kind: 'biete', bezeichnung: 'Amoxicillin 1000 mg Filmtabletten' });
  const n = social.notifications(watcher).find(x => x.type === 'watch_offer');
  assert.ok(n, 'watch_offer Benachrichtigung');
  assert.equal(n.label, 'Amoxicillin');
});

test('watch_offer: keine Benachrichtigung bei "suche" (nur biete)', () => {
  const { social, exchange, shortagesRepo, watcher, offerer } = setup();
  shortagesRepo.addWatch(watcher, 'Amoxicillin');
  exchange.create(offerer, { kind: 'suche', bezeichnung: 'Amoxicillin 1000 mg' });
  assert.equal(social.notifications(watcher).filter(x => x.type === 'watch_offer').length, 0);
});

test('watch_offer: nicht an den/die Anbietende:n selbst', () => {
  const { social, exchange, shortagesRepo, offerer } = setup();
  shortagesRepo.addWatch(offerer, 'Amoxicillin'); // Anbieter beobachtet selbst
  exchange.create(offerer, { kind: 'biete', bezeichnung: 'Amoxicillin 1000 mg' });
  assert.equal(social.notifications(offerer).filter(x => x.type === 'watch_offer').length, 0);
});

test('watch_offer: kein Treffer, wenn Wirkstoff nicht in der Bezeichnung', () => {
  const { social, exchange, shortagesRepo, watcher, offerer } = setup();
  shortagesRepo.addWatch(watcher, 'Metformin');
  exchange.create(offerer, { kind: 'biete', bezeichnung: 'Amoxicillin 1000 mg' });
  assert.equal(social.notifications(watcher).filter(x => x.type === 'watch_offer').length, 0);
});

test('watch_offer: ein Treffer je Nutzer, auch bei mehreren beobachteten Treffern', () => {
  const { social, exchange, shortagesRepo, watcher, offerer } = setup();
  shortagesRepo.addWatch(watcher, 'Amoxicillin');
  shortagesRepo.addWatch(watcher, '1000'); // beide würden matchen
  exchange.create(offerer, { kind: 'biete', bezeichnung: 'Amoxicillin 1000 mg' });
  assert.equal(social.notifications(watcher).filter(x => x.type === 'watch_offer').length, 1);
});

// ── Wortgrenzen ───────────────────────────────────────────────────────────────
//  Vorher verglich `watchersForText` mit `includes`. Ein beobachtetes „ASS"
//  (Acetylsalicylsäure, eine der häufigsten Beobachtungen überhaupt) meldete
//  damit jede „Kassenpackung" und jede „Massagecreme". Zwei Fehlalarme, und
//  die Benachrichtigung ist abgeschaltet — dann fehlt auch der echte.

test('watch_offer: „ASS" trifft NICHT mitten im Wort (Kassenpackung, Massage, Glassplitter)', () => {
  for (const bez of ['Kassenpackung Vitamin D', 'Massagecreme 100 ml', 'Glassplitter-Rückruf Behälter', 'Was passiert ist']) {
    const { social, exchange, shortagesRepo, watcher, offerer } = setup();
    shortagesRepo.addWatch(watcher, 'ASS');
    exchange.create(offerer, { kind: 'biete', bezeichnung: bez });
    assert.equal(
      social.notifications(watcher).filter(x => x.type === 'watch_offer').length, 0,
      `„ASS" hat in „${bez}" getroffen`,
    );
  }
});

test('watch_offer: „ASS100 Hexal" trifft — eine Ziffer direkt dahinter ist keine Grenze', () => {
  // Diese Schreibweise ist in einer deutschen Apotheke die Regel, nicht die
  // Ausnahme. Eine beidseitig abgegrenzte Regel (wie beim Behörden-Alarm)
  // hätte genau den häufigsten Fall verpasst.
  for (const bez of ['ASS100 Hexal 100 Stk', 'Hexal-ASS100', 'ASS 100 mg TAH']) {
    const { social, exchange, shortagesRepo, watcher, offerer } = setup();
    shortagesRepo.addWatch(watcher, 'ASS');
    exchange.create(offerer, { kind: 'biete', bezeichnung: bez });
    assert.equal(
      social.notifications(watcher).filter(x => x.type === 'watch_offer').length, 1,
      `„ASS" hat in „${bez}" NICHT getroffen`,
    );
  }
});

test('watch_offer: Wirkstoff als Wortanfang eines Kompositums trifft', () => {
  // „Ibuprofenlysinat" ist dasselbe Präparat-Thema; „Eisentabletten" auch.
  // Beim Behörden-Alarm ist „Paracetamolhaltige Präparate" bewusst KEIN
  // Treffer — dort ist es eine Wirkstoffklasse im Satz, hier ein Produktname.
  for (const [w, bez] of [['Ibuprofen', 'Ibuprofenlysinat 400 mg'], ['Eisen', 'Eisentabletten 50 Stk']]) {
    const { social, exchange, shortagesRepo, watcher, offerer } = setup();
    shortagesRepo.addWatch(watcher, w);
    exchange.create(offerer, { kind: 'biete', bezeichnung: bez });
    assert.equal(
      social.notifications(watcher).filter(x => x.type === 'watch_offer').length, 1,
      `„${w}" hat in „${bez}" NICHT getroffen`,
    );
  }
});

test('watch_offer: Umlaut neben dem Treffer — die Grenze ist Unicode, nicht ASCII', () => {
  // Mit `\b` (ASCII) wäre „Östrogen" am Textanfang nie ein Treffer gewesen,
  // und „Ibuprofenähnlich" einer. Dieselbe Falle wie im Wirkstoff-Alarm.
  const a = setup();
  a.shortagesRepo.addWatch(a.watcher, 'Östrogen');
  a.exchange.create(a.offerer, { kind: 'biete', bezeichnung: 'Östrogen-Pflaster 8 Stk' });
  assert.equal(a.social.notifications(a.watcher).filter(x => x.type === 'watch_offer').length, 1,
    'Treffer am Textanfang mit Umlaut');

  const b = setup();
  b.shortagesRepo.addWatch(b.watcher, 'Strogen');
  b.exchange.create(b.offerer, { kind: 'biete', bezeichnung: 'Östrogen-Pflaster 8 Stk' });
  assert.equal(b.social.notifications(b.watcher).filter(x => x.type === 'watch_offer').length, 0,
    'der Umlaut davor ist eine Buchstabengrenze, kein Wortanfang');
});

test('watch_offer: Sonderzeichen im Wirkstoffnamen sprengen die Suche nicht', () => {
  // Wirkstoffnamen enthalten „(", „+", „." — unescaped wäre das ein Regex.
  const { social, exchange, shortagesRepo, watcher, offerer } = setup();
  shortagesRepo.addWatch(watcher, 'Amoxicillin + Clavulansäure (2:1)');
  exchange.create(offerer, { kind: 'biete', bezeichnung: 'Amoxicillin + Clavulansäure (2:1) 500 mg' });
  assert.equal(social.notifications(watcher).filter(x => x.type === 'watch_offer').length, 1);
});
