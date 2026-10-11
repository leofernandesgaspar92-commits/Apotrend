// ============================================================================
//  Gehört eine Zeile zu einem Land?
// ============================================================================
//  Dieselbe Regel, die die Repositories für Engpässe, Preise und Rabatte schon
//  anwenden (`listComparisons`, `listTop10`, `shortagesRepo.list`) — hier
//  einmal benannt für die Stellen, die sie selbst anwenden müssen (Suche,
//  Benachrichtigungen).
//
//   · Kein Land angefragt  -> alles (das ist der Aufrufer, der „alle" meint).
//   · Zeile ohne Land      -> gilt überall (Altbestand, länderlose Einträge).
//   · sonst                -> gleiches Land, sonst nicht.
//
//  Zwei Länder sind im Spiel, und sie dürfen sich nicht vertauschen:
//
//   ANGESEHENES Land  bestimmt die ANZEIGE. Wer auf Angola umschaltet, will
//                     Angola sehen (`?country=` der Anfrage).
//   HEIMATLAND        bestimmt BENACHRICHTIGUNGEN und Rechts-Gates. Eine
//                     Push-Meldung „kritisch" oder „−22 %" meint den eigenen
//                     Markt; eine Aktion in Österreich kann eine Schweizer
//                     Apotheke nicht kaufen.
// ============================================================================

export function gehoertZuLand(zeile, land) {
  const cc = land ? String(land).toUpperCase() : null;
  if (!cc) return true;
  const z = zeile && zeile.country ? String(zeile.country).toUpperCase() : null;
  return !z || z === cc;
}
