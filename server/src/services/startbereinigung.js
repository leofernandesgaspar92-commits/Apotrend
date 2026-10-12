// ============================================================================
//  Erfundene Startmeldungen aus gesicherten Datenbeständen entfernen
// ============================================================================
//  Bis 10/2026 legte der Frischstart sechs „News" der Redaktion an — z. B.
//  „BASG: Aktualisierte Engpassliste veröffentlicht — mehrere Antibiotika
//  betroffen". Keine davon war eine echte Meldung. Der Code legt sie nicht
//  mehr an; ein Bestand, der sie schon gesichert hat (Datei oder Datenbank),
//  trüge sie aber für immer weiter.
//
//  Deshalb beim Wiederherstellen: genau diese sechs Texte, nur Art „news",
//  nur von Redaktionskonten. Ein Mensch, der einen dieser Sätze selbst
//  gepostet hat, verliert nichts. Läuft bei jedem Start; ein zweiter Lauf
//  findet nichts mehr.
// ============================================================================

export const ERFUNDENE_STARTMELDUNGEN = new Set([
  'Kammer-Mitteilung: Neue Regelung zur E-Medikation tritt am 01.08.2026 in Kraft.',
  'BASG: Aktualisierte Engpassliste veröffentlicht — mehrere Antibiotika betroffen.',
  'Gehaltskasse: Anpassung der Großhandelskonditionen zum Quartalswechsel.',
  'BfArM: Aktualisierte Liste von Lieferengpässen veröffentlicht — mehrere Wirkstoffe betroffen.',
  'E-Rezept: bundesweite Nutzung weiter verpflichtend — Hinweise für Apotheken aktualisiert.',
  'ANVISA: publicada atualização sobre desabastecimento de medicamentos.',
]);

/** @returns {number} Anzahl entfernter Beiträge */
export function erfundeneStartmeldungenEntfernen(socialRepo) {
  let n = 0;
  for (const p of socialRepo.listAllPosts()) {
    if (p.kind !== 'news' || !ERFUNDENE_STARTMELDUNGEN.has(p.body)) continue;
    if (!socialRepo.getProfileByUserId(p.author_user_id)?.is_editorial) continue;
    socialRepo.softDeletePost(p.id);
    n++;
  }
  return n;
}
