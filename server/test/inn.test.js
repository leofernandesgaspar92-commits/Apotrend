// Wirkstoff-Schlüssel über Sprachen (domain/inn.js).
// Beide Richtungen zählen: Gleiches muss zusammenfallen — und Verschiedenes
// darf es NIE. Eine falsche Gleichsetzung wäre eine falsche Engpass-Warnung.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wirkstoffSchluessel as k, gleicherWirkstoff as gleich } from '../src/domain/inn.js';

const GLEICH = [
  ['Amoxicillin', 'Amoxicillin-Trihydrat'],
  ['Amoxicillin', 'amoxicillin trihydrate'],
  ['Amoxicillin', 'Amoxicilina'],
  ['Amoxicillin', 'AMOXICILLIN'],
  ['Cefuroxim', 'Cefuroxime'],
  ['Cefuroxim', 'Cefuroxima'],
  ['Salbutamol', 'Albuterol Sulfate'],
  ['Salbutamol', 'Salbutamolsulfat'],
  ['Paracetamol', 'Acetaminophen'],
  ['Metoprolol', 'Metoprololsuccinat'],
  ['Metoprolol', 'Metoprolol Tartrate'],
  ['Amlodipin', 'Amlodipine Besylate'],
  ['Amlodipin', 'Amlodipinbesilat'],
  ['Doxycyclin', 'Doxycycline Hyclate'],
  ['Ciprofloxacin', 'Ciprofloxacino'],
  ['Ciprofloxacin', 'Ciprofloxacin-Hydrochlorid'],
  ['Morphin', 'Morphine Sulfate'],
  ['Morphin', 'Morfina'],
  ['Adrenalin', 'Epinephrine'],
  ['Ciclosporin', 'Cyclosporine'],
  ['Rifampicin', 'Rifampin'],
  ['Amoxicillin/Clavulansäure', 'Clavulansäure; Amoxicillin'],
  ['Lidocain', 'Lidocaine Hydrochloride'],
  ['Ibuprofen', 'Ibuprofen-Lysinat'],
];
const VERSCHIEDEN = [
  ['Kaliumchlorid', 'Kaliumcitrat'],
  ['Kaliumchlorid', 'Natriumchlorid'],
  ['Potassium Chloride', 'Sodium Chloride'],
  ['Prednison', 'Prednisolon'],
  ['Amoxicillin', 'Amoxicillin/Clavulansäure'],
  ['Amoxicillin', 'Ampicillin'],
  ['Estradiol', 'Estriol'],
  ['Cefuroxim', 'Cefotaxim'],
  ['Metformin', 'Metoprolol'],
  ['Calcium', 'Magnesium'],
  ['Levothyroxin', 'Liothyronin'],
  ['Salbutamol', 'Levosalbutamol'],
  ['Hydrochlorothiazid', 'Chlorthalidon'],
  ['Insulin glargin', 'Insulin lispro'],
];

for (const [a, b] of GLEICH) {
  test(`gleich: „${a}" = „${b}"`, () => assert.ok(gleich(a, b), `${k(a)} ≠ ${k(b)}`));
}
for (const [a, b] of VERSCHIEDEN) {
  test(`verschieden: „${a}" ≠ „${b}"`, () => assert.ok(!gleich(a, b), `beide ${k(a)}`));
}

test('leer bleibt leer, Zahlen und Stärken stören nicht', () => {
  assert.equal(k(''), '');
  assert.equal(k(null), '');
  assert.ok(gleich('Ibuprofen 400 mg', 'Ibuprofen'));
});

