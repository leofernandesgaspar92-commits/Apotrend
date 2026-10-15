// ============================================================================
//  Regionale Preise für Premium (Kaufkraft) — eine Einstellung, keine Preisliste
// ============================================================================
//  9,99 €/Monat sind in Uganda rund 40 000 UGX — für eine kleine Apotheke eine
//  andere Hürde als in Wien. Wie viel günstiger, entscheidet der Betreiber;
//  hier steht nur die Technik dafür:
//
//    APOPULSE_PREISE_REGION="AFRICA:30"        Premium in Afrika: 30 % des Preises
//    APOPULSE_PREISE_REGION="AFRICA:30,AMERICAS:80"
//
//  Regeln:
//   - Nur Ermäßigungen (1–100 %), nie teurer. Ungültiges wird ignoriert.
//   - Nur Premium (feature 'premium'). Business (Großhandel, Ketten) und
//     Anzeigen bleiben beim Listenpreis.
//   - Maßgeblich ist das HEIMATLAND des Kontos, nicht das gerade angesehene
//     Land — sonst stellte jemand in Wien die Ansicht auf Uganda und zahlte
//     den Afrika-Preis.
//   - Ohne Einstellung: unverändert. Abgerechnet wird weiter in der
//     Produktwährung (EUR); Krypto, Überweisung, Karte und Rechnung nutzen
//     denselben Betrag.
// ============================================================================

const REGIONEN = new Set(['AFRICA', 'EUROPE', 'AMERICAS', 'OCEANIA']);

/** "AFRICA:30,AMERICAS:80" -> Map { AFRICA => 30, AMERICAS => 80 } */
export function regionFaktoren(roh) {
  const m = new Map();
  for (const teil of String(roh || '').split(',')) {
    const x = teil.trim().match(/^([A-Za-z]+)\s*:\s*(\d{1,3})\s*%?$/);
    if (!x) continue;
    const region = x[1].toUpperCase(); const prozent = Number(x[2]);
    if (REGIONEN.has(region) && prozent >= 1 && prozent <= 100) m.set(region, prozent);
  }
  return m;
}

/** Preis eines Produkts in Cent für eine Region (Region des Heimatlands). */
export function preisCents(product, region, faktoren) {
  const basis = Number(product && product.amount_cents) || 0;
  if (!product || product.feature !== 'premium' || !region || !faktoren || !faktoren.has(region)) return basis;
  return Math.max(1, Math.round(basis * faktoren.get(region) / 100));
}
