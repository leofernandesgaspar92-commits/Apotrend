// ============================================================================
//  Telefonnummern: Ländervorwahl und Normalform (E.164)
// ============================================================================
//  Wer sich per SMS anmeldet, tippt die Nummer so, wie sie auf der Visitenkarte
//  steht: „0772 123 456" (Uganda), „77 123 45 67" (Senegal), „+254 712 …".
//  Daraus wird „+256772123456" — eine Nummer, ein Konto.
//
//  Regeln:
//    - „+…" oder „00…": schon international, nur Ziffern behalten.
//    - sonst: führende 0 (Verkehrsausscheidungsziffer) weg, Landesvorwahl davor.
//      Ausnahme Côte d'Ivoire: Seit 2021 gehört die führende 0 zur Nummer
//      (+225 07 …), sie bleibt stehen.
//    - Gültig sind 8 bis 15 Ziffern nach dem „+" (E.164).
//  Vorwahlen nach ITU-T E.164 (Zuweisungsliste), für alle Länder des Registers.
// ============================================================================

export const VORWAHL = Object.freeze({
  AT: '43', DE: '49', CH: '41', LI: '423', PT: '351', BR: '55', AO: '244', MZ: '258', GB: '44', US: '1',
  NG: '234', KE: '254', GH: '233', CA: '1', AU: '61', ZA: '27', UG: '256', TZ: '255', ZM: '260', ZW: '263',
  RW: '250', BW: '267', NA: '264', MW: '265', ET: '251', SL: '232', LR: '231', GM: '220', LS: '266', SZ: '268',
  MU: '230', SC: '248', SS: '211', ER: '291', CV: '238', GW: '245', ST: '239', SN: '221', CI: '225', CM: '237',
  CD: '243', CG: '242', GA: '241', BF: '226', ML: '223', NE: '227', TD: '235', CF: '236', BJ: '229', TG: '228',
  GN: '224', MG: '261', BI: '257', DJ: '253', KM: '269', MR: '222', MA: '212', DZ: '213', TN: '216', EG: '20',
  LY: '218', SD: '249', SO: '252', GQ: '240',
});
const NULL_GEHOERT_DAZU = new Set(['CI']);

/** Eingabe + Land → „+<Ziffern>" oder null, wenn keine gültige Nummer daraus wird. */
export function normalisiereTelefon(eingabe, land) {
  const roh = String(eingabe ?? '').trim();
  if (!roh || roh.length > 40) return null;
  let ziffern;
  if (roh.startsWith('+')) ziffern = roh.slice(1).replace(/\D/g, '');
  else if (/^00/.test(roh.replace(/[\s.\-()]/g, ''))) ziffern = roh.replace(/\D/g, '').slice(2);
  else {
    const vw = VORWAHL[String(land || '').toUpperCase()];
    if (!vw) return null;
    let n = roh.replace(/\D/g, '');
    if (!NULL_GEHOERT_DAZU.has(String(land).toUpperCase())) n = n.replace(/^0+/, '');
    ziffern = vw + n;
  }
  if (!/^[1-9]\d{7,14}$/.test(ziffern)) return null;
  return '+' + ziffern;
}
