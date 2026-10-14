// ============================================================================
//  Warnungen in Behördenmeldungen erkennen: Fälschung / Rückruf
// ============================================================================
//  Gefälschte und minderwertige Arzneimittel sind eines der größten Probleme
//  in Afrika — NAFDAC, Africa CDC und WHO warnen laufend. Solche Meldungen
//  sollen im News-Feed auffallen und sich filtern lassen.
//
//  Bewusst einfach und ehrlich: eine Stichwort-Erkennung im Text der
//  BEHÖRDENMELDUNG (mit Quelle), keine eigene Aussage. Die Oberfläche sagt
//  „automatisch erkannt — Details in der Quelle". Mehrdeutige Wörter („fake"
//  allein — z. B. „fake news") zählen nur in fester Wendung.
// ============================================================================

const FAELSCHUNG = [
  /\bfalsified\b/i, /\bcounterfeit/i, /\bsubstandard\b/i, /\bfake (?:drugs?|medicines?|products?|vaccines?)\b/i,
  /\bunregistered (?:drugs?|medicines?|products?)\b/i, /\bSF medical products?\b/i,
  /gefälscht/i, /\bfälschung/i, /\bfalsificad[oa]s?\b/i, /\bcontrafeit[oa]s?\b/i, /\bfalsifica[çc][ãa]o\b/i,
];
const RUECKRUF = [
  /\brecall(?:s|ed|ing)?\b/i, /\bwithdrawn from (?:the )?market\b/i, /\bmarket withdrawal\b/i,
  /\brückruf/i, /\bchargenrückruf/i, /\brecolha\b/i, /\bretirad[oa] do mercado\b/i,
];

/** 'faelschung' | 'rueckruf' | null — Fälschung hat Vorrang (gefährlicher). */
export function warnTyp(text) {
  const t = String(text || '');
  if (FAELSCHUNG.some((rx) => rx.test(t))) return 'faelschung';
  if (RUECKRUF.some((rx) => rx.test(t))) return 'rueckruf';
  return null;
}
