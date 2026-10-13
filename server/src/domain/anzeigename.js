// Welchen Namen zeigen wir, wenn dieselbe Substanz in mehreren Behördenlisten
// verschieden heißt? „Methylphenidate Hydrochloride" (FDA) ist für eine
// Wiener Apotheke ein Fremdwort, „Methylphenidathydrochlorid" (BfArM) nicht.
// Reihenfolge: Schreibweise des eigenen Landes, dann eines Landes mit
// derselben Sprache, dann die erste bekannte. Der Vergleich selbst läuft
// weiter über den Wirkstoff-Schlüssel (domain/inn.js) — hier geht es nur
// um die Anzeige.
import { COUNTRIES } from '../data/countries.js';

const sprache = (land) => (COUNTRIES[String(land || '').toUpperCase()] || {}).locale_default || null;

/** namen: [{ land, wirkstoff }] derselben Substanz. */
export function anzeigeName(namen, heimat) {
  const h = String(heimat || '').toUpperCase();
  const eigen = namen.find((n) => n.land === h);
  if (eigen) return eigen.wirkstoff;
  const sp = sprache(h);
  const gleich = sp && namen.find((n) => sprache(n.land) === sp);
  return (gleich || namen[0] || {}).wirkstoff || null;
}
