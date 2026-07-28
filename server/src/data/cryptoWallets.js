// Direkt-in-Wallet Krypto-Empfang: die ÖFFENTLICHEN Empfangsadressen des Betreibers.
// Empfangsadressen sind öffentlich (kein Geheimnis) — sie stehen bewusst hier, damit
// Kund:innen direkt an genau diese Wallets zahlen. Alle per ENV überschreibbar.
//
// Liste statt Map: pro Coin sind MEHRERE Wallets möglich (z. B. zwei Solana-Wallets:
// Seeker „leokennedy.skr" und Phantom — beide empfangen nur SOL). Jede Wallet hat eine
// stabile `id`; die Kund:in wählt, an welche sie sendet.
export function cryptoWallets(env = process.env) {
  const list = [];
  const push = (id, coin, symbol, address, network, decimals, label = null) => {
    if (address) list.push({ id, coin, symbol, address, network, decimals, label });
  };
  push('btc', 'bitcoin', 'BTC', env.APOTREND_WALLET_BTC || 'bc1qjxckfxdw74dhul8l5jusax6ye87fy84hvvch46', 'Bitcoin (Mainnet)', 8);
  push('eth', 'ethereum', 'ETH', env.APOTREND_WALLET_ETH || '0x5f50991186014eDcbDE301467bE7a20C6CCc179B', 'Ethereum (Mainnet)', 18);
  // Zwei Solana-Wallets (beide nur SOL): Seeker + Phantom.
  push('sol_seeker', 'solana', 'SOL', env.APOTREND_WALLET_SOL_SEEKER || 'Egbc7cfzHLj5dkgnR4E7Xk3MfDNrA5imqKJ1FV1n1DW', 'Solana (Mainnet)', 9, 'Seeker · leokennedy.skr');
  push('sol_phantom', 'solana', 'SOL', env.APOTREND_WALLET_SOL_PHANTOM || 'EMSJTkRGnnExNwaCkte9PDCN4Tm3BNSZKdXqcEpamWFM', 'Solana (Mainnet)', 9, 'Phantom');
  return list;
}

export function walletById(id, env = process.env) {
  return cryptoWallets(env).find(w => w.id === id) || null;
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
