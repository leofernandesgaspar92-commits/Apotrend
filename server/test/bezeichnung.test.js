// Bedeutungstragende Wörter einer Präparat-Bezeichnung (domain/bezeichnung.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { falten, istFormwort, bedeutungsWoerter } from '../src/domain/bezeichnung.js';

const woerter = (t) => [...bedeutungsWoerter(t).keys()];
const teilen = (a, b) => woerter(a).some((w) => bedeutungsWoerter(b).has(w));

// ── Die zwölf gemessenen Paare ───────────────────────────────────────────────
//  Vor dieser Datei waren 10 von 12 falsch. Jedes Paar steht für eine Klasse.
const PAARE = [
  // [Gesuch, Angebot, sollen sie zusammenfinden?, Klasse]
  ['Comprimidos de Metformina 850', 'Comprimidos de Amoxicilina 500', false, 'PT-Formwort'],
  ['Solução oral de Metformina', 'Solução oral de Amoxicilina', false, 'PT, zerfiel in „solu"'],
  ['Pó para suspensão oral Cefixima', 'Pó para suspensão oral Amoxicilina', false, 'PT-Füllwort „para"'],
  ['Ácido fólico 5 mg', 'Ácido acetilsalicílico 100 mg', false, '„ácido" verbindet nichts'],
  ['Metformin tablets 500 mg', 'Amoxicillin tablets 500 mg', false, 'EN-Formwort'],
  ['Metformin oral solution', 'Amoxicillin oral solution', false, 'EN-Formwort + „oral"'],
  ['Dexamethason Augentropfen', 'Ofloxacin Augentropfen', false, 'DE-Kompositum'],
  ['Xylometazolin Nasenspray', 'Mometason Nasenspray', false, 'DE-Kompositum'],
  ['Metformin Lösung zum Einnehmen', 'Amoxicillin Lösung zum Einnehmen', false, 'DE-Füllwort'],
  ['Ácido acetilsalicílico 100', 'Acido acetilsalicilico 100', true, 'Akzent ist kein anderer Wirkstoff'],
  ['Amoxicilina 500', 'Amoxicilina comprimidos 500', true, 'PT-Grundfall'],
  ['Amoxicillin 500 mg', 'Amoxicillin 1000 mg Filmtabletten', true, 'DE-Grundfall'],
];

for (const [a, b, soll, klasse] of PAARE) {
  test(`Paar (${klasse}): „${a}" ↔ „${b}" ${soll ? 'passt' : 'passt NICHT'}`, () => {
    assert.equal(teilen(a, b), soll,
      `geteilte Wörter: ${JSON.stringify(woerter(a).filter((w) => bedeutungsWoerter(b).has(w)))}`);
  });
}

// ── Einzelregeln ─────────────────────────────────────────────────────────────

test('falten: Akzente und Umlaute weg, klein', () => {
  assert.equal(falten('Ácido Acetilsalicílico'), 'acido acetilsalicilico');
  assert.equal(falten('Lösung'), 'losung');
  assert.equal(falten('SOLUÇÃO'), 'solucao');
});

test('Stärken sind keine Bedeutung — auch nicht zusammengeschrieben', () => {
  // „Metformin 500mg" ↔ „Amoxicillin 500mg" teilten vorher „500mg".
  for (const w of ['500', '500mg', '0,5ml', '100ie', '1000mcg', '20%']) {
    assert.ok(istFormwort(falten(w)) || falten(w).length < 4, `„${w}" gilt als bedeutungstragend`);
  }
  assert.equal(teilen('Metformin 500mg', 'Amoxicillin 500mg'), false);
});

test('Komposita mit Darreichung am Ende sind Formwörter', () => {
  for (const w of ['Augentropfen', 'Nasenspray', 'Infusionslösung', 'Hustensaft', 'Trockensaft',
    'Dosieraerosol', 'Lutschtabletten', 'Fertigspritze', 'Augensalbe']) {
    assert.ok(istFormwort(falten(w)), `„${w}" wird als Wirkstoff gewertet`);
  }
});

test('Dreibuchstaben-Formwörter greifen NICHT als Endung („Nagel" ist kein Gel)', () => {
  assert.equal(istFormwort('nagel'), false);
});

test('die Schreibweise bleibt erhalten — für den Suchbegriff in der Oberfläche', () => {
  assert.equal(bedeutungsWoerter('Ácido acetilsalicílico').get('acetilsalicilico'), 'acetilsalicílico');
});

