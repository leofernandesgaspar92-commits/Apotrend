// Patienten-Infokarten zum Antibiotikaeinsatz — mehrsprachig, kuratiert, REIN
// INFORMATIV. Für Apotheken zur verständlichen Aufklärung bei der Abgabe
// (anzeigen/ausdrucken). Allgemeine, quellenbelegte Public-Health-Botschaften —
// KEINE patientenindividuelle Therapie-, Dosierungs- oder Diagnoseaussage.

// Seit 10/2026 auch Portugiesisch (Mosambik, Angola, Portugal). Vorher gab es
// Deutsch, Englisch, Türkisch — die Sprachen österreichischer Kundschaft — und
// die Karten öffneten sich überall zuerst auf Deutsch.
// Seit 10/2026 Französisch (Senegal, Côte d'Ivoire, Kamerun, Kongo …).
const LANGS = [
  { code: 'de', label: 'Deutsch' },
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português' },
  { code: 'fr', label: 'Français' },
  { code: 'tr', label: 'Türkçe' },
];

// Quelle passend zum angesehenen Land: Österreich AGES, sonst WHO (weltweit).
// Beschriftung in der Sprache der Karten.
const SOURCES = {
  AT: { url: 'https://www.ages.at/mensch/arzneimittel-medizinprodukte/antibiotika-resistenzen',
    label: { de: 'AGES — Antibiotika & Resistenzen', en: 'AGES — antibiotics & resistance (Austria)', pt: 'AGES — antibióticos e resistências (Áustria)', fr: 'AGES — antibiotiques et résistances (Autriche)', tr: 'AGES — antibiyotikler ve direnç (Avusturya)' } },
  WELT: { url: 'https://www.who.int/news-room/fact-sheets/detail/antimicrobial-resistance',
    label: { de: 'WHO — Antibiotikaresistenz (Faktenblatt)', en: 'WHO — antimicrobial resistance (fact sheet)', pt: 'OMS — resistência antimicrobiana (ficha informativa)', fr: 'OMS — résistance aux antimicrobiens (aide-mémoire)', tr: 'DSÖ — antimikrobiyal direnç (bilgi notu)' } },
};

const DISCLAIMER = {
  de: 'Allgemeine Information — ersetzt nicht die individuelle Beratung durch Arzt oder Apotheke.',
  en: 'General information — does not replace individual advice from your doctor or pharmacist.',
  pt: 'Informação geral — não substitui o aconselhamento individual do seu médico ou farmacêutico.',
  fr: 'Information générale — ne remplace pas le conseil personnalisé de votre médecin ou pharmacien.',
  tr: 'Genel bilgi — doktor veya eczacı tarafından verilen kişisel danışmanlığın yerini tutmaz.',
};

