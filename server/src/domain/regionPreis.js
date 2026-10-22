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
//  STANDARD seit 22.10.2026 (Owner: „entscheid du"): AFRICA:30 — Premium für
//  Konten mit Heimatland in Afrika kostet 30 % des Listenpreises (3,00 € statt
//  9,99 €/Monat, ≈ 12 000 statt 42 000 UGX). Begründung: Kaufkraft (BIP je
//  Einwohner in Uganda, Kenia, Nigeria ein Bruchteil Österreichs); große
//  Abo-Dienste liegen in vergleichbaren Märkten bei rund 25–40 % des EU-Preises.
//  Die Variable überschreibt den Standard: andere Werte („AFRICA:40") oder
//  „aus" = überall Listenpreis.
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

export const PREISE_REGION_STANDARD = 'AFRICA:30';

/** Faktoren aus der Umgebung: Variable gesetzt → sie gilt (auch „aus"/leer); sonst Standard. */
export function faktorenAusUmgebung(env = process.env) {
  return regionFaktoren(env.APOPULSE_PREISE_REGION === undefined ? PREISE_REGION_STANDARD : env.APOPULSE_PREISE_REGION);
}

/** Preis eines Produkts in Cent für eine Region (Region des Heimatlands). */
export function preisCents(product, region, faktoren) {
  const basis = Number(product && product.amount_cents) || 0;
  if (!product || product.feature !== 'premium' || !region || !faktoren || !faktoren.has(region)) return basis;
  return Math.max(1, Math.round(basis * faktoren.get(region) / 100));
}