// ── Die Gegenrichtung: kein Wirkstoffname darf als Formwort verschwinden ─────
//  Die Kompositum-Regel ist ein Verdacht über WORTENDEN. Diese Liste
//  verbreiteter Wirkstoffe (INN, mit DE/PT-Schreibweisen) ist der Beleg, dass
//  sie keinen davon trifft. Wer eine neue Endung einführt, sieht hier sofort,
//  ob sie einen echten Wirkstoff schluckt — ein verschluckter Wirkstoff hieße:
//  nie wieder ein Treffer zu diesem Präparat, ohne dass es jemand merkt.
const WIRKSTOFFE = `
  Amoxicillin Amoxicilina Ampicillin Azithromycin Azitromicina Cefixim Cefixima Ceftriaxon Ceftriaxona
  Cefuroxim Ciprofloxacin Ciprofloxacino Clarithromycin Claritromicina Clindamycin Doxycyclin Doxiciclina
  Flucloxacillin Levofloxacin Metronidazol Nitrofurantoin Penicillin Phenoxymethylpenicillin
  Trimethoprim Sulfamethoxazol Vancomycin Gentamicin Fosfomycin Linezolid Rifampicin Isoniazid
  Ethambutol Pyrazinamid Fluconazol Clotrimazol Nystatin Aciclovir Valaciclovir Oseltamivir
  Paracetamol Ibuprofen Diclofenac Naproxen Metamizol Acetylsalicylsäure Acetilsalicílico Tramadol
  Morphin Morfina Oxycodon Fentanyl Hydromorphon Tapentadol Pregabalin Gabapentin
  Metformin Metformina Glibenclamid Gliclazid Sitagliptin Empagliflozin Dapagliflozin Insulin Insulina
  Semaglutid Liraglutid Dulaglutid Levothyroxin Levotiroxina Thiamazol Carbimazol
  Amlodipin Amlodipina Bisoprolol Metoprolol Atenolol Carvedilol Nebivolol Propranolol
  Ramipril Enalapril Lisinopril Candesartan Losartan Valsartan Telmisartan Olmesartan
  Hydrochlorothiazid Furosemid Furosemida Torasemid Spironolacton Eplerenon Indapamid
  Atorvastatin Atorvastatina Simvastatin Rosuvastatin Pravastatin Ezetimib
  Apixaban Rivaroxaban Edoxaban Dabigatran Warfarin Phenprocoumon Clopidogrel Ticagrelor Prasugrel
  Enoxaparin Heparin Digoxin Amiodaron Dronedaron Flecainid Ivabradin Nitroglycerin Isosorbiddinitrat
  Pantoprazol Omeprazol Esomeprazol Lansoprazol Ranitidin Famotidin Ondansetron Metoclopramid
  Domperidon Loperamid Mesalazin Budesonid Prednisolon Prednison Dexamethason Dexametasona
  Hydrocortison Methylprednisolon Betamethason Mometason Fluticason Beclometason
  Salbutamol Formoterol Salmeterol Tiotropium Ipratropium Montelukast Theophyllin
  Cetirizin Loratadin Desloratadin Fexofenadin Dimetinden Xylometazolin Oxymetazolin
  Sertralin Citalopram Escitalopram Fluoxetin Paroxetin Venlafaxin Duloxetin Mirtazapin
  Amitriptylin Trazodon Bupropion Quetiapin Olanzapin Risperidon Aripiprazol Haloperidol Clozapin
  Lithium Lamotrigin Levetiracetam Valproinsäure Carbamazepin Oxcarbazepin Topiramat Lacosamid
  Diazepam Lorazepam Alprazolam Midazolam Zolpidem Melatonin Methylphenidat
  Levodopa Carbidopa Pramipexol Ropinirol Rasagilin Donepezil Memantin Rivastigmin
  Alendronsäure Colecalciferol Calcitriol Calcium Magnesium Kalium Eisen Folsäure Cyanocobalamin
  Tamsulosin Finasterid Dutasterid Sildenafil Tadalafil Oxybutynin Solifenacin Mirabegron
  Estradiol Östrogen Progesteron Levonorgestrel Desogestrel Drospirenon Testosteron
  Methotrexat Hydroxychloroquin Sulfasalazin Leflunomid Azathioprin Ciclosporin Tacrolimus
  Adalimumab Infliximab Etanercept Rituximab Trastuzumab Pembrolizumab Nivolumab Denosumab
  Tamoxifen Letrozol Anastrozol Imatinib Capecitabin Cyclophosphamid Doxorubicin Cisplatin
  Allopurinol Febuxostat Colchicin Zidovudin Lamivudin Tenofovir Efavirenz Dolutegravir
  Artemether Lumefantrin Artesunat Chloroquin Primaquin Mefloquin Atovaquon Proguanil
  Albendazol Mebendazol Ivermectin Praziquantel Oxytocin Misoprostol Magnesiumsulfat
  Lidocain Bupivacain Ketamin Propofol Adrenalin Noradrenalin Atropin Naloxon Glucose Dextrose
  Zink Zinkoxid Natriumchlorid Kaliumchlorid Lactulose Macrogol Bisacodyl Simeticon
`.split(/\s+/).filter(Boolean);

test(`kein verbreiteter Wirkstoffname (${WIRKSTOFFE.length}) gilt als Formwort`, () => {
  const verschluckt = WIRKSTOFFE.filter((w) => bedeutungsWoerter(w).size === 0);
  assert.deepEqual(verschluckt, [], 'diese Wirkstoffe würden nie mehr gematcht');
});
