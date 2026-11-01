// USDT über Tron (Afrika-Strategie): Bis 11/2026 wurde der USDT-Betrag mit dem TRX-Kurs gerechnet —
// die Tron-Wallet war nur mit coin 'tron' eingetragen, und 'tron' ist bei CoinGecko TRX (Bruchteil
// eines Euro), nicht USDT (~1 USD). Verlangt wurde rund das Vierfache. Dazu galt der Kurs-Speicher
// für ALLE Coins: Nach einer Bitcoin-Abfrage gab es 5 Minuten lang keinen Tether-Kurs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createPaymentsService } from '../src/services/payments.js';
import { cryptoWallets } from '../src/data/cryptoWallets.js';
import { createCryptoRates } from '../src/services/cryptoRates.js';

const TRON = 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE';
const KURSE = { tether: 0.92, tron: 0.21, bitcoin: 60000, ethereum: 2500, solana: 150 }; // EUR je Coin

test('Tron-Wallet: Betrag in USDT mit dem Tether-Kurs, nicht mit TRX', async () => {
  const w = cryptoWallets({ APOPULSE_WALLET_TRON: TRON }).find((x) => x.id === 'tron');
  assert.equal(w.symbol, 'USDT');
  assert.equal(w.kurs, 'tether');
  const repo = createMemoryRepo();
  const kundin = repo.createUser({ email: 'k@k.gh', name: 'K', passwordHash: 'x' });
  const abgefragt = [];
  const svc = createPaymentsService({
    repo, wallets: () => cryptoWallets({ APOPULSE_WALLET_TRON: TRON }),
    rates: { ratesEur: async (ids) => { abgefragt.push(...ids); return Object.fromEntries(ids.map((i) => [i, KURSE[i]])); } },
  });
  const angebot = await svc.cryptoOptionsBetrag({ amountCents: 999, name: 'Test' });
  const usdt = angebot.coins.find((c) => c.id === 'tron');
  assert.ok(abgefragt.includes('tether'), 'Tether-Kurs nicht abgefragt');
  assert.ok(Math.abs(usdt.amount_crypto - 9.99 / 0.92) < 0.01, `USDT-Betrag falsch: ${usdt.amount_crypto} (mit TRX-Kurs wären es ${(9.99 / 0.21).toFixed(2)})`);
  // Bei der Zahlung gespeicherter Prüfwert ebenfalls in USDT.
  const start = await svc.startCryptoPayment(kundin.id, 'premium_monthly', 'tron');
  const p = repo.listAllPayments().find((x) => x.id === start.payment_id);
  assert.equal(p.rate_eur, 0.92);
  assert.ok(Math.abs(p.expected_crypto - (p.amount_cents / 100) / 0.92) < 0.01, `Prüfwert für die Moderation mit falschem Kurs: ${p.expected_crypto}`);
  // Andere Coins unverändert (Kurs-Kennung = coin).
  const btc = angebot.coins.find((c) => c.id === 'btc');
  assert.ok(Math.abs(btc.amount_crypto - 9.99 / 60000) < 1e-8);
});

test('Kurs-Speicher je Coin: nach Bitcoin-Abfrage gibt es trotzdem Tether; Ausfall → letzter Stand', async () => {
  let uhr = 0; const urls = []; let netz = true;
  const fetchImpl = async (url) => {
    urls.push(url);
    if (!netz) throw new Error('offline');
    const ids = new URL(url).searchParams.get('ids').split(',');
    return { ok: true, json: async () => Object.fromEntries(ids.map((i) => [i, { eur: KURSE[i] }])) };
  };
  const r = createCryptoRates({ fetchImpl, now: () => uhr });
  assert.deepEqual(await r.ratesEur(['bitcoin']), { bitcoin: 60000 });
  assert.deepEqual(await r.ratesEur(['tether']), { tether: 0.92 }, 'Tether fehlte, weil der Bitcoin-Abruf zwischengespeichert war');
  assert.equal(urls.length, 2);
  await r.ratesEur(['bitcoin', 'tether']);
  assert.equal(urls.length, 2, 'frische Kurse erneut abgefragt');
  uhr += 10 * 60 * 1000; netz = false;
  assert.deepEqual(await r.ratesEur(['bitcoin', 'tether']), { bitcoin: 60000, tether: 0.92 }, 'bei Ausfall kein Rückfall auf den letzten Stand');
  assert.match(r.status().fehler, /offline/);
  // 429 (Grenze erreicht) zählt als Fehler, nicht als leere Antwort.
  const r2 = createCryptoRates({ fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({ status: { error_code: 429 } }) }) });
  assert.deepEqual(await r2.ratesEur(['tether']), {});
  assert.match(r2.status().fehler, /429/);
});
