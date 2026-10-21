// Antibiotic-Stewardship-Infodienst — REIN INFORMATIV.
//
// WICHTIG (regulatorische Leitplanke): Dieser Dienst gibt KEINE
// patientenindividuelle Therapieempfehlung aus und ist keine klinische
// Entscheidungsunterstützung. Er erkennt nur, ob ein Wirkstoff ein (allgemein
// bekanntes) Antibiotikum ist, um dann quellenbelegte, allgemeine Hinweise zum
// verantwortungsvollen Antibiotikaeinsatz samt offiziellen Quellen anzuzeigen.
// Es werden bewusst KEINE wirkstoffspezifischen klinischen Aussagen (Spektrum,
// Indikation, Dosierung) getroffen.
//
// Seit 10/2026: Hinweistext übersetzt die Oberfläche (wk_amr_note /
// wk_amr_disclaimer in i18n.js). Vorher stand er fest auf Deutsch im Dienst,
// und eine Apotheke in Uganda bekam „Antibiotika gezielt … einsetzen" samt
// österreichischem Resistenzbericht (AURES) als einziger Quelle. Jetzt: Quellen
// passend zum angesehenen Land — Österreich behält AGES/AURES, alle anderen
// bekommen die weltweit gültigen WHO-Quellen (AWaRe-Antibiotikabuch: Auswahl
// nach Access/Watch/Reserve, abgestimmt auf die WHO-Liste unentbehrlicher
// Arzneimittel; WHO-Faktenblatt Antibiotikaresistenz).

import { wirkstoffSchluessel } from '../domain/inn.js';
import { normalizeLocale } from '../data/countries.js';

// Kuratierte Liste gängiger Antibiotika-Wirkstoffe. Dient ausschließlich der
// Entscheidung, ob das Info-Panel gezeigt wird. Erkannt wird über den
// sprachübergreifenden Wirkstoff-Schlüssel (domain/inn.js): „Ceftriaxon",
// „Ceftriaxone" und „Ceftriaxona" sind derselbe Eintrag. Zusätzlich Antibiotika
// der WHO-Liste unentbehrlicher Arzneimittel, die in Afrika gängig sind.
const ANTIBIOTICS = [
  'amoxicillin', 'ampicillin', 'flucloxacillin', 'cloxacillin', 'dicloxacillin',
  'penicillin', 'phenoxymethylpenicillin', 'benzylpenicillin', 'piperacillin',
  'clarithromycin', 'azithromycin', 'erythromycin', 'roxithromycin', 'clindamycin',
  'doxycyclin', 'tetracyclin', 'minocyclin', 'tigecyclin',
  'ciprofloxacin', 'levofloxacin', 'moxifloxacin', 'norfloxacin', 'ofloxacin',
  'cefalexin', 'cefaclor', 'cefuroxim', 'cefpodoxim', 'ceftriaxon', 'cefixim', 'cefazolin',
  'cefotaxim', 'ceftazidim', 'cefepim',
  'trimethoprim', 'cotrimoxazol', 'sulfamethoxazol', 'co-trimoxazole',
  'nitrofurantoin', 'fosfomycin', 'metronidazol', 'tinidazol',
  'gentamicin', 'tobramycin', 'amikacin', 'streptomycin',
  'vancomycin', 'teicoplanin', 'linezolid', 'meropenem', 'imipenem', 'ertapenem',
  'rifampicin', 'fusidinsäure', 'fusidic acid', 'ácido fusídico', 'daptomycin', 'colistin',
  'chloramphenicol', 'spectinomycin',
];
const SCHLUESSEL = new Set(ANTIBIOTICS.map(wirkstoffSchluessel).filter(Boolean));
// Teiltreffer nur mit längeren Schlüsseln („Amoxicillin Sandoz" → amoxicilin…).
const LANGE = [...SCHLUESSEL].filter((k) => k.length >= 6);

// Quellen. Nur offizielle, geprüfte Adressen; Beschriftung je Sprache.
const QUELLEN = {
  AT: [
    { label: { de: 'AGES — Antibiotika & Resistenzen (AURES)', en: 'AGES — antibiotics & resistance (AURES, German)', pt: 'AGES — antibióticos e resistências (AURES, em alemão)' }, url: 'https://www.ages.at/mensch/arzneimittel-medizinprodukte/antibiotika-resistenzen' },
    { label: { de: 'AURES – Resistenzbericht Österreich (Sozialministerium, PDF)', en: 'AURES — Austrian resistance report (Ministry of Health, PDF, German)', pt: 'AURES — relatório de resistências da Áustria (PDF, em alemão)' }, url: 'https://www.sozialministerium.gv.at/dam/jcr:9de3721f-4da6-4d43-882d-09a3229c3e83/AURES_2021_-_BMSGPK_(Stand,_27.2.2023).pdf' },
  ],
  WELT: [
    { label: { de: 'WHO — AWaRe-Antibiotikabuch (Access, Watch, Reserve; Englisch)', en: 'WHO — AWaRe antibiotic book (Access, Watch, Reserve)', pt: 'OMS — livro de antibióticos AWaRe (Access, Watch, Reserve; em inglês)' }, url: 'https://www.who.int/publications/i/item/9789240062382' },
    { label: { de: 'WHO — Faktenblatt Antibiotikaresistenz (Englisch)', en: 'WHO — fact sheet: antimicrobial resistance', pt: 'OMS — ficha informativa: resistência antimicrobiana (em inglês)' }, url: 'https://www.who.int/news-room/fact-sheets/detail/antimicrobial-resistance' },
  ],
};

export function createAmrService() {
  function isAntibiotic(name) {
    const k = wirkstoffSchluessel(name);
    if (!k) return false;
    const teile = k.split('+');
    if (teile.some((t) => SCHLUESSEL.has(t))) return true;
    // Teiltreffer für zusammengesetzte Bezeichnungen (z. B. "Amoxicillin Sandoz").
    return teile.some((t) => LANGE.some((a) => t.includes(a)));
  }

  // Info-Paket für die Wirkstoff-Detailseite; null, wenn kein Antibiotikum.
  // land = angesehenes Land (Quellen), Sprache der Beschriftung = Sprache des Landes.
  function forWirkstoff(name, { land = null } = {}) {
    if (!isAntibiotic(name)) return null;
    const sp = normalizeLocale(null, land);
    const liste = String(land || '').toUpperCase() === 'AT' ? QUELLEN.AT : QUELLEN.WELT;
    return {
      is_antibiotic: true,
      sources: liste.map((q) => ({ label: q.label[sp] || q.label.en, url: q.url })),
    };
  }

  return { isAntibiotic, forWirkstoff };
}
