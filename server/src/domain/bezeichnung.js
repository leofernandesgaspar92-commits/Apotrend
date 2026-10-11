// ============================================================================
//  Bedeutungstragende Wörter einer Präparat-Bezeichnung
// ============================================================================
//  Grundlage des Tausch-Matchings: Zwei Einträge passen, wenn sie ein
//  bedeutungstragendes Wort teilen. Das steht und fällt damit, was als
//  „bedeutungstragend" gilt — ein Darreichungswort darf es nicht sein, sonst
//  passt jedes Metformin-Gesuch zu jedem Amoxicillin-Angebot, solange beide
//  „Tabletten" sind.
//
//  Gemessen vor dieser Datei, mit 12 realistischen Paaren: 10 falsch.
//
//   · Portugiesisch und Englisch kamen nicht vor. „Comprimidos", „solução",
//     „tablets", „oral" verbanden beliebige Wirkstoffe — in Portugal, Angola,
//     Moçambique und allen englischsprachigen Märkten.
//   · Das Zeichenmuster `[a-zäöüß0-9]` kannte nur deutsche Umlaute. „Solução"
//     zerfiel in „solu" + „o", „Ácido" wurde zu „cido" — Wortreste, die
//     ebenfalls beliebige Einträge verbanden.
//   · Ein Akzent trennte, was zusammengehört: „Ácido acetilsalicílico" und
//     „Acido acetilsalicilico" (ohne Akzente getippt) teilten kein Wort.
//   · Auch DEUTSCH war lückenhaft: „Augentropfen", „Nasenspray" (Komposita)
//     und „Lösung zum Einnehmen" (Füllwort) verbanden fremde Wirkstoffe.
//
//  ──────────────────────────────────────────────────────────────────────────
//  DIE VIER REGELN
//  ──────────────────────────────────────────────────────────────────────────
//   1. FALTEN: klein, Akzente weg (NFD, Kombinationszeichen entfernen).
//      „Ácido" = „acido", „Lösung" = „losung". Ein fehlender Akzent ist ein
//      Tippweg, kein anderer Wirkstoff.
//   2. UNICODE: Wörter sind `\p{L}`/`\p{N}`, nicht ein deutsches Alphabet.
//   3. FORMWÖRTER in DE/PT/EN, plus Komposita: Ein Wort, das auf ein
//      Formwort (≥ 4 Zeichen) ENDET, ist selbst eines — „Augentropfen",
//      „Nasenspray", „Infusionslösung". Endungen, weil das deutsche
//      Kompositum die Darreichung hinten trägt; Wirkstoffnamen (INN) enden
//      auf -ol, -in, -at, -mab und kollidieren damit nicht.
//   4. STÄRKEN sind keine Bedeutung: „500mg" verbindet sonst Metformin
//      und Amoxicillin genauso wie „500" allein.
// ============================================================================

