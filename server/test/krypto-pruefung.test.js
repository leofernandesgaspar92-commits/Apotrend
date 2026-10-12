// ============================================================================
//  Manuelle Krypto-Prüfung: Meldung, Benachrichtigung, Bestätigung, Ablehnung
// ============================================================================
//  Vorher: Die Kundin meldete ihre Transaktions-ID und las „wird nach Prüfung
//  freigeschaltet" — und niemand erfuhr davon. Es gab keine Prüfliste in der
//  App und keine Benachrichtigung. Eine Apotheke in Lagos hätte gezahlt und
//  ewig gewartet.
//
//  Dazu eine Lücke, die beim Bau auffiel: Transaktions-IDs sind ÖFFENTLICH.
//  Wer eine fremde, echte Zahlung abschreibt, bestünde die Prüfung „gibt es
//  die Transaktion, geht sie an unsere Adresse?".
// ============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createPaymentsService } from '../src/services/payments.js';
import { cryptoWallets } from '../src/data/cryptoWallets.js';
import { pruefeTx } from '../src/domain/kryptoTx.js';

const SOL_TX = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW';
const BTC_TX = 'a1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d';
const ETH_TX = '0x88df016429689c079f3b2f6ad39fa052532c56795b733da78a91ebe6a713944b';

function setup({ kurs = 150 } = {}) {
  const repo = createMemoryRepo();
  const kundin = repo.createUser({ email: 'k@k.ng', name: 'K', passwordHash: 'x' });
  const andere = repo.createUser({ email: 'a@a.ng', name: 'A', passwordHash: 'x' });
  const mod = repo.createUser({ email: 'm@m.at', name: 'M', passwordHash: 'x' });
  const glocke = [];
  const svc = createPaymentsService({
    repo, wallets: () => cryptoWallets({}), isModerator: (id) => id === mod.id,
    rates: { ratesEur: async (ids) => Object.fromEntries(ids.map((i) => [i, kurs])) },
    benachrichtige: (o) => glocke.push(o), moderatoren: () => [mod.id],
  });
  return { repo, svc, kundin, andere, mod, glocke };
}

// ── Die Lücke: niemand erfuhr von der Zahlung ────────────────────────────────

test('Melden benachrichtigt die Moderation — mit Coin und Betrag', async () => {
  const s = setup();
  const start = await s.svc.startCryptoPayment(s.kundin.id, 'premium_monthly', 'sol_phantom');
  s.svc.claimCryptoPayment(s.kundin.id, start.payment_id, SOL_TX);
  const m = s.glocke.filter((g) => g.type === 'payment_review');
  assert.equal(m.length, 1, 'ohne diese Meldung prüfte niemand');
  assert.equal(m[0].userId, s.mod.id);
  assert.equal(m[0].refId, start.payment_id);
  assert.match(m[0].label, /solana · 9\.99 EUR/);
});

test('Bestätigen benachrichtigt die Kundin', async () => {
  const s = setup();
  const start = await s.svc.startCryptoPayment(s.kundin.id, 'premium_monthly', 'sol_phantom');
  s.svc.claimCryptoPayment(s.kundin.id, start.payment_id, SOL_TX);
  await s.svc.confirmPayment(s.mod.id, start.payment_id);
  const k = s.glocke.filter((g) => g.type === 'payment_confirmed');
  assert.equal(k.length, 1);
  assert.equal(k[0].userId, s.kundin.id);
  assert.equal(s.svc.hasFeature(s.kundin.id, 'premium'), true);
});

// ── Ablehnen ─────────────────────────────────────────────────────────────────

test('Ablehnen: Grund Pflicht, Kundin erfährt ihn, kein Premium', async () => {
  const s = setup();
  const start = await s.svc.startCryptoPayment(s.kundin.id, 'premium_monthly', 'sol_phantom');
  s.svc.claimCryptoPayment(s.kundin.id, start.payment_id, SOL_TX);
  assert.throws(() => s.svc.rejectPayment(s.mod.id, start.payment_id, '  '), (e) => e.code === 'reject_reason_missing');
  assert.throws(() => s.svc.rejectPayment(s.kundin.id, start.payment_id, 'x'), (e) => e.code === 'forbidden');
  s.svc.rejectPayment(s.mod.id, start.payment_id, 'Betrag zu niedrig (2 € statt 9,99 €)');
  assert.equal(s.repo.getPayment(start.payment_id).status, 'failed');
  assert.equal(s.svc.hasFeature(s.kundin.id, 'premium'), false);
  const k = s.glocke.find((g) => g.type === 'payment_rejected');
  assert.equal(k.userId, s.kundin.id);
  assert.match(k.label, /Betrag zu niedrig/, 'ohne Grund wartet sie weiter');
  assert.equal(s.svc.myPayments(s.kundin.id)[0].review_note, 'Betrag zu niedrig (2 € statt 9,99 €)');
});

test('Ablehnen geht nur bei offener Meldung', async () => {
  const s = setup();
  const start = await s.svc.startCryptoPayment(s.kundin.id, 'premium_monthly', 'sol_phantom');
  assert.throws(() => s.svc.rejectPayment(s.mod.id, start.payment_id, 'x'), (e) => e.code === 'payment_not_in_review');
});

// ── Öffentliche Transaktions-IDs ─────────────────────────────────────────────

