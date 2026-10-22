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
  pt: ['Amoxicilina', 'Ibuprofeno', 'Paracetamol', 'Salbutamol', 'Metformina', 'Amlodipina', 'Cefalexina', 'Azitromicina', 'Prednisolona', 'Levotiroxina', 'Insulina', 'Claritromicina'],  fr: ['Amoxicilline', 'Ibuprofène', 'Paracétamol', 'Salbutamol', 'Metformine', 'Amlodipine', 'Céfalexine', 'Azithromycine', 'Prednisolone', 'Lévothyroxine', 'Insuline', 'Clarithromycine'],
};
// Afrika: was dort am häufigsten fehlt und am meisten zählt — Malaria
// (Artemether/Lumefantrin), Mutter-Kind (Oxytocin, Magnesiumsulfat),
// Kinder (Orale Rehydratationssalze, Zink), Infektionen, HIV, Tuberkulose.
// Orientierung an der WHO-Liste unentbehrlicher Arzneimittel.
const HAEUFIG_AFRIKA = {
  en: ['Artemether/Lumefantrine', 'Amoxicillin', 'Oxytocin', 'Oral rehydration salts', 'Zinc sulfate', 'Paracetamol', 'Ceftriaxone', 'Metformin', 'Insulin', 'Salbutamol', 'Magnesium sulfate', 'Rifampicin', 'Tenofovir/Lamivudine/Dolutegravir', 'Gentamicin'],
  pt: ['Artemeter/Lumefantrina', 'Amoxicilina', 'Ocitocina', 'Sais de reidratação oral', 'Sulfato de zinco', 'Paracetamol', 'Ceftriaxona', 'Metformina', 'Insulina', 'Salbutamol', 'Sulfato de magnésio', 'Rifampicina', 'Tenofovir/Lamivudina/Dolutegravir', 'Gentamicina'],  fr: ['Artéméther/Luméfantrine', 'Amoxicilline', 'Ocytocine', 'Sels de réhydratation orale', 'Sulfate de zinc', 'Paracétamol', 'Ceftriaxone', 'Metformine', 'Insuline', 'Salbutamol', 'Sulfate de magnésium', 'Rifampicine', 'Ténofovir/Lamivudine/Dolutégravir', 'Gentamicine'],
};
const MAX = 12;

export function ersteSchritte({ shortagesRepo, land, sprache = 'de', region = null, beobachtet = [] }) {
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
  // Arabisch: Wirkstoffnamen lateinisch (INN, englisch) — so schreiben sie Behörden und
  // Apotheken in Ägypten und im Maghreb, und nur so trifft die Frühwarnung die Behördenlisten.
  const sp = sprache === 'ar' ? 'en' : sprache;
  const liste = region === 'AFRICA' ? (HAEUFIG_AFRIKA[sp] || HAEUFIG_AFRIKA.en) : (HAEUFIG[sp] || HAEUFIG.de);
  for (const w of liste) {
    if (vorschlaege.length >= MAX) break;
    const k = wirkstoffSchluessel(w) || w.toLowerCase();
    if (gesehen.has(k)) continue;
    gesehen.add(k);
    vorschlaege.push({ wirkstoff: w, status: null, quelle: null, beobachtet: schon.has(k) });
  }
  return { land: cc, amtlich: anzahlAmtlich, vorschlaege };
}