const CARDS = [
  {
    id: 'einnahme', icon: '⏰',
    de: { title: 'Genau nach Anweisung einnehmen', body: 'Nehmen Sie das Antibiotikum genau in der verordneten Dosis, zu den empfohlenen Zeiten und über die gesamte verordnete Dauer ein. Ändern Sie nichts ohne Rücksprache mit Arzt oder Apotheke.' },
    en: { title: 'Take exactly as prescribed', body: 'Take the antibiotic exactly at the prescribed dose, at the recommended times, and for the full prescribed duration. Do not change anything without asking your doctor or pharmacist.' },
    pt: { title: 'Tomar exatamente como prescrito', body: 'Tome o antibiótico exatamente na dose prescrita, às horas recomendadas e durante todo o período prescrito. Não altere nada sem perguntar ao seu médico ou farmacêutico.' },
    fr: { title: 'Prendre exactement selon la prescription', body: 'Prenez l’antibiotique exactement à la dose prescrite, aux heures recommandées et pendant toute la durée prescrite. Ne changez rien sans en parler à votre médecin ou pharmacien.' },
    tr: { title: 'Tam olarak reçete edildiği gibi alın', body: 'Antibiyotiği tam olarak reçete edilen dozda, önerilen saatlerde ve reçete edilen süre boyunca alın. Doktorunuza veya eczacınıza danışmadan hiçbir şeyi değiştirmeyin.' },
  },
  {
    id: 'nicht-absetzen', icon: '✅',
    de: { title: 'Therapie nicht vorzeitig abbrechen', body: 'Beenden Sie die Behandlung nicht früher, auch wenn Sie sich schon besser fühlen — außer Arzt oder Ärztin sagt es ausdrücklich. Vorzeitiges Absetzen kann den Behandlungserfolg gefährden.' },
    en: { title: 'Do not stop the treatment early', body: 'Do not stop the treatment early, even if you already feel better — unless your doctor tells you to. Stopping too soon can put the treatment success at risk.' },
    pt: { title: 'Não interromper o tratamento antes do tempo', body: 'Não termine o tratamento mais cedo, mesmo que já se sinta melhor — a não ser que o seu médico o indique expressamente. Parar demasiado cedo pode pôr em risco o sucesso do tratamento.' },
    fr: { title: 'Ne pas arrêter le traitement trop tôt', body: 'N’arrêtez pas le traitement plus tôt, même si vous vous sentez déjà mieux — sauf si votre médecin vous le dit expressément. Un arrêt trop précoce peut compromettre la réussite du traitement.' },
    tr: { title: 'Tedaviyi erken bırakmayın', body: 'Kendinizi daha iyi hissetseniz bile — doktorunuz söylemedikçe — tedaviyi erken bırakmayın. Çok erken bırakmak tedavinin başarısını tehlikeye atabilir.' },
  },
  {
    id: 'nicht-gegen-viren', icon: '🦠',
    de: { title: 'Antibiotika wirken nicht gegen Viren', body: 'Antibiotika helfen gegen bakterielle Infektionen — nicht gegen Erkältung oder Grippe, die von Viren verursacht werden. Unnötiger Einsatz fördert Antibiotikaresistenzen.' },
    en: { title: 'Antibiotics do not work against viruses', body: 'Antibiotics help against bacterial infections — not against colds or flu, which are caused by viruses. Unnecessary use promotes antibiotic resistance.' },
    pt: { title: 'Os antibióticos não atuam contra vírus', body: 'Os antibióticos ajudam contra infeções bacterianas — não contra constipações ou gripe, que são causadas por vírus. O uso desnecessário favorece a resistência aos antibióticos.' },
    fr: { title: 'Les antibiotiques n’agissent pas contre les virus', body: 'Les antibiotiques aident contre les infections bactériennes — pas contre le rhume ou la grippe, qui sont causés par des virus. Un usage inutile favorise la résistance aux antibiotiques.' },
    tr: { title: 'Antibiyotikler virüslere karşı etkili değildir', body: 'Antibiyotikler bakteriyel enfeksiyonlara karşı etkilidir — virüslerin neden olduğu soğuk algınlığı veya gribe karşı değil. Gereksiz kullanım antibiyotik direncini artırır.' },
  },
  {
    id: 'nebenwirkungen', icon: '⚠️',
    de: { title: 'Bei Nebenwirkungen nachfragen', body: 'Wenden Sie sich bei Nebenwirkungen (z. B. Hautausschlag, starker oder anhaltender Durchfall) oder bei Fragen zu anderen Medikamenten an Apotheke oder Arzt.' },
    en: { title: 'Ask about side effects', body: 'If you notice side effects (e.g. skin rash, severe or lasting diarrhoea) or have questions about other medicines, contact your pharmacy or doctor.' },
    pt: { title: 'Perguntar em caso de efeitos secundários', body: 'Se notar efeitos secundários (p. ex. erupção cutânea, diarreia forte ou prolongada) ou tiver dúvidas sobre outros medicamentos, contacte a farmácia ou o médico.' },
    fr: { title: 'Demander conseil en cas d’effets indésirables', body: 'En cas d’effets indésirables (p. ex. éruption cutanée, diarrhée forte ou persistante) ou de questions sur d’autres médicaments, adressez-vous à votre pharmacie ou à votre médecin.' },
    tr: { title: 'Yan etkilerde danışın', body: 'Yan etki fark ederseniz (örneğin cilt döküntüsü, şiddetli veya uzun süren ishal) veya diğer ilaçlarla ilgili sorularınız varsa eczaneye veya doktora başvurun.' },
  },
  {
    id: 'entsorgung', icon: '🗑️',
    de: { title: 'Reste richtig entsorgen', body: 'Geben Sie übrige Antibiotika nicht in Toilette oder Abfluss und nicht an andere Personen weiter. Bringen Sie Reste zur Entsorgung in die Apotheke.' },
    en: { title: 'Dispose of leftovers correctly', body: 'Do not put leftover antibiotics into the toilet or drain, and do not give them to other people. Return leftovers to the pharmacy for disposal.' },
    pt: { title: 'Eliminar corretamente as sobras', body: 'Não deite antibióticos que sobraram na sanita nem no esgoto e não os dê a outras pessoas. Entregue as sobras na farmácia para eliminação.' },
    fr: { title: 'Bien éliminer les restes', body: 'Ne jetez pas les antibiotiques restants dans les toilettes ou l’évier et ne les donnez pas à d’autres personnes. Rapportez les restes à la pharmacie pour élimination.' },
    tr: { title: 'Artıkları doğru şekilde atın', body: 'Artan antibiyotikleri tuvalete veya lavaboya atmayın ve başkalarına vermeyin. Artıkları imha için eczaneye götürün.' },
    // Außerhalb Österreichs: Ob Apotheken Reste zurücknehmen, ist nicht überall
    // geregelt (in vielen afrikanischen Ländern nicht) — kein Versprechen ohne Quelle.
    welt: {
      de: 'Geben Sie übrige Antibiotika nicht an andere Personen weiter und nehmen Sie sie nicht später auf eigene Faust ein. Fragen Sie in Ihrer Apotheke, wie Reste sicher entsorgt werden.',
      en: 'Do not give leftover antibiotics to other people and do not take them later on your own. Ask your pharmacy how to dispose of leftovers safely.',
      pt: 'Não dê antibióticos que sobraram a outras pessoas e não os tome mais tarde por iniciativa própria. Pergunte na sua farmácia como eliminar as sobras em segurança.',
      fr: 'Ne donnez pas les antibiotiques restants à d’autres personnes et ne les prenez pas plus tard de votre propre initiative. Demandez à votre pharmacie comment éliminer les restes en toute sécurité.',
      tr: 'Artan antibiyotikleri başkalarına vermeyin ve daha sonra kendi başınıza kullanmayın. Artıkları güvenli şekilde nasıl atacağınızı eczanenize sorun.',
    },
  },
];

export function createPatientInfoService() {
  return {
    langs: () => LANGS.map((l) => ({ ...l })),
    // Alle Karten in einer Sprache (Fallback Deutsch), plus Quelle & Hinweis.
    // land = angesehenes Land: bestimmt Quelle und die Entsorgungs-Karte.
    cards(lang = 'de', { land = null } = {}) {
      const code = LANGS.some((l) => l.code === lang) ? lang : 'de';
      const at = String(land || 'AT').toUpperCase() === 'AT';
      const q = at ? SOURCES.AT : SOURCES.WELT;
      return {
        lang: code,
        langs: LANGS.map((l) => ({ ...l })),
        source: { label: q.label[code] || q.label.en, url: q.url },
        disclaimer: DISCLAIMER[code],
        cards: CARDS.map((c) => ({ id: c.id, icon: c.icon, title: c[code].title, body: !at && c.welt ? c.welt[code] : c[code].body })),
      };
    },
  };
}
