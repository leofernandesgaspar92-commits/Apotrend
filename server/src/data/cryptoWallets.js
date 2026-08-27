// Direkt-in-Wallet Krypto-Empfang: die ÖFFENTLICHEN Empfangsadressen des Betreibers.
// Empfangsadressen sind öffentlich (kein Geheimnis) — sie stehen bewusst hier, damit
// Kund:innen direkt an genau diese Wallets zahlen. Alle per ENV überschreibbar.
//
// Liste statt Map: pro Coin sind MEHRERE Wallets möglich (z. B. zwei Solana-Wallets:
// Seeker „leokennedy.skr" und Phantom — beide empfangen nur SOL). Jede Wallet hat eine
// stabile `id`; die Kund:in wählt, an welche sie sendet.
// `process` gibt es im Browser nicht. Diese Datei wird in die Checkout-Demo
// eingebettet (tools/build-checkout-demo.mjs), damit dort GENAU diese Adressen
// stehen und keine abgetippte Zweitfassung — deshalb der Zugriff über eine
// Hilfsfunktion statt direkt über process.env im Standardwert.
const defaultEnv = () => (typeof process !== 'undefined' && process.env ? process.env : {});

export function cryptoWallets(env = defaultEnv()) {
  const list = [];

  // Nicht gesetzt  -> Standardadresse aus dieser Datei.
  // Gesetzt        -> genau dieser Wert.
  // Gesetzt & leer -> Wallet ist ABGESCHALTET.
  //
  // Der letzte Fall braucht die Unterscheidung zwischen `undefined` und '':
  // Mit einem schlichten `||` ließe sich eine Wallet nie abschalten, weil der
  // leere Wert auf den Standard zurückfiele. Wer eine Kette nicht mehr annehmen
  // will, setzt die Variable auf leer und ist fertig.
  const configured = (value, fallback) => (value === undefined ? fallback : String(value).trim());

  const push = (id, coin, symbol, address, network, decimals, label = null) => {
    if (address) list.push({ id, coin, symbol, address, network, decimals, label });
  };

  push('btc', 'bitcoin', 'BTC',
    configured(env.APOTREND_WALLET_BTC, 'bc1qjxckfxdw74dhul8l5jusax6ye87fy84hvvch46'),
    'Bitcoin (Mainnet)', 8);
  push('eth', 'ethereum', 'ETH',
    configured(env.APOTREND_WALLET_ETH, '0x5f50991186014eDcbDE301467bE7a20C6CCc179B'),
    'Ethereum (Mainnet)', 18);
  // Zwei Solana-Wallets (beide nur SOL): Seeker + Phantom.
  push('sol_seeker', 'solana', 'SOL',
    configured(env.APOTREND_WALLET_SOL_SEEKER, 'Egbc7cfzHLj5dkgnR4E7Xk3MfDNrA5imqKJ1FV1n1DW'),
    'Solana (Mainnet)', 9, 'Seeker · leokennedy.skr');
  push('sol_phantom', 'solana', 'SOL',
    configured(env.APOTREND_WALLET_SOL_PHANTOM, 'EMSJTkRGnnExNwaCkte9PDCN4Tm3BNSZKdXqcEpamWFM'),
    'Solana (Mainnet)', 9, 'Phantom');
  // Tron braucht eine EIGENE Adresse (kein EVM-Format). Ohne gesetzte Variable
  // erscheint USDT über TRC-20 gar nicht — eine erfundene Adresse wäre der
  // teuerste denkbare Platzhalter.
  push('tron', 'tron', 'USDT', configured(env.APOTREND_WALLET_TRON, ''), 'Tron (TRC-20)', 6);

  return list;
}

/**
 * Zusätzliche EVM-Ketten, auf denen dieselbe Ethereum-Adresse Zahlungen annimmt.
 *
 * Technisch gilt eine normale Konto-Adresse auf allen EVM-Ketten — es ist
 * dieselbe Adresse aus demselben Schlüssel. Das gilt aber NICHT für
 * Smart-Contract-Wallets (z. B. Safe), die nur dort existieren, wo sie
 * ausgerollt wurden. Von außen ist beides nicht unterscheidbar.
 *
 * Deshalb bewusst als Opt-in statt als Annahme: Wer eine gewöhnliche Wallet
 * (MetaMask, Ledger, Phantom) benutzt, setzt
 *   APOTREND_EVM_NETWORKS="Polygon,Arbitrum,Base"
 * und die Ketten stehen sofort zur Auswahl.
 */
