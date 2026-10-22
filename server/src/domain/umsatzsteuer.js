// ============================================================================
//  Umsatzsteuer auf Rechnungen: Empfänger außerhalb der EU
// ============================================================================
//  Mit APOPULSE_UST_SATZ (z. B. 20) wies jede Rechnung diese Steuer aus — auch
//  für eine Apotheke in Uganda oder eine Firma in Nairobi. Bei Anzeigen (Netto-
//  preise) zahlten sie dadurch 20 % mehr, bei Tarifen (Endpreise) hätte der
//  Betreiber 20 % österreichische Steuer auf afrikanische Umsätze abgeführt.
//
//  Für Dienstleistungen an Empfänger außerhalb der EU liegt der Leistungsort
//  beim Empfänger: an Unternehmen nach der Grundregel (Art. 44 MwSt-System-
//  richtlinie, AT § 3a Abs. 6 UStG), an Privatpersonen außerhalb der EU u. a.
//  für elektronisch erbrachte Leistungen (Art. 59). Die Leistung ist dann in der
//  EU nicht steuerbar; die Rechnung trägt einen Hinweis statt einer Steuer.
//
//  Grenzen (bewusst): Fehlt das Land oder ist es kein Ländercode, bleibt die
//  Steuer (vorsichtig). Innergemeinschaftliches Reverse Charge (EU-Firma mit
//  UID) ist NICHT Teil dieser Regel — das klärt die Steuerberatung
//  (docs/RECHNUNGEN.md). Steuern im Land des Empfängers (z. B. Umsatzsteuer
//  auf digitale Leistungen in Kenia) sind Sache des Betreibers.
//  Altes Verhalten (Steuer auch außerhalb der EU): APOPULSE_UST_DRITTLAND=mit.
// ============================================================================

// EU-Mitgliedstaaten (ISO 3166-1; Griechenland hier GR, nicht das Steuerkürzel EL).
export const EU_LAENDER = new Set(['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU',
  'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK']);

/**
 * Steuersatz für einen Empfänger.
 * @returns {{ satz: number, hinweis: null | 'drittland' }}
 */
export function ustFuerEmpfaenger(satz, land, { drittlandMitSteuer = false } = {}) {
  const s = Number(satz) || 0;
  if (!s) return { satz: 0, hinweis: null };
  const l = String(land || '').trim().toUpperCase();
  if (!drittlandMitSteuer && /^[A-Z]{2}$/.test(l) && !EU_LAENDER.has(l)) return { satz: 0, hinweis: 'drittland' };
  return { satz: s, hinweis: null };
}
