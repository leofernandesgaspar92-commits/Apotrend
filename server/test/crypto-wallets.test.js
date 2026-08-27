// ============================================================================
//  Krypto-Empfangswege — Tests
// ============================================================================
//  Der Kern dieser Datei: Es darf NIE eine Adresse erscheinen, die nicht aus
//  den hinterlegten Wallets stammt. Eine erfundene oder verwechselte
//  Empfangsadresse ist bei Krypto nicht korrigierbar — das Geld ist weg.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cryptoWallets,
  extraEvmNetworks,
  paymentRoutes,
  walletById,
  walletUri,
} from '../src/data/cryptoWallets.js';

/** Leere Umgebung: liefert die im Code hinterlegten Standardadressen. */
const EMPTY = {};

test('Alle hinterlegten Wallets werden geführt', () => {
  const ids = cryptoWallets(EMPTY).map((w) => w.id);
  assert.deepEqual(ids, ['btc', 'eth', 'sol_seeker', 'sol_phantom']);
});

test('Zwei Solana-Wallets bleiben unterscheidbar', () => {
  const sol = cryptoWallets(EMPTY).filter((w) => w.coin === 'solana');
  assert.equal(sol.length, 2);
  // Ohne Beschriftung wären zwei Zeilen in der Auswahl nicht auseinanderzuhalten.
  assert.ok(sol.every((w) => typeof w.label === 'string' && w.label.length > 0));
  assert.notEqual(sol[0].address, sol[1].address);
});

test('Jede Route benutzt eine Adresse aus dem Wallet-Bestand', () => {
  const known = new Set(cryptoWallets(EMPTY).map((w) => w.address));
  let checked = 0;
  for (const entry of paymentRoutes(EMPTY)) {
    for (const route of entry.routes) {
      assert.ok(known.has(route.address),
        `${entry.asset}/${route.network}: Adresse stammt nicht aus cryptoWallets.js`);
      checked++;
    }
  }
  assert.ok(checked > 0, 'es wurde keine einzige Route geprüft');
});

test('Stablecoins bekommen keine eigene Adresse angedichtet', () => {
  const routes = paymentRoutes(EMPTY);
  const usdc = routes.find((r) => r.asset === 'usdc');
  const eth = cryptoWallets(EMPTY).find((w) => w.id === 'eth');

  // USDC über ERC-20 geht an dieselbe Ethereum-Adresse wie ETH — eine separate
  // „USDC-Wallet" existiert nicht und darf nicht vorgetäuscht werden.
  const erc20 = usdc.routes.find((r) => r.network.startsWith('Ethereum'));
  assert.equal(erc20.address, eth.address);
});

test('USDC lässt zwischen beiden Solana-Wallets wählen', () => {
  const usdc = paymentRoutes(EMPTY).find((r) => r.asset === 'usdc');
  const solRoutes = usdc.routes.filter((r) => r.coin === 'solana');
  assert.equal(solRoutes.length, 2);
  assert.notEqual(solRoutes[0].address, solRoutes[1].address);
});

test('Ohne Tron-Adresse gibt es keinen TRC-20-Weg', () => {
  const usdt = paymentRoutes(EMPTY).find((r) => r.asset === 'usdt');
  assert.ok(!usdt.routes.some((r) => /Tron/.test(r.network)),
    'TRC-20 darf ohne hinterlegte Adresse nicht erscheinen');
});

