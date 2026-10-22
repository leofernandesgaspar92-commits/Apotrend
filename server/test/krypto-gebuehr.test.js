// Kleiner Betrag (Afrika-Preis 3,00 €): Netzwerkgebühren bei Bitcoin/Ethereum schwanken
// und können ein spürbarer Teil davon sein. Solana (Bruchteile eines Cents) steht dann
// zuerst und ist markiert; bei großen Beträgen bleibt die Reihenfolge der Wallet-Liste.
// Krypto bleibt vollständig (Owner-Vorgabe): Es wird nur sortiert, nie gefiltert.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPaymentsService } from '../src/services/payments.js';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { cryptoWallets } from '../src/data/cryptoWallets.js';

const HIER = dirname(fileURLToPath(import.meta.url));
const dienst = (preisFuer = null) => createPaymentsService({ repo: createMemoryRepo(), wallets: () => cryptoWallets({}), preisFuer });

test('3,00 €: Solana zuerst und markiert, alle Wallets bleiben', async () => {
  const o = await dienst(() => 300).cryptoOptions('premium_monthly');
  assert.equal(o.amount, 3);
  assert.equal(o.coins[0].coin, 'solana');
  assert.ok(o.coins.filter((c) => c.low_fee).every((c) => c.coin === 'solana'));
  assert.deepEqual(o.coins.map((c) => c.id).sort(), cryptoWallets({}).map((w) => w.id).sort(), 'nichts gefiltert');
  const ersterTeuer = o.coins.findIndex((c) => !c.low_fee);
  assert.ok(o.coins.slice(ersterTeuer).every((c) => !c.low_fee), 'alle günstigen vor allen anderen');
});

test('99 € (Jahr): Reihenfolge der Wallet-Liste bleibt', async () => {
  const o = await dienst().cryptoOptions('premium_yearly');
  assert.deepEqual(o.coins.map((c) => c.id), cryptoWallets({}).map((w) => w.id));
});

test('Oberfläche: Hinweis und Markierung in drei Sprachen, Tron nicht als günstig', () => {
  const app = readFileSync(join(HIER, '..', 'public', 'app.js'), 'utf8');
  assert.match(app, /opt\.amount < 20 && opt\.coins\.some\(\(c\) => c\.low_fee\)/);
  assert.match(app, /c\.low_fee \? ` <span data-lowfee/);
  const i18n = readFileSync(join(HIER, '..', 'public', 'i18n.js'), 'utf8');
  for (const w of ['Bei Solana liegen sie meist unter einem Cent', 'On Solana they are usually below one cent', 'Em Solana costumam ficar abaixo de um cêntimo']) assert.ok(i18n.includes(w), w);
  const pay = readFileSync(join(HIER, '..', 'src', 'services', 'payments.js'), 'utf8');
  assert.match(pay, /const NIEDRIGE_GEBUEHR = new Set\(\['solana'\]\);/, 'nur Solana (Tron-Gebühren schwanken)');
});
