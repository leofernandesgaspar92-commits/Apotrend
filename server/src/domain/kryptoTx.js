// ============================================================================
//  Transaktions-IDs je Kette: Form prüfen, Explorer-Link bauen
// ============================================================================
//  Bei der Direkt-in-Wallet-Zahlung meldet die Kundin ihre Transaktions-ID, und
//  die Moderation prüft sie im öffentlichen Block-Explorer. Zwei Dinge macht
//  diese Datei dafür:
//
//   1. FORM PRÜFEN, schon beim Melden. Ein Tippfehler fällt sofort auf und
//      nicht erst Tage später bei der Prüfung — dann wartet die Kundin
//      umsonst. Geprüft wird nur das Format, nicht ob die Zahlung existiert.
//   2. EXPLORER-LINK, aus der GEPRÜFTEN ID gebaut. Ein Link aus ungeprüfter
//      Eingabe wäre ein Klick der Moderation auf eine Adresse, die die
//      Kundin bestimmt hat.
//
//  Formate (Stand der Ketten, nicht von ApoPulse festgelegt):
//    Bitcoin   64 Hex-Zeichen
//    Ethereum  „0x" + 64 Hex-Zeichen (ohne „0x" eingefügt: wird ergänzt)
//    Tron      64 Hex-Zeichen
//    Solana    Base58-Signatur, 64 Bytes -> üblich 87–88 Zeichen; der
//              Bereich ist bewusst weiter, damit keine echte ID abgewiesen wird
// ============================================================================

const HEX64 = /^[0-9a-fA-F]{64}$/;
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{64,90}$/;

const KETTEN = {
  bitcoin: {
    name: 'Bitcoin',
    norm: (s) => (HEX64.test(s) ? s.toLowerCase() : null),
    link: (id) => `https://mempool.space/tx/${id}`,
    format: '64 Zeichen aus 0–9 und a–f',
  },
  ethereum: {
    name: 'Ethereum',
    norm: (s) => {
      const ohne = s.replace(/^0x/i, '');
      return HEX64.test(ohne) ? '0x' + ohne.toLowerCase() : null;
    },
    link: (id) => `https://etherscan.io/tx/${id}`,
    format: '„0x" und 64 Zeichen aus 0–9 und a–f',
  },
  tron: {
    name: 'Tron',
    norm: (s) => (HEX64.test(s) ? s.toLowerCase() : null),
    link: (id) => `https://tronscan.org/#/transaction/${id}`,
    format: '64 Zeichen aus 0–9 und a–f',
  },
  solana: {
    name: 'Solana',
    // Base58 unterscheidet Groß/Klein — NICHT normalisieren.
    norm: (s) => (BASE58.test(s) ? s : null),
    link: (id) => `https://solscan.io/tx/${id}`,
    format: 'rund 88 Zeichen (Buchstaben und Ziffern, ohne 0, O, I, l)',
  },
};

/**
 * Transaktions-ID für eine Kette prüfen.
 * @returns {{ ok: true, id, explorer, kette } | { ok: false, kette, format }}
 */
export function pruefeTx(coin, eingabe) {
  const k = KETTEN[String(coin || '').toLowerCase()];
  const roh = String(eingabe || '').trim();
  if (!k) return { ok: false, kette: coin || null, format: null };
  const id = k.norm(roh);
  if (!id) return { ok: false, kette: k.name, format: k.format };
  return { ok: true, id, kette: k.name, explorer: k.link(encodeURIComponent(id)) };
}