test('Eine Transaktion lässt sich nur einmal melden', async () => {
  const s = setup();
  const a = await s.svc.startCryptoPayment(s.kundin.id, 'premium_monthly', 'sol_phantom');
  const b = await s.svc.startCryptoPayment(s.andere.id, 'premium_monthly', 'sol_phantom');
  s.svc.claimCryptoPayment(s.kundin.id, a.payment_id, SOL_TX);
  assert.throws(() => s.svc.claimCryptoPayment(s.andere.id, b.payment_id, SOL_TX), (e) => e.code === 'tx_already_claimed',
    'eine abgeschriebene fremde Transaktion ließ sich als eigene melden');
});

test('Wer zuerst eine fremde ID meldet, sperrt die echte Zahlerin nicht aus', async () => {
  // Betrügerin meldet zuerst; Moderation sieht: Zahlung liegt VOR ihrem Start
  // -> abgelehnt. Danach muss die echte Zahlerin melden können.
  const s = setup();
  const betrug = await s.svc.startCryptoPayment(s.andere.id, 'premium_monthly', 'sol_phantom');
  const echt = await s.svc.startCryptoPayment(s.kundin.id, 'premium_monthly', 'sol_phantom');
  s.svc.claimCryptoPayment(s.andere.id, betrug.payment_id, SOL_TX);
  assert.throws(() => s.svc.claimCryptoPayment(s.kundin.id, echt.payment_id, SOL_TX), (e) => e.code === 'tx_already_claimed');
  s.svc.rejectPayment(s.mod.id, betrug.payment_id, 'Transaktion liegt vor dem Start Ihrer Zahlung');
  s.svc.claimCryptoPayment(s.kundin.id, echt.payment_id, SOL_TX);
  assert.equal(s.repo.getPayment(echt.payment_id).status, 'pending_review');
});

test('Prüfliste: erwarteter Betrag, Startzeit, Kundin, Explorer-Link', async () => {
  const s = setup({ kurs: 150 });
  const start = await s.svc.startCryptoPayment(s.kundin.id, 'premium_monthly', 'sol_phantom');
  s.svc.claimCryptoPayment(s.kundin.id, start.payment_id, SOL_TX);
  const [p] = s.svc.listPendingReview(s.mod.id, { kunde: (uid) => ({ handle: 'apo_lagos', uid }) });
  assert.equal(p.expected_crypto, Number((9.99 / 150).toFixed(8)), 'erwarteter Betrag zum Kurs beim Start');
  assert.ok(p.created_at && p.claimed_at, 'Start- und Meldezeit — der Schutz gegen abgeschriebene IDs');
  assert.equal(p.kunde.handle, 'apo_lagos');
  assert.equal(p.explorer_url, `https://solscan.io/tx/${SOL_TX}`);
  assert.equal(p.tx_format_ok, true);
  assert.equal(p.network, 'Solana (Mainnet)');
  assert.equal(p.symbol, 'SOL', 'Kürzel statt Kettenname — „0,0666 SOL", nicht „SOLANA"');
  assert.throws(() => s.svc.listPendingReview(s.kundin.id), (e) => e.code === 'forbidden');
});

test('Ohne Kurs kein erfundener Betrag', async () => {
  const s = setup();
  const svc = createPaymentsService({ repo: s.repo, wallets: () => cryptoWallets({}), isModerator: () => true,
    rates: { ratesEur: async () => { throw new Error('Kursdienst weg'); } } });
  const start = await svc.startCryptoPayment(s.kundin.id, 'premium_monthly', 'btc');
  assert.equal(s.repo.getPayment(start.payment_id).expected_crypto, null);
});

// ── Formprüfung je Kette ─────────────────────────────────────────────────────

test('Formprüfung: Tippfehler fällt beim Melden auf, nicht nach Tagen', async () => {
  const s = setup();
  const start = await s.svc.startCryptoPayment(s.kundin.id, 'premium_monthly', 'btc');
  assert.throws(() => s.svc.claimCryptoPayment(s.kundin.id, start.payment_id, BTC_TX.slice(0, 60)),
    (e) => e.code === 'tx_format' && /Bitcoin/.test(e.message));
  s.svc.claimCryptoPayment(s.kundin.id, start.payment_id, BTC_TX.toUpperCase());
  assert.equal(s.repo.getPayment(start.payment_id).provider_ref, BTC_TX, 'Hex wird vereinheitlicht');
});

test('pruefeTx: echte Formen je Kette, Link nur aus geprüfter ID', () => {
  assert.equal(pruefeTx('bitcoin', BTC_TX).explorer, `https://mempool.space/tx/${BTC_TX}`);
  assert.equal(pruefeTx('ethereum', ETH_TX.slice(2)).id, ETH_TX, '„0x" wird ergänzt');
  assert.equal(pruefeTx('ethereum', ETH_TX).explorer, `https://etherscan.io/tx/${ETH_TX}`);
  assert.equal(pruefeTx('tron', BTC_TX).explorer, `https://tronscan.org/#/transaction/${BTC_TX}`);
  assert.equal(pruefeTx('solana', SOL_TX).id, SOL_TX, 'Base58 unterscheidet Groß/Klein');
  for (const [coin, bad] of [['bitcoin', 'abc'], ['ethereum', '0x' + 'g'.repeat(64)], ['solana', '0OIl'.repeat(22)],
    ['bitcoin', `${BTC_TX}"><script>`], ['solana', `${SOL_TX}/../../x`]]) {
    const r = pruefeTx(coin, bad);
    assert.equal(r.ok, false, `${coin}: „${bad}" gilt als gültig`);
    assert.equal(r.explorer, undefined, 'kein Link aus ungeprüfter Eingabe');
  }
});
