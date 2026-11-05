// Konto gelöscht — was wird aus seinen Zahlungen? Bis 11/2026: alles gelöscht, auch bezahlte.
//  • Dieselbe Krypto-Transaktion ließ sich danach erneut melden (der Schutz „eine ID nur einmal" hing am
//    gelöschten Datensatz) — mit neuem Konto ein zweites Premium für eine Zahlung, wenn die Prüfung es übersieht.
//  • Der Beleg einer bezahlten Zahlung verschwand (Rechnungen bleiben schon wegen der Aufbewahrungspflicht).
// Jetzt: Bezahlte und gemeldete Zahlungen bleiben OHNE Personenbezug stehen; nie gemeldete Starts verschwinden.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createPaymentsService } from '../src/services/payments.js';
import { cryptoWallets } from '../src/data/cryptoWallets.js';

const SOL_TX = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW';

function setup() {
  const repo = createMemoryRepo();
  const mod = repo.createUser({ email: 'm@m.at', name: 'M', passwordHash: 'x' });
  const svc = createPaymentsService({ repo, wallets: () => cryptoWallets({}), isModerator: (id) => id === mod.id, rates: { ratesEur: async (ids) => Object.fromEntries(ids.map((i) => [i, 150])) } });
  return { repo, svc, mod };
}

test('Nach Konto-Löschung lässt sich dieselbe Transaktion nicht erneut melden', async () => {
  const { repo, svc, mod } = setup();
  const a = repo.createUser({ email: 'a@a.ke', name: 'A', passwordHash: 'x' });
  const s1 = await svc.startCryptoPayment(a.id, 'premium_monthly', 'sol_phantom');
  svc.claimCryptoPayment(a.id, s1.payment_id, SOL_TX);
  await svc.confirmPayment(mod.id, s1.payment_id);
  repo.deleteUser(a.id);
  const b = repo.createUser({ email: 'b@b.ke', name: 'B', passwordHash: 'x' });
  const s2 = await svc.startCryptoPayment(b.id, 'premium_monthly', 'sol_phantom');
  assert.throws(() => svc.claimCryptoPayment(b.id, s2.payment_id, SOL_TX), (e) => e.code === 'tx_already_claimed');
});

test('Bezahlte Zahlung bleibt als Beleg — ohne Personenbezug; nie gemeldeter Start verschwindet', async () => {
  const { repo, svc, mod } = setup();
  const a = repo.createUser({ email: 'a@a.ke', name: 'A', passwordHash: 'x' });
  const s1 = await svc.startCryptoPayment(a.id, 'premium_monthly', 'sol_phantom');
  svc.claimCryptoPayment(a.id, s1.payment_id, SOL_TX);
  await svc.confirmPayment(mod.id, s1.payment_id);
  const offen = await svc.startCryptoPayment(a.id, 'premium_yearly', 'sol_phantom'); // nie gemeldet
  repo.deleteUser(a.id);
  const alle = repo.listAllPayments();
  assert.deepEqual(alle.map((p) => [p.id, p.status]), [[s1.payment_id, 'paid']], 'nie gemeldeter Start blieb stehen oder Beleg fehlt');
  assert.equal(alle[0].user_id, null, 'Personenbezug nach der Löschung');
  assert.ok(alle[0].amount_cents > 0 && alle[0].provider_ref === SOL_TX);
  assert.ok(!JSON.stringify(alle).includes(a.id), 'Konto-ID steht noch im Beleg');
  assert.equal(repo.getPayment(offen.payment_id), null);
});

test('Abgelehnte Meldung eines gelöschten Kontos sperrt die Transaktion NICHT (echte Zahlerin kann melden)', async () => {
  const { repo, svc, mod } = setup();
  const f = repo.createUser({ email: 'f@f.ke', name: 'F', passwordHash: 'x' });
  const s1 = await svc.startCryptoPayment(f.id, 'premium_monthly', 'sol_phantom');
  svc.claimCryptoPayment(f.id, s1.payment_id, SOL_TX);
  svc.rejectPayment(mod.id, s1.payment_id, 'Zahlung vor dem Start — abgeschrieben');
  repo.deleteUser(f.id);
  assert.equal(repo.getPayment(s1.payment_id), null);
  const echt = repo.createUser({ email: 'e@e.ke', name: 'E', passwordHash: 'x' });
  const s2 = await svc.startCryptoPayment(echt.id, 'premium_monthly', 'sol_phantom');
  assert.doesNotThrow(() => svc.claimCryptoPayment(echt.id, s2.payment_id, SOL_TX));
});