test('Mit gesetzter Tron-Adresse erscheint TRC-20 sofort', () => {
  const env = { APOTREND_WALLET_TRON: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE' };
  const usdt = paymentRoutes(env).find((r) => r.asset === 'usdt');
  const tron = usdt.routes.find((r) => /Tron/.test(r.network));
  assert.ok(tron, 'TRC-20 fehlt trotz gesetzter Adresse');
  assert.equal(tron.address, env.APOTREND_WALLET_TRON);
});

test('Weitere EVM-Ketten sind Opt-in, keine Annahme', () => {
  assert.deepEqual(extraEvmNetworks(EMPTY), []);

  const ohne = paymentRoutes(EMPTY).find((r) => r.asset === 'usdc');
  assert.ok(!ohne.routes.some((r) => r.network === 'Polygon'));

  // Begründung: Eine gewöhnliche Konto-Adresse gilt auf allen EVM-Ketten, ein
  // Smart-Contract-Wallet aber nicht. Von außen nicht unterscheidbar — also
  // fragen statt raten.
  const env = { APOTREND_EVM_NETWORKS: 'Polygon, Base' };
  assert.deepEqual(extraEvmNetworks(env), ['Polygon', 'Base']);

  const mit = paymentRoutes(env).find((r) => r.asset === 'usdc');
  const polygon = mit.routes.find((r) => r.network === 'Polygon');
  assert.ok(polygon);
  assert.equal(polygon.address, cryptoWallets(env).find((w) => w.id === 'eth').address);
});

test('Stablecoin-Wege tragen die Token-Warnung', () => {
  for (const asset of ['usdt', 'usdc']) {
    const entry = paymentRoutes(EMPTY).find((r) => r.asset === asset);
    assert.ok(entry.routes.every((r) => /geht verloren/.test(r.note || '')),
      `${asset}: Warnung fehlt`);
  }
});

test('ENV-Überschreibung greift durch bis in die Route', () => {
  const env = { APOTREND_WALLET_BTC: 'bc1qexampleexampleexampleexampleexamplexyz' };
  const btc = paymentRoutes(env).find((r) => r.asset === 'btc');
  assert.equal(btc.routes[0].address, env.APOTREND_WALLET_BTC);
  assert.match(btc.routes[0].uri, /^bitcoin:bc1qexample/);
});

test('Eine Wallet lässt sich abschalten, ohne den Code zu ändern', () => {
  // Leer gesetzt heißt „abgeschaltet", nicht „nimm den Standard". Ohne diese
  // Unterscheidung ließe sich eine Kette nie aus dem Angebot nehmen.
  const env = { APOTREND_WALLET_BTC: '' };
  assert.ok(!cryptoWallets(env).some((w) => w.id === 'btc'), 'BTC hätte verschwinden müssen');
  assert.ok(!paymentRoutes(env).some((r) => r.asset === 'btc'), 'BTC-Route besteht weiter');

  // Nicht gesetzt bleibt dagegen die Standardadresse.
  assert.ok(cryptoWallets({}).some((w) => w.id === 'btc'));
});

test('Abschalten der Ethereum-Wallet nimmt auch die Stablecoin-Wege mit', () => {
  // USDT/USDC über ERC-20 hängen an genau dieser Adresse — bleibt ein Weg
  // stehen, zeigt die Oberfläche eine Adresse an, die niemand mehr abfragt.
  const env = { APOTREND_WALLET_ETH: '' };
  const routes = paymentRoutes(env);
  assert.ok(!routes.some((r) => r.asset === 'eth'));
  const usdt = routes.find((r) => r.asset === 'usdt');
  assert.ok(!usdt, 'USDT ohne Ethereum- und ohne Tron-Adresse darf gar nicht erscheinen');
  const usdc = routes.find((r) => r.asset === 'usdc');
  assert.ok(usdc.routes.every((r) => r.coin === 'solana'), 'USDC dürfte nur noch über Solana laufen');
});

test('walletUri erzeugt gültige Zahlungslinks je Kette', () => {
  const btc = walletById('btc', EMPTY);
  const sol = walletById('sol_phantom', EMPTY);
  const eth = walletById('eth', EMPTY);

  assert.match(walletUri(btc, null), /^bitcoin:bc1/);
  assert.match(walletUri(sol, null), /^solana:/);
  assert.match(walletUri(eth, null), /^ethereum:0x/);

  // Mit Betrag: Bitcoin in BTC, Ethereum in Wei (EIP-681).
  assert.match(walletUri(btc, 0.005), /amount=0\.005/);
  assert.match(walletUri(eth, 0.25), /^ethereum:0x[0-9a-fA-F]+@1\?value=250000000000000000$/);
});

test('Jede Route bringt einen benutzbaren Zahlungslink mit', () => {
  for (const entry of paymentRoutes(EMPTY)) {
    for (const route of entry.routes) {
      assert.ok(typeof route.uri === 'string' && route.uri.length > 10,
        `${entry.asset}/${route.network}: URI fehlt`);
      assert.ok(route.uri.includes(route.address),
        `${entry.asset}/${route.network}: URI enthält die Adresse nicht`);
    }
  }
});