// Breitentest gegen falsche Gleichsetzung: gängige, VERSCHIEDENE Wirkstoffe
// (Engpass-relevant, viele Namensverwandte darunter) — kein Schlüssel doppelt.
const VERSCHIEDENE_WIRKSTOFFE = `Amoxicillin Ampicillin Piperacillin Flucloxacillin Benzylpenicillin Phenoxymethylpenicillin
Cefuroxim Cefotaxim Ceftriaxon Cefazolin Cefalexin Cefaclor Cefixim Cefpodoxim Ceftazidim Cefepim
Clarithromycin Azithromycin Erythromycin Roxithromycin Doxycyclin Minocyclin Tetracyclin
Ciprofloxacin Levofloxacin Moxifloxacin Ofloxacin Norfloxacin Clindamycin Lincomycin Vancomycin Teicoplanin
Gentamicin Tobramycin Amikacin Metronidazol Tinidazol Nitrofurantoin Fosfomycin Trimethoprim Sulfamethoxazol
Linezolid Rifampicin Rifabutin Isoniazid Ethambutol Pyrazinamid Fluconazol Itraconazol Voriconazol Posaconazol
Aciclovir Valaciclovir Ganciclovir Valganciclovir Oseltamivir
Paracetamol Ibuprofen Dexibuprofen Naproxen Diclofenac Aceclofenac Metamizol Celecoxib Etoricoxib Indometacin
Morphin Hydromorphon Oxycodon Hydrocodon Fentanyl Sufentanil Remifentanil Tramadol Tapentadol Pethidin Buprenorphin Methadon Codein Dihydrocodein
Salbutamol Levosalbutamol Terbutalin Formoterol Salmeterol Tiotropium Ipratropium Budesonid Beclometason Fluticason Mometason
Prednison Prednisolon Methylprednisolon Dexamethason Betamethason Hydrocortison Cortison Triamcinolon
Metoprolol Bisoprolol Atenolol Propranolol Carvedilol Nebivolol Sotalol
Amlodipin Felodipin Nifedipin Lercanidipin Nitrendipin Verapamil Diltiazem
Ramipril Enalapril Lisinopril Perindopril Captopril Candesartan Losartan Valsartan Irbesartan Telmisartan Olmesartan
Hydrochlorothiazid Chlortalidon Indapamid Furosemid Torasemid Spironolacton Eplerenon Amilorid Triamteren
Metformin Glibenclamid Gliclazid Glimepirid Sitagliptin Vildagliptin Empagliflozin Dapagliflozin
Levothyroxin Liothyronin Thiamazol Carbimazol Propylthiouracil
Estradiol Estriol Ethinylestradiol Progesteron Testosteron
Atorvastatin Simvastatin Rosuvastatin Pravastatin Fluvastatin Ezetimib
Warfarin Phenprocoumon Apixaban Rivaroxaban Edoxaban Dabigatran Heparin Enoxaparin Dalteparin Tinzaparin
Clopidogrel Prasugrel Ticagrelor Acetylsalicylsaeure
Omeprazol Esomeprazol Pantoprazol Lansoprazol Rabeprazol Ranitidin Famotidin
Ondansetron Granisetron Metoclopramid Domperidon
Sertralin Citalopram Escitalopram Fluoxetin Paroxetin Venlafaxin Duloxetin Mirtazapin Amitriptylin Nortriptylin Trazodon
Quetiapin Olanzapin Risperidon Aripiprazol Haloperidol Clozapin Lithium
Diazepam Lorazepam Oxazepam Alprazolam Clonazepam Midazolam Zolpidem Zopiclon
Levetiracetam Lamotrigin Valproinsaeure Carbamazepin Oxcarbazepin Phenytoin Topiramat Lacosamid Gabapentin Pregabalin
Levodopa Carbidopa Pramipexol Ropinirol Rasagilin
Adrenalin Noradrenalin Dopamin Dobutamin Isoprenalin Atropin Glycopyrronium
Lidocain Bupivacain Ropivacain Mepivacain Prilocain Propofol Ketamin Thiopental Etomidat
Insulin Glucagon Oxytocin Vasopressin Desmopressin Octreotid
Methotrexat Ciclosporin Tacrolimus Mycophenolat Azathioprin
Kaliumchlorid Natriumchlorid Kaliumcitrat Natriumhydrogencarbonat Calciumgluconat Magnesiumsulfat`;

test('Breitentest: keine zwei verschiedenen Wirkstoffe teilen einen Schlüssel', () => {
  const namen = VERSCHIEDENE_WIRKSTOFFE.split(/\s+/).filter(Boolean);
  const gesehen = new Map();
  const doppelt = [];
  for (const n of namen) {
    const key = k(n);
    assert.ok(key, `leerer Schlüssel für ${n}`);
    if (gesehen.has(key) && gesehen.get(key) !== n) doppelt.push(`${gesehen.get(key)} = ${n} (${key})`);
    gesehen.set(key, n);
  }
  assert.deepEqual(doppelt, [], 'falsche Gleichsetzung');
  assert.ok(namen.length >= 150, `nur ${namen.length} Namen`);
});

test('mehrteilige Namen: Endvokal je Wort („Cefuroxime Axetil" = „Cefuroxim-Axetil")', () => {
  // Vorher fiel der Endvokal nur am Ende des ganzen Namens weg: FDA und BfArM
  // bekamen für dieselbe Substanz verschiedene Schlüssel.
  assert.equal(gleich('Cefuroxime Axetil', 'Cefuroxim-Axetil'), true);
  assert.equal(gleich('Cefuroxim-Axetil', 'Cefuroxim'), false, 'Ester-Form (Tablette) bleibt getrennt von Cefuroxim');
  assert.equal(gleich('Mycophenolate Mofetil', 'Mycophenolat-Mofetil'), true);
});
