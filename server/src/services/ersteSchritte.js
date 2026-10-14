// ============================================================================
//  Erste Schritte: in 30 Sekunden zum ersten Alarm
// ============================================================================
//  Wer nach der Registrierung keinen Wirkstoff beobachtet, bekommt nie einen
//  Alarm, sieht keinen Nutzen und zahlt nie. Deshalb schlägt ApoPulse zum
//  Antippen vor: zuerst, was im Land GERADE amtlich knapp ist (mit Quelle),
//  dann häufig benötigte Wirkstoffe — diese ausdrücklich OHNE Status, denn
//  ohne Quelle wird nichts als knapp bezeichnet.
// ============================================================================
import { wirkstoffSchluessel } from '../domain/inn.js';

const HAEUFIG = {
  de: ['Amoxicillin', 'Ibuprofen', 'Paracetamol', 'Salbutamol', 'Metformin', 'Amlodipin', 'Cefalexin', 'Azithromycin', 'Prednisolon', 'Levothyroxin', 'Insulin', 'Clarithromycin'],
  en: ['Amoxicillin', 'Ibuprofen', 'Paracetamol', 'Salbutamol', 'Metformin', 'Amlodipine', 'Cefalexin', 'Azithromycin', 'Prednisolone', 'Levothyroxine', 'Insulin', 'Clarithromycin'],
  pt: ['Amoxicilina', 'Ibuprofeno', 'Paracetamol', 'Salbutamol', 'Metformina', 'Amlodipina', 'Cefalexina', 'Azitromicina', 'Prednisolona', 'Levotiroxina', 'Insulina', 'Claritromicina'],
};
const MAX = 12;

export function ersteSchritte({ shortagesRepo, land, sprache = 'de', beobachtet = [] }) {
  const cc = String(land || '').toUpperCase();
  const schon = new Set(beobachtet.map((w) => wirkstoffSchluessel(w) || String(w).toLowerCase()));
  const gesehen = new Set();
  const amtlich = shortagesRepo.list({ country: cc })
    .filter((z) => z.provenance === 'verified' && !z.reporter_user_id && String(z.country || '').toUpperCase() === cc && (z.status === 'kritisch' || z.status === 'eingeschraenkt') && z.wirkstoff)
    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'kritisch' ? -1 : 1));
  const vorschlaege = [];
  for (const z of amtlich) {
    const k = wirkstoffSchluessel(z.wirkstoff) || z.wirkstoff.toLowerCase();
    if (gesehen.has(k)) continue;
    gesehen.add(k);
    vorschlaege.push({ wirkstoff: z.wirkstoff.trim(), status: z.status, quelle: z.quelle || null, beobachtet: schon.has(k) });
    if (vorschlaege.length >= MAX) break;
  }
  const anzahlAmtlich = vorschlaege.length;
  for (const w of HAEUFIG[sprache] || HAEUFIG.de) {
    if (vorschlaege.length >= MAX) break;
    const k = wirkstoffSchluessel(w) || w.toLowerCase();
    if (gesehen.has(k)) continue;
    gesehen.add(k);
    vorschlaege.push({ wirkstoff: w, status: null, quelle: null, beobachtet: schon.has(k) });
  }
  return { land: cc, amtlich: anzahlAmtlich, vorschlaege };
}