test('Gemeldet, aber ungeprüft, dann Konto gelöscht: nicht mehr in der Prüfliste, Transaktion bleibt gesperrt', async () => {
  const { repo, svc, mod } = setup();
  const a = repo.createUser({ email: 'a@a.ke', name: 'A', passwordHash: 'x' });
  const s1 = await svc.startCryptoPayment(a.id, 'premium_monthly', 'sol_phantom');
  svc.claimCryptoPayment(a.id, s1.payment_id, SOL_TX);
  repo.deleteUser(a.id);
  assert.deepEqual(svc.listPendingReview(mod.id), [], 'Prüfliste zeigt eine Zahlung ohne Konto');
  const b = repo.createUser({ email: 'b@b.ke', name: 'B', passwordHash: 'x' });
  const s2 = await svc.startCryptoPayment(b.id, 'premium_monthly', 'sol_phantom');
  assert.throws(() => svc.claimCryptoPayment(b.id, s2.payment_id, SOL_TX), (e) => e.code === 'tx_already_claimed');
});

test('Sperre und Beleg überstehen Sicherung + Neustart', async () => {
  const { repo, svc, mod } = setup();
  const a = repo.createUser({ email: 'a@a.ke', name: 'A', passwordHash: 'x' });
  const s1 = await svc.startCryptoPayment(a.id, 'premium_monthly', 'sol_phantom');
  svc.claimCryptoPayment(a.id, s1.payment_id, SOL_TX);
  await svc.confirmPayment(mod.id, s1.payment_id);
  repo.deleteUser(a.id);
  const repo2 = createMemoryRepo(); repo2.__load(JSON.parse(JSON.stringify(repo.__dump())));
  const svc2 = createPaymentsService({ repo: repo2, wallets: () => cryptoWallets({}), rates: { ratesEur: async (ids) => Object.fromEntries(ids.map((i) => [i, 150])) } });
  assert.deepEqual(repo2.listAllPayments().map((p) => [p.status, p.user_id]), [['paid', null]]);
  const b = repo2.createUser({ email: 'b@b.ke', name: 'B', passwordHash: 'x' });
  const s2 = await svc2.startCryptoPayment(b.id, 'premium_monthly', 'sol_phantom');
  assert.throws(() => svc2.claimCryptoPayment(b.id, s2.payment_id, SOL_TX), (e) => e.code === 'tx_already_claimed');
});

test('Ehrlich gesagt: Löschtext und Datenschutzerklärung nennen die aufbewahrten Zahlungsbelege', async () => {
  const { readFileSync } = await import('node:fs');
  const i18n = readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8');
  assert.equal((i18n.match(/ac_del_d:'[^\n]*(Zahlungsbelege|payment records|registos de pagamento|justificatifs de paiement|سجلات الدفع)/g) || []).length, 5);
  for (const [datei, wort] of [['datenschutz.html', 'Zahlungsbelege'], ['datenschutz-en.html', 'payment records'], ['datenschutz-pt.html', 'registos de pagamento'], ['datenschutz-fr.html', 'justificatifs de paiement'], ['datenschutz-ar.html', 'سجلات الدفع']])
    assert.ok(readFileSync(new URL('../public/' + datei, import.meta.url), 'utf8').includes(wort), datei);
});

// Fund 11/2026: „{d}" im Wartehinweis ist der Zeitpunkt der Meldung. Arabisch hieß es „Ihre Zahlung IN HÖHE VON
// {Datum}", Englisch/Französisch/Portugiesisch lasen sich ebenso als Betrag („payment of 5 Nov").
test('Wartehinweis: {d} ist ein Zeitpunkt, kein Betrag — in allen Sprachen', async () => {
  const { readFileSync } = await import('node:fs');
  const t = (readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8').match(/pr_review_t:'[^']*'/g) || []);
  assert.equal(t.length, 5);
  assert.ok(!t.some((x) => /البالغة|payment of \{d\}|paiement de \{d\}|pagamento de \{d\}/.test(x)), t.join('\n'));
});
