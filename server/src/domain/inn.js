// ============================================================================
//  Wirkstoff-Schlüssel über Länder und Sprachen hinweg
// ============================================================================
//  Dieselbe Substanz heißt je nach Behörde anders:
//    BASG  „Amoxicillin"        BfArM „Amoxicillin-Trihydrat"
//    FDA   „Amoxicillin"        Infarmed „Amoxicilina"
//    FDA   „Albuterol Sulfate"  BASG „Salbutamol"
//  Für Chronik und Frühwarnung müssen diese Namen auf EINEN Schlüssel fallen —
//  sonst sieht die Frühwarnung den deutschen Engpass eines in Österreich
//  beobachteten Wirkstoffs nicht.
//
//  Die Gegenrichtung ist wichtiger: Zwei VERSCHIEDENE Arzneimittel dürfen nie
//  denselben Schlüssel bekommen. Kaliumchlorid ist nicht Kaliumcitrat,
//  Prednison nicht Prednisolon. Deshalb ist jede Regel eng:
//
//   1. SALZ- UND HYDRATZUSÄTZE fallen weg („-Trihydrat", „Sulfate",
//      „Hydrochlorid") — aber nur, wenn danach noch ein Wirkstoff übrig ist,
//      der selbst KEIN Kation ist. „Kaliumchlorid" bleibt „Kaliumchlorid".
//   2. SCHREIBVARIANTEN: Akzente, ph/f, th/t, y/i, k/c, doppelte Buchstaben und
//      Endvokale („Cefuroxim" / „Cefuroxime" / „Cefuroxima"). Auf BEIDE
//      Seiten gleich angewandt — es entsteht ein Vergleichsschlüssel, kein Name.
//   3. SYNONYME nur, wo US-Name und internationaler Name (INN) belegt
//      verschieden sind (Acetaminophen = Paracetamol, Albuterol = Salbutamol).
//   4. KOMBINATIONEN bleiben Kombinationen: „Amoxicillin/Clavulansäure" ist
//      nicht „Amoxicillin". Bestandteile werden sortiert, damit die Reihenfolge
//      keine Rolle spielt.
//
//  Der Schlüssel wird nie angezeigt. Angezeigt wird, was die Behörde schrieb.
// ============================================================================

// Anionen, Hydrat- und Salzformen — als eigenes Wort oder angehängt.
const SALZ = [
  'trihydrat', 'trihydrate', 'dihydrat', 'dihydrate', 'monohydrat', 'monohydrate', 'hemihydrat', 'hemihydrate',
  'sesquihydrat', 'hydrat', 'hydrate', 'anhydrat', 'anhydrous', 'wasserfrei',
  'hydrochlorid', 'hydrochloride', 'hcl', 'dihydrochlorid', 'dihydrochloride', 'hydrobromid', 'hydrobromide',
  'sulfat', 'sulfate', 'sulphate', 'hemisulfat', 'phosphat', 'phosphate', 'natriumphosphat',
  'succinat', 'succinate', 'tartrat', 'tartrate', 'maleat', 'maleate', 'mesilat', 'mesylate', 'besilat', 'besylate',
  'citrat', 'citrate', 'acetat', 'acetate', 'fumarat', 'fumarate', 'hyclat', 'hyclate', 'bromid', 'bromide',
  'chlorid', 'chloride', 'lactat', 'lactate', 'gluconat', 'gluconate', 'tosilat', 'tosylate', 'pamoat', 'pamoate',
  'lysinat', 'lysinate', 'dipropionat', 'dipropionate', 'propionat', 'propionate', 'valerat', 'valerate', 'stearat', 'stearate',
  'natrium', 'sodium', 'sodico', 'kalium', 'potassium', 'potassico', 'calcium', 'calcico', 'magnesium',
];
// Kationen: Bleibt nur so etwas übrig, war der „Zusatz" der Wirkstoff.
const KATION = new Set(['natrium', 'sodium', 'sodico', 'kalium', 'potassium', 'potassico', 'calcium', 'calcico', 'magnesium', 'lithium', 'zink', 'zinc', 'eisen', 'iron']);
const SALZ_SET = new Set(SALZ);
const EINHEIT = new Set(['mg', 'g', 'kg', 'ml', 'l', 'ug', 'mcg', 'µg', 'ie', 'iu', 'i.e.', 'mmol', 'mval', '%', 'units', 'einheiten']);
// Längste zuerst, damit „dihydrochlorid" vor „chlorid" greift.
const SALZ_ENDUNGEN = [...SALZ].filter((s) => !KATION.has(s)).sort((a, b) => b.length - a.length);

