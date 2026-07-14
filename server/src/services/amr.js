// Antibiotic-Stewardship-Infodienst — REIN INFORMATIV.
//
// WICHTIG (regulatorische Leitplanke): Dieser Dienst gibt KEINE
// patientenindividuelle Therapieempfehlung aus und ist keine klinische
// Entscheidungsunterstützung. Er erkennt nur, ob ein Wirkstoff ein (allgemein
// bekanntes) Antibiotikum ist, um dann quellenbelegte, allgemeine Hinweise zum
// verantwortungsvollen Antibiotikaeinsatz samt offiziellen Quellen anzuzeigen.
// Es werden bewusst KEINE wirkstoffspezifischen klinischen Aussagen (Spektrum,
// Indikation, Dosierung) getroffen.

// Kuratierte Liste gängiger Antibiotika-Wirkstoffe (INN, klein geschrieben).
// Dient ausschließlich der Entscheidung, ob das Info-Panel gezeigt wird.
const ANTIBIOTICS = new Set([
  'amoxicillin', 'amoxicillin/clavulansäure', 'ampicillin', 'flucloxacillin',
  'penicillin', 'phenoxymethylpenicillin', 'piperacillin', 'clarithromycin',
  'azithromycin', 'erythromycin', 'roxithromycin', 'clindamycin', 'doxycyclin',
  'tetracyclin', 'minocyclin', 'ciprofloxacin', 'levofloxacin', 'moxifloxacin',
  'norfloxacin', 'cefalexin', 'cefaclor', 'cefuroxim', 'cefpodoxim', 'ceftriaxon',
  'trimethoprim', 'trimethoprim/sulfamethoxazol', 'cotrimoxazol', 'sulfamethoxazol',
  'nitrofurantoin', 'fosfomycin', 'metronidazol', 'gentamicin', 'tobramycin',
  'vancomycin', 'teicoplanin', 'linezolid', 'meropenem', 'imipenem', 'ertapenem',
  'rifampicin', 'fusidinsäure', 'tigecyclin', 'daptomycin', 'colistin',
]);

// Allgemeine Stewardship-Hinweise (keine wirkstoffspezifische Aussage) + Quellen.
const STEWARDSHIP = {
  note: 'Antibiotika gezielt und nur bei klarer Indikation einsetzen, die Wahl an der aktuellen regionalen Resistenzlage orientieren und die Therapie so kurz wie leitliniengerecht möglich halten. Reserveantibiotika zurückhaltend verwenden.',
  disclaimer: 'Allgemeine Information zum verantwortungsvollen Antibiotikaeinsatz — keine patientenindividuelle Therapieempfehlung. Auswahl, Dosierung und Dauer entscheidet die behandelnde Ärztin bzw. der behandelnde Arzt nach aktueller Leitlinie.',
  // Nur offizielle, verifizierte österreichische Quellen.
  sources: [
    { label: 'AGES — Antibiotika & Resistenzen (AURES)', url: 'https://www.ages.at/mensch/arzneimittel-medizinprodukte/antibiotika-resistenzen' },
    { label: 'AURES – Resistenzbericht Österreich (Sozialministerium, PDF)', url: 'https://www.sozialministerium.gv.at/dam/jcr:9de3721f-4da6-4d43-882d-09a3229c3e83/AURES_2021_-_BMSGPK_(Stand,_27.2.2023).pdf' },
  ],
};

export function createAmrService() {
  const norm = (s) => String(s ?? '').trim().toLowerCase();

  function isAntibiotic(name) {
    const n = norm(name);
    if (!n) return false;
    if (ANTIBIOTICS.has(n)) return true;
    // Teiltreffer für zusammengesetzte Bezeichnungen (z. B. "Amoxicillin 1000 mg").
    for (const a of ANTIBIOTICS) {
      if (a.length >= 5 && n.includes(a)) return true;
    }
    return false;
  }

  // Info-Paket für die Wirkstoff-Detailseite; null, wenn kein Antibiotikum.
  function forWirkstoff(name) {
    if (!isAntibiotic(name)) return null;
    return {
      is_antibiotic: true,
      note: STEWARDSHIP.note,
      disclaimer: STEWARDSHIP.disclaimer,
      sources: STEWARDSHIP.sources.map((s) => ({ ...s })),
    };
  }

  return { isAntibiotic, forWirkstoff };
}
