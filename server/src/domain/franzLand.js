// ============================================================================
//  Französische Präposition vor Ländernamen
// ============================================================================
//  „en {land}" ergibt für die Hälfte des frankophonen Afrikas falsches
//  Französisch: „en Sénégal", „en Cameroun", „en Mali". Richtig ist „au
//  Sénégal", aber „en Côte d'Ivoire", „aux Comores", „à Madagascar". Für
//  Apothekerinnen in Dakar liest sich der Fehler wie eine maschinelle
//  Übersetzung — und genau dann vertraut man den Engpass-Angaben weniger.
//
//  Regeln (Grammatik der Ländernamen, nicht geraten):
//    - Inselstaaten ohne Artikel        -> à / de       (à Maurice, de Madagascar)
//    - Plural                           -> aux / des    (aux Comores, des Seychelles)
//    - Vokal am Anfang                  -> en / d'      (en Ouganda, d'Égypte)
//    - „République …"                   -> en / de la   (en République centrafricaine)
//    - feminin (endet auf -e)           -> en / de      (en Guinée, de Tunisie)
//    - sonst maskulin                   -> au / du      (au Sénégal, du Cameroun)
//  „pour" setzt den Artikel: pour le Sénégal, pour la Guinée, pour l’Égypte,
//  pour les Comores, pour Maurice.
//  Ausnahmen maskulin trotz -e: Mozambique, Zimbabwe, Cambodge, Mexique, Belize,
//  Royaume-Uni. Bei Bindestrich-Namen zählt der erste Teil: au Congo-Brazzaville,
//  au Cap-Vert, aber en Guinée-Bissau.
//
//  Der Name darf eine Flagge davor haben („🇸🇳 Sénégal") — sie bleibt stehen.
//  public/app.js trägt eine Kopie (FR_LAND); test/franzoesisch.test.js hält
//  beide gleich.
// ============================================================================

export const FR_LAND = {
  insel: ['Maurice', 'Madagascar', 'Djibouti', 'Sao Tomé-et-Principe', 'São Tomé-et-Principe', 'Malte', 'Chypre', 'Singapour', 'Cuba', 'Monaco', 'Bahreïn'],
  plural: ['Comores', 'Seychelles', 'États-Unis', 'Pays-Bas', 'Philippines', 'Émirats arabes unis', 'Maldives'],
  maskulinE: ['Mozambique', 'Zimbabwe', 'Cambodge', 'Mexique', 'Belize', 'Royaume-Uni'],
};

/** Präposition + Name. art: 'dans' (au/en/aux/à), 'de' (du/de/des/d') oder 'pour' (pour le/la/l'/les). */
export function frLand(text, art = 'dans') {
  const s = String(text ?? '');
  const m = s.match(/^([^\p{L}]*)(.*)$/u);
  const vor = m[1]; const name = m[2].trim();
  if (!name) return s;
  if (art === 'pour') {
    // „pour" braucht den Artikel: pour le Sénégal, la Guinée, l’Égypte, les Comores — Inseln ohne.
    let a;
    if (FR_LAND.insel.includes(name)) a = '';
    else if (FR_LAND.plural.includes(name)) a = 'les ';
    else if (/^[AEIOUYÉÈÊÎÔÂ]/i.test(name)) a = 'l’';
    else if (/^République\b/.test(name)) a = 'la ';
    else if (/e$/.test(name.split('-')[0]) && !FR_LAND.maskulinE.includes(name)) a = 'la ';
    else a = 'le ';
    return 'pour ' + a + vor + name;
  }
  const dans = art !== 'de';
  let p;
  if (FR_LAND.insel.includes(name)) p = dans ? 'à ' : 'de ';
  else if (FR_LAND.plural.includes(name)) p = dans ? 'aux ' : 'des ';
  else if (/^[AEIOUYÉÈÊÎÔÂ]/i.test(name)) p = dans ? 'en ' : 'd’';
  else if (/^République\b/.test(name)) p = dans ? 'en ' : 'de la ';
  else if (/e$/.test(name.split('-')[0]) && !FR_LAND.maskulinE.includes(name)) p = dans ? 'en ' : 'de ';
  else p = dans ? 'au ' : 'du ';
  // Die Flagge gehört zum Namen: „au 🇸🇳 Sénégal".
  return p + vor + name;
}
