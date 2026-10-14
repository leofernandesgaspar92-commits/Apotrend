// ============================================================================
//  Engpasslage je Region und weltweit (drei Ebenen: Land / Region / Welt)
// ============================================================================
//  Eine Apotheke in Kampala will nicht nur wissen, was in Uganda knapp ist,
//  sondern auch: Was ist in Kenia, Tansania, Südafrika knapp — kommt es zu
//  uns? Und was ist WELTWEIT in mehreren Ländern knapp?
//
//  Regeln:
//   - Je Land getrennt: amtliche Engpässe (Behördenliste) und Meldungen aus
//     Apotheken (nicht amtlich) — nie zusammengezählt.
//   - „Keine Behördenliste" ist etwas anderes als „keine Engpässe" und wird so
//     genannt (in großen Teilen Afrikas gibt es keine öffentliche Liste).
//   - „In mehreren Ländern knapp" nur aus amtlichen Listen, über den
//     Wirkstoff-Schlüssel (Amoxicillin = Amoxicilina = amoxicillin), mit den
//     Behörden je Land als Quelle.
// ============================================================================
import { wirkstoffSchluessel } from '../domain/inn.js';
import { BESTAETIGT_AB_APOTHEKEN, aktualitaet } from './shortages.js';

const AKTIV = new Set(['kritisch', 'eingeschraenkt']);

export function regionLage({ shortagesRepo, chronik, laender, codes, heute = new Date().toISOString().slice(0, 10) }) {
  const alle = shortagesRepo.list();
  const proLand = [];
  const jeWirkstoff = new Map(); // schluessel -> { name, laender: Map(cc -> { status, quelle }) }
  for (const cc of codes) {
    const zeilen = alle.filter((z) => String(z.country || '').toUpperCase() === cc && AKTIV.has(z.status) && z.wirkstoff);
    const amtlich = zeilen.filter((z) => z.provenance === 'verified' && !z.reporter_user_id);
    // Veraltete Apotheken-Meldungen (30+ Tage ohne Bestätigung) zählen nicht mehr.
    const apotheken = zeilen.filter((z) => z.provenance === 'community' && aktualitaet(z, heute).stufe !== 'veraltet');
    const amtlichW = new Set(); const apoW = new Set();
    for (const z of amtlich) {
      const k = wirkstoffSchluessel(z.wirkstoff) || z.wirkstoff.toLowerCase();
      amtlichW.add(k);
      if (!jeWirkstoff.has(k)) jeWirkstoff.set(k, { name: z.wirkstoff.trim(), laender: new Map() });
      const e = jeWirkstoff.get(k).laender;
      const vorher = e.get(cc);
      if (!vorher || (z.status === 'kritisch' && vorher.status !== 'kritisch')) e.set(cc, { status: z.status, quelle: z.quelle || laender[cc]?.regulator || null });
    }
    const apoBest = new Set();
    for (const z of apotheken) {
      const k = wirkstoffSchluessel(z.wirkstoff) || z.wirkstoff.toLowerCase();
      apoW.add(k);
      if (1 + (z.confirmations || []).length >= BESTAETIGT_AB_APOTHEKEN) apoBest.add(k);
    }
    proLand.push({
      land: cc, behoerde: laender[cc]?.regulator || null,
      behoerdenliste: !!chronik.aufzeichnungSeit(cc),
      amtlich: amtlichW.size, apotheken: apoW.size, apotheken_bestaetigt: apoBest.size,
      kritisch: new Set(amtlich.filter((z) => z.status === 'kritisch').map((z) => wirkstoffSchluessel(z.wirkstoff) || z.wirkstoff.toLowerCase())).size,
    });
  }
  // Länder mit Daten zuerst (amtlich, dann Meldungen), dann alphabetisch.
  proLand.sort((a, b) => (Number(b.behoerdenliste) - Number(a.behoerdenliste)) || (b.amtlich - a.amtlich) || (b.apotheken - a.apotheken) || a.land.localeCompare(b.land));
  const mehrere = [...jeWirkstoff.values()]
    .filter((w) => w.laender.size >= 2)
    .map((w) => ({ wirkstoff: w.name, laender: [...w.laender].map(([land, x]) => ({ land, ...x })).sort((a, b) => a.land.localeCompare(b.land)) }))
    .sort((a, b) => b.laender.length - a.laender.length || a.wirkstoff.localeCompare(b.wirkstoff))
    .slice(0, 30);
  return {
    laender: proLand,
    mehrere_laender: mehrere,
    mit_behoerdenliste: proLand.filter((l) => l.behoerdenliste).length,
  };
}