export function extraEvmNetworks(env = defaultEnv()) {
  return String(env.APOTREND_EVM_NETWORKS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function walletById(id, env = defaultEnv()) {
  return cryptoWallets(env).find(w => w.id === id) || null;
}

/**
 * Empfangswege je Vermögenswert — aus den TATSÄCHLICH hinterlegten Wallets
 * abgeleitet, nicht aus einer festen Liste.
 *
 * Der Unterschied ist wichtig: Stablecoins haben keine eigene Adresse. USDT und
 * USDC über ERC-20 gehen an dieselbe Ethereum-Adresse wie ETH, USDC auf Solana
 * an dieselbe Solana-Adresse wie SOL. Eine separate „USDC-Wallet" gibt es nicht
 * und darf hier auch nicht vorgetäuscht werden.
 *
 * Rückgabe: [{ asset, label, routes: [{ walletId, network, address, uri, note }] }]
 */
export function paymentRoutes(env = defaultEnv()) {
  const wallets = cryptoWallets(env);
  const byId = Object.fromEntries(wallets.map((w) => [w.id, w]));
  const evmExtra = extraEvmNetworks(env);

  const route = (wallet, network, note = null) => ({
    walletId: wallet.id,
    network,
    address: wallet.address,
    label: wallet.label,
    coin: wallet.coin,
    uri: walletUri(wallet, null),
    note,
  });

  /** Alle EVM-Wege einer Ethereum-Wallet: Mainnet plus freigeschaltete Ketten. */
  const evmRoutes = (wallet, note) => {
    if (!wallet) return [];
    return [route(wallet, 'Ethereum (ERC-20)', note)].concat(
      evmExtra.map((net) => route(wallet, net, note)),
    );
  };

  const solRoutes = (note) =>
    wallets.filter((w) => w.coin === 'solana').map((w) => route(w, 'Solana (SPL)', note));

  const out = [];

  const tokenNote = 'Nur diesen Token auf dieser Kette senden — ein anderer Token an dieselbe Adresse geht verloren.';

  if (byId.eth || byId.tron) {
    const routes = evmRoutes(byId.eth, tokenNote)
      .concat(byId.tron ? [route(byId.tron, 'Tron (TRC-20)', tokenNote)] : []);
    if (routes.length) out.push({ asset: 'usdt', label: 'USDT (Tether)', routes });
  }

  if (byId.eth || wallets.some((w) => w.coin === 'solana')) {
    const routes = evmRoutes(byId.eth, tokenNote).concat(solRoutes(tokenNote));
    if (routes.length) out.push({ asset: 'usdc', label: 'USDC (Circle)', routes });
  }

  if (byId.btc) {
    out.push({ asset: 'btc', label: 'Bitcoin', routes: [route(byId.btc, 'Bitcoin (Mainnet)')] });
  }

  if (byId.eth) {
    out.push({ asset: 'eth', label: 'Ethereum', routes: evmRoutes(byId.eth, null) });
  }

  const sol = solRoutes(null);
  if (sol.length) out.push({ asset: 'sol', label: 'Solana', routes: sol });

  return out;
}

// Wallet-App-URI („einfach anklicken → Wallet öffnet sich, Betrag vorausgefüllt").
// amountCoin = Betrag in der Kryptowährung (Dezimalzahl) oder null.
export function walletUri(w, amountCoin) {
  const amt = amountCoin != null && isFinite(amountCoin) ? amountCoin : null;
  if (w.coin === 'bitcoin') return `bitcoin:${w.address}${amt ? `?amount=${amt}` : ''}`;
  if (w.coin === 'solana') return `solana:${w.address}${amt ? `?amount=${amt}` : ''}`;
  if (w.coin === 'ethereum') {
    if (amt == null) return `ethereum:${w.address}`;
    // EIP-681: Wert in Wei. Aus 6 Nachkommastellen auf 18 auffüllen (BigInt, keine Float-Fehler).
    const wei = BigInt(Math.round(amt * 1e6)) * (10n ** 12n);
    return `ethereum:${w.address}@1?value=${wei.toString()}`;
  }
  return w.address;
}
