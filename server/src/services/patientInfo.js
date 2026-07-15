// Patienten-Infokarten zum Antibiotikaeinsatz — mehrsprachig, kuratiert, REIN
// INFORMATIV. Für Apotheken zur verständlichen Aufklärung bei der Abgabe
// (anzeigen/ausdrucken). Allgemeine, quellenbelegte Public-Health-Botschaften —
// KEINE patientenindividuelle Therapie-, Dosierungs- oder Diagnoseaussage.

const LANGS = [
  { code: 'de', label: 'Deutsch' },
  { code: 'en', label: 'English' },
  { code: 'tr', label: 'Türkçe' },
];

const SOURCE = {
  label: 'AGES — Antibiotika & Resistenzen',
  url: 'https://www.ages.at/mensch/arzneimittel-medizinprodukte/antibiotika-resistenzen',
};

const DISCLAIMER = {
  de: 'Allgemeine Information — ersetzt nicht die individuelle Beratung durch Arzt oder Apotheke.',
  en: 'General information — does not replace individual advice from your doctor or pharmacist.',
  tr: 'Genel bilgi — doktor veya eczacı tarafından verilen kişisel danışmanlığın yerini tutmaz.',
};

const CARDS = [
  {
    id: 'einnahme', icon: '⏰',
    de: { title: 'Genau nach Anweisung einnehmen', body: 'Nehmen Sie das Antibiotikum genau in der verordneten Dosis, zu den empfohlenen Zeiten und über die gesamte verordnete Dauer ein. Ändern Sie nichts ohne Rücksprache mit Arzt oder Apotheke.' },
    en: { title: 'Take exactly as prescribed', body: 'Take the antibiotic exactly at the prescribed dose, at the recommended times, and for the full prescribed duration. Do not change anything without asking your doctor or pharmacist.' },
    tr: { title: 'Tam olarak reçete edildiği gibi alın', body: 'Antibiyotiği tam olarak reçete edilen dozda, önerilen saatlerde ve reçete edilen süre boyunca alın. Doktorunuza veya eczacınıza danışmadan hiçbir şeyi değiştirmeyin.' },
  },
  {
    id: 'nicht-absetzen', icon: '✅',
    de: { title: 'Therapie nicht vorzeitig abbrechen', body: 'Beenden Sie die Behandlung nicht früher, auch wenn Sie sich schon besser fühlen — außer Arzt oder Ärztin sagt es ausdrücklich. Vorzeitiges Absetzen kann den Behandlungserfolg gefährden.' },
    en: { title: 'Do not stop the treatment early', body: 'Do not stop the treatment early, even if you already feel better — unless your doctor tells you to. Stopping too soon can put the treatment success at risk.' },
    tr: { title: 'Tedaviyi erken bırakmayın', body: 'Kendinizi daha iyi hissetseniz bile — doktorunuz söylemedikçe — tedaviyi erken bırakmayın. Çok erken bırakmak tedavinin başarısını tehlikeye atabilir.' },
  },
  {
    id: 'nicht-gegen-viren', icon: '🦠',
    de: { title: 'Antibiotika wirken nicht gegen Viren', body: 'Antibiotika helfen gegen bakterielle Infektionen — nicht gegen Erkältung oder Grippe, die von Viren verursacht werden. Unnötiger Einsatz fördert Antibiotikaresistenzen.' },
    en: { title: 'Antibiotics do not work against viruses', body: 'Antibiotics help against bacterial infections — not against colds or flu, which are caused by viruses. Unnecessary use promotes antibiotic resistance.' },
    tr: { title: 'Antibiyotikler virüslere karşı etkili değildir', body: 'Antibiyotikler bakteriyel enfeksiyonlara karşı etkilidir — virüslerin neden olduğu soğuk algınlığı veya gribe karşı değil. Gereksiz kullanım antibiyotik direncini artırır.' },
  },
  {
    id: 'nebenwirkungen', icon: '⚠️',
    de: { title: 'Bei Nebenwirkungen nachfragen', body: 'Wenden Sie sich bei Nebenwirkungen (z. B. Hautausschlag, starker oder anhaltender Durchfall) oder bei Fragen zu anderen Medikamenten an Apotheke oder Arzt.' },
    en: { title: 'Ask about side effects', body: 'If you notice side effects (e.g. skin rash, severe or lasting diarrhoea) or have questions about other medicines, contact your pharmacy or doctor.' },
    tr: { title: 'Yan etkilerde danışın', body: 'Yan etki fark ederseniz (örneğin cilt döküntüsü, şiddetli veya uzun süren ishal) veya diğer ilaçlarla ilgili sorularınız varsa eczaneye veya doktora başvurun.' },
  },
  {
    id: 'entsorgung', icon: '🗑️',
    de: { title: 'Reste richtig entsorgen', body: 'Geben Sie übrige Antibiotika nicht in Toilette oder Abfluss und nicht an andere Personen weiter. Bringen Sie Reste zur Entsorgung in die Apotheke.' },
    en: { title: 'Dispose of leftovers correctly', body: 'Do not put leftover antibiotics into the toilet or drain, and do not give them to other people. Return leftovers to the pharmacy for disposal.' },
    tr: { title: 'Artıkları doğru şekilde atın', body: 'Artan antibiyotikleri tuvalete veya lavaboya atmayın ve başkalarına vermeyin. Artıkları imha için eczaneye götürün.' },
  },
];

export function createPatientInfoService() {
  return {
    langs: () => LANGS.map((l) => ({ ...l })),
    // Alle Karten in einer Sprache (Fallback Deutsch), plus Quelle & Hinweis.
    cards(lang = 'de') {
      const code = LANGS.some((l) => l.code === lang) ? lang : 'de';
      return {
        lang: code,
        langs: LANGS.map((l) => ({ ...l })),
        source: { ...SOURCE },
        disclaimer: DISCLAIMER[code],
        cards: CARDS.map((c) => ({ id: c.id, icon: c.icon, title: c[code].title, body: c[code].body })),
      };
    },
  };
}