/** Klein, Akzente weg. Die gemeinsame Schreibweise für jeden Vergleich. */
export function falten(s) {
  return String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Darreichungs- und Packungswörter. Werden beim Anlegen gefaltet, damit
 * „zäpfchen", „zaepfchen" und „zapfchen" alle erkannt werden.
 */
const FORM_ROH = [
  // Deutsch
  'tablette', 'tabletten', 'filmtablette', 'filmtabletten', 'brausetablette', 'brausetabletten',
  'kapsel', 'kapseln', 'hartkapseln', 'weichkapseln', 'dragee', 'dragees', 'retard', 'retardtabletten',
  'saft', 'sirup', 'tropfen', 'creme', 'salbe', 'lösung', 'loesung', 'spray', 'granulat', 'pulver',
  'ampulle', 'ampullen', 'injektion', 'zäpfchen', 'zaepfchen', 'suppositorien', 'pflaster',
  'packung', 'packungen', 'stück', 'stueck', 'flasche', 'flaschen', 'beutel', 'gramm', 'milligramm',
  'milliliter', 'liter', 'dosis', 'dosierung', 'stärke', 'staerke',
  'suspension', 'emulsion', 'inhalation', 'aerosol', 'spritze', 'spritzen', 'fertigspritze',
  'gel', 'lotion', 'shampoo', 'tube', 'tuben', 'dose', 'pen', 'pens',
  // Portugiesisch
  'comprimido', 'comprimidos', 'revestido', 'revestidos', 'efervescente', 'efervescentes',
  'cápsula', 'cápsulas', 'xarope', 'gotas', 'pomada', 'solução', 'soluções', 'suspensão',
  'injetável', 'injectável', 'ampola', 'ampolas', 'frasco', 'frascos', 'embalagem', 'embalagens',
  'unidade', 'unidades', 'saqueta', 'saquetas', 'supositório', 'supositórios', 'adesivo', 'adesivos',
  'granulado', 'pó', 'seringa', 'seringas', 'creme', 'bisnaga',
  // Englisch
  'tablet', 'tablets', 'capsule', 'capsules', 'caplet', 'caplets', 'syrup', 'drops', 'ointment',
  'cream', 'solution', 'injection', 'ampoule', 'ampoules', 'vial', 'vials', 'bottle', 'bottles',
  'sachet', 'sachets', 'suppository', 'suppositories', 'patch', 'patches', 'powder', 'granules',
  'effervescent', 'syringe', 'syringes', 'inhaler', 'pack', 'packs', 'units',
];

/**
 * Füllwörter, die in Bezeichnungen ständig vorkommen und nichts über den
 * Wirkstoff sagen. Nur ≥ 4 Zeichen nötig — Kürzeres fällt ohnehin heraus.
 *
 * „acido"/„acid"/„säure" stehen hier, weil „Ácido fólico" und „Ácido
 * acetilsalicílico" sonst über „ácido" zusammenfänden. Im Deutschen hängt
 * „-säure" am Wort (Folsäure), dort trennt sie ohnehin nichts.
 */
const FUELL_ROH = [
  // Deutsch
  'einnehmen', 'herstellung', 'einer', 'eines', 'für', 'fuer', 'oder', 'ohne', 'mit', 'oral', 'zur',
  'anwendung', 'haut', 'nase', 'auge', 'augen', 'säure',
  // Portugiesisch
  'para', 'oral', 'uso', 'cutâneo', 'cutaneo', 'nasal', 'ocular', 'ácido', 'acido', 'revestida', 'revestidas',
  'película', 'libertação', 'prolongada', 'modificada',
  // Englisch
  'oral', 'with', 'film', 'coated', 'extended', 'release', 'modified', 'acid', 'nasal', 'topical', 'eye',
];

const FORM = new Set(FORM_ROH.map(falten));
const FUELL = new Set(FUELL_ROH.map(falten));
// Für die Kompositum-Regel keine Dreibuchstaben-Formwörter: Ein „gel" oder
// „pen" am Wortende träfe sonst „Nagel" oder „Aspen". Ab vier Zeichen, damit
// „Hustensaft" und „Trockensaft" erkannt werden. Gegen eine Liste gängiger
// Wirkstoffnamen geprüft (test/bezeichnung.test.js) — keiner wird verworfen.
const FORM_ENDUNGEN = [...FORM].filter((w) => w.length >= 4);

/** Stärke/Menge: „500", „500mg", „0,5ml", „100ie", „20%". */
const STAERKE = /^\d+(?:[.,]\d+)?(?:mg|g|mcg|µg|ug|ml|l|ie|iu|ui|%|st|stk)?$/u;

/** Ist das (gefaltete) Wort ein Darreichungs-, Füll- oder Stärkewort? */
export function istFormwort(w) {
  if (FORM.has(w) || FUELL.has(w) || STAERKE.test(w)) return true;
  return FORM_ENDUNGEN.some((e) => w.length > e.length && w.endsWith(e));
}

/**
 * Bedeutungstragende Wörter, gefaltet → Schreibweise wie eingegeben.
 *
 * Die Schreibweise wird mitgeführt, damit eine Oberfläche, die das Wort als
 * Suchbegriff einsetzt, „acetilsalicílico" zeigt und nicht die gefaltete Form.
 */
export function bedeutungsWoerter(text) {
  const out = new Map();
  const roh = String(text ?? '').normalize('NFC').toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || [];
  for (const wort of roh) {
    const f = falten(wort);
    if (f.length < 4 || istFormwort(f)) continue;
    if (!out.has(f)) out.set(f, wort);
  }
  return out;
}
