// Premium-Laufzeit. Bis 10/2026 lief „Premium (Monat)" nie ab: Eine Zahlung
// schaltete Premium für immer frei — jede Folgezahlung wäre ausgeblieben.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createPaymentsService, plusMonate } from '../src/services/payments.js';
import { cryptoWallets } from '../src/data/cryptoWallets.js';

const SOL_TX = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW';
const TAG = 86400000;

function aufbau(start = '2026-10-13T10:00:00Z') {
  let t = Date.parse(start);
  const jetzt = () => t;
  const repo = createMemoryRepo({ jetzt });
  const kundin = repo.createUser({ email: 'k@k.at', name: 'K', passwordHash: 'x' });
  const mod = repo.createUser({ email: 'm@m.at', name: 'M', passwordHash: 'x' });
  const glocke = [];
  const svc = createPaymentsService({
    repo, wallets: () => cryptoWallets({}), isModerator: (id) => id === mod.id, jetzt,
    rates: { ratesEur: async (ids) => Object.fromEntries(ids.map((i) => [i, 150])) },
    benachrichtige: (o) => glocke.push(o), moderatoren: () => [mod.id],
  });
  let tx = 0;
  const kaufe = async (produkt = 'premium_monthly') => {
    const s = await svc.startCryptoPayment(kundin.id, produkt, 'sol_phantom');
    // Eindeutige, gültige Base58-ID je Kauf (ohne 0, O, I, l).
    const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZ'; tx++;
    svc.claimCryptoPayment(kundin.id, s.payment_id, SOL_TX.slice(0, -2) + B58[tx % 33] + B58[Math.floor(tx / 33) % 33]);
    await svc.confirmPayment(mod.id, s.payment_id);
  };
  return { repo, svc, kundin, glocke, kaufe, weiter: (d) => { t += d * TAG; } };
}

test('Kalendermonate: Monatsende wird nicht übersprungen', () => {
  assert.equal(new Date(plusMonate(Date.parse('2026-01-31T10:00:00Z'), 1)).toISOString().slice(0, 10), '2026-02-28');
  assert.equal(new Date(plusMonate(Date.parse('2028-01-31T10:00:00Z'), 1)).toISOString().slice(0, 10), '2028-02-29');
  assert.equal(new Date(plusMonate(Date.parse('2026-10-13T10:00:00Z'), 12)).toISOString().slice(0, 10), '2027-10-13');
});

test('Monat läuft ab — vorher Premium, danach nicht', async () => {
  const a = aufbau();
  await a.kaufe();
  assert.equal(a.svc.featureBis(a.kundin.id, 'premium').slice(0, 10), '2026-11-13');
  assert.equal(a.svc.hasFeature(a.kundin.id, 'premium'), true);
  a.weiter(30);
  assert.equal(a.svc.hasFeature(a.kundin.id, 'premium'), true, 'am 12.11. noch aktiv');
  a.weiter(1);
  assert.equal(a.svc.hasFeature(a.kundin.id, 'premium'), false, 'eine Monatszahlung schaltete Premium für immer frei');
  assert.deepEqual(a.repo.listUsersWithEntitlement('premium'), [], 'abgelaufene Kundin bekäme weiter den Wochenbericht');
  assert.deepEqual(a.repo.listEntitlements(a.kundin.id), []);
});

test('Früh verlängern verliert keinen Tag; nach Ablauf zählt ab heute', async () => {
  const a = aufbau();
  await a.kaufe();
  a.weiter(10);
  await a.kaufe();
  assert.equal(a.svc.featureBis(a.kundin.id, 'premium').slice(0, 10), '2026-12-13', 'Verlängerung ab altem Ablauf');
  a.weiter(70); // abgelaufen am 13.12.
  await a.kaufe();
  assert.equal(a.svc.featureBis(a.kundin.id, 'premium').slice(0, 10), '2027-02-01', 'nach Ablauf ab dem Zahltag');
  await a.kaufe('premium_yearly');
  assert.equal(a.svc.featureBis(a.kundin.id, 'premium').slice(0, 10), '2028-02-01');
});

test('von der Redaktion vergebenes Premium bleibt unbefristet — auch bei Zahlung', async () => {
  const a = aufbau();
  a.repo.grantEntitlement(a.kundin.id, 'premium');
  await a.kaufe();
  assert.equal(a.svc.featureBis(a.kundin.id, 'premium'), null);
  a.weiter(400);
  assert.equal(a.svc.hasFeature(a.kundin.id, 'premium'), true);
});

test('Umstellung alter Freischaltungen: Zahlungsdatum + Laufzeit, sonst 7 Tage Kulanz', async () => {
  const a = aufbau('2026-08-01T10:00:00Z');
  // Alter Zustand nachgestellt: bezahlt, aber ohne Frist (so speicherte der Code bis 10/2026).
  await a.kaufe();
  const gesichert = a.repo.__dump();
  gesichert.entitlementBis = [];
  a.repo.__load(gesichert);
  assert.equal(a.svc.featureBis(a.kundin.id, 'premium'), null);
  a.weiter(73); // 13.10.: Zahlung + 1 Monat (01.09.) liegt in der Vergangenheit
  assert.equal(a.svc.laufzeitenUmstellen(), 1);
  assert.equal(a.svc.featureBis(a.kundin.id, 'premium').slice(0, 10), '2026-10-20', 'Kulanz: niemand wird ohne Vorwarnung abgeschnitten');
  assert.equal(a.svc.laufzeitenUmstellen(), 0, 'zweiter Lauf ändert nichts');
});

test('Umstellung: Freischaltung ohne Zahlung bleibt unbefristet', () => {
  const a = aufbau();
  a.repo.grantEntitlement(a.kundin.id, 'premium');
  assert.equal(a.svc.laufzeitenUmstellen(), 0);
  assert.equal(a.svc.featureBis(a.kundin.id, 'premium'), null);
});

test('Erinnerung 3 Tage vor Ablauf, genau einmal', async () => {
  const a = aufbau();
  await a.kaufe();
  a.weiter(26);
  assert.equal(a.svc.ablaufErinnern(), 0, 'zu früh');
  a.weiter(2); // 3 Tage vorher
  assert.equal(a.svc.ablaufErinnern(), 1);
  assert.equal(a.svc.ablaufErinnern(), 0, 'doppelt erinnert');
  const e = a.glocke.find((g) => g.type === 'premium_ablauf');
  assert.deepEqual([e.userId, e.label], [a.kundin.id, '2026-11-13']);
  // Nach Verlängerung neues Ablaufdatum -> wieder eine Erinnerung zu gegebener Zeit.
  await a.kaufe(); // jetzt bis 13.12.
  a.weiter(30);      // 10.12.: 3 Tage vorher
  assert.equal(a.svc.ablaufErinnern(), 1);
});
