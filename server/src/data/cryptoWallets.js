// Direkt-in-Wallet Krypto-Empfang: die ÖFFENTLICHEN Empfangsadressen des Betreibers.
// Empfangsadressen sind öffentlich (kein Geheimnis) — sie stehen bewusst hier, damit
// Kund:innen direkt an genau diese Wallets zahlen können. Per ENV überschreibbar.
//
// Solana ist bewusst NICHT vorbelegt: es wurden zwei unterschiedliche SOL-Adressen
// genannt (EMSJTk…pamWFM vs. Egbc…n1DW). Eine falsche Adresse = Geldverlust — daher
// erst nach Klärung über APOTREND_WALLET_SOL aktivieren.
export function cryptoWallets(env = process.env) {
  const out = {};
  const btc = env.APOTREND_WALLET_BTC || 'bc1qjxckfxdw74dhul8l5jusax6ye87fy84hvvch46';
  const eth = env.APOTREND_WALLET_ETH || '0x5f50991186014eDcbDE301467bE7a20C6CCc179B';
  const sol = env.APOTREND_WALLET_SOL || ''; // erst nach Klärung setzen
  if (btc) out.bitcoin = { coin: 'bitcoin', symbol: 'BTC', address: btc, network: 'Bitcoin (Mainnet)', decimals: 8 };
  if (eth) out.ethereum = { coin: 'ethereum', symbol: 'ETH', address: eth, network: 'Ethereum (Mainnet)', decimals: 18 };
  if (sol) out.solana = { coin: 'solana', symbol: 'SOL', address: sol, network: 'Solana (Mainnet)', decimals: 9 };
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