// Belegte Namensunterschiede US (USAN) / international (INN). Werte und
// Schlüssel laufen durch dieselbe Faltung wie alle Namen.
const SYNONYME = {
  acetaminophen: 'paracetamol', albuterol: 'salbutamol', levalbuterol: 'levosalbutamol',
  epinephrine: 'adrenalin', norepinephrine: 'noradrenalin', lignocaine: 'lidocaine',
  meperidine: 'pethidin', glyburide: 'glibenclamid', isoproterenol: 'isoprenalin',
  cyclosporine: 'ciclosporin', frusemide: 'furosemid', rifampin: 'rifampicin', dipyrone: 'metamizol',
  amoxycillin: 'amoxicillin',
};

const falten = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/ß/g, 'ss');

function laut(w) {
  let s = w.replace(/ph/g, 'f').replace(/th/g, 't').replace(/y/g, 'i').replace(/k/g, 'c').replace(/^oe/, 'e').replace(/ae/g, 'e');
  s = s.replace(/(.)\1+/g, '$1');               // doppelte Buchstaben
  if (s.length > 5) s = s.replace(/[aeo]+$/, ''); // Endvokal: -e (EN), -a/-o (PT/ES)
  return s;
}

function bestandteil(roh) {
  // Stärken und Einheiten („400 mg", „5 µg/ml") gehören nicht zum Namen.
  let woerter = roh.split(/[\s\-_.()]+/).filter(Boolean).filter((w) => !/^\d/.test(w) && !EINHEIT.has(w));
  // Regel 1a: Salz als eigenes Wort — nur, wenn ein Nicht-Salz-Wort bleibt.
  const kern = woerter.filter((w) => !SALZ_SET.has(w));
  if (kern.length && kern.some((w) => !KATION.has(w))) woerter = kern;
  // Regel 1b: angehängtes Salz („metoprololsuccinat") — nur, wenn der Rest
  // lang genug und selbst kein Kation ist („kaliumchlorid" bleibt).
  woerter = woerter.map((w) => {
    for (const end of SALZ_ENDUNGEN) {
      if (w.length > end.length && w.endsWith(end)) {
        const rest = w.slice(0, -end.length);
        if (rest.length >= 5 && !KATION.has(rest)) return rest;
        break;
      }
    }
    return w;
  });
  let k = lautWoerter(woerter);
  if (SYN.has(k)) k = SYN.get(k);
  return k;
}

// Lautregeln JE WORT, dann zusammensetzen. Vorher erst nach dem Zusammensetzen:
// Der Endvokal fiel nur am Ende des ganzen Namens weg, „Cefuroxime Axetil" (FDA)
// und „Cefuroxim-Axetil" (BfArM) bekamen verschiedene Schlüssel — derselbe
// Engpass zählte als zwei Wirkstoffe. Doppelbuchstaben an der Wortgrenze
// werden wie bisher zusammengezogen.
function lautWoerter(woerter) { return woerter.map(laut).join('').replace(/(.)\1+/g, '$1'); }

const SYN = new Map(Object.entries(SYNONYME).map(([a, b]) => [lautWoerter(falten(a).split(/[\s\-_.()]+/).filter(Boolean)), lautWoerter(falten(b).split(/[\s\-_.()]+/).filter(Boolean))]));

/** Vergleichsschlüssel eines Wirkstoffnamens; '' wenn nichts Verwertbares. */
export function wirkstoffSchluessel(name) {
  const f = falten(name).trim();
  if (!f) return '';
  const teile = f.split(/\s*(?:[;+\/]|,|\bund\b|\band\b|\bwith\b|\bmit\b|\be\b|\by\b)\s*/).map((t) => t.trim()).filter(Boolean);
  const keys = [...new Set(teile.map(bestandteil).filter(Boolean))].sort();
  return keys.join('+');
}

/** Gleiche Substanz (bzw. gleiche Kombination)? */
export function gleicherWirkstoff(a, b) {
  const ka = wirkstoffSchluessel(a);
  return !!ka && ka === wirkstoffSchluessel(b);
}
