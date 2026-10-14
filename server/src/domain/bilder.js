// ============================================================================
//  Bilder per Adresse statt eingebettet — für teure, langsame Mobilnetze
// ============================================================================
//  Bilder (Beitrag, Kommentar, Profilbild, Angebot, Anzeige) werden als
//  data:image-URL gespeichert. Bis 10/2026 standen sie auch so in JEDER
//  API-Antwort — das Profilbild sogar in jedem einzelnen Beitrag der Person.
//  30 Beiträge einer Apotheke mit 200-KB-Foto waren 6 MB je Laden des Feeds;
//  in Uganda oder Sambia kostet das echtes Geld, bei jedem Öffnen neu.
//
//  Jetzt ersetzt die JSON-Ausgabe jedes Bild durch /api/bild/<SHA-256 des
//  Inhalts>. Der Browser lädt es EINMAL und behält es (die Adresse ändert sich
//  nie, solange sich das Bild nicht ändert). Die Adresse ist 256 Bit lang und
//  nur aus einer Antwort zu erfahren, die das Bild ohnehin zeigen durfte.
//
//  Zurück (Bearbeiten schickt das vorhandene Bild unverändert mit): cleanImage
//  löst /api/bild/<hash> wieder zum gespeicherten Bild auf.
// ============================================================================
import crypto from 'node:crypto';

export const BILD_PFAD = '/api/bild/';
const BILD_URL = /^data:image\/(png|jpe?g|webp|gif);base64,/i;
const ADRESSE = /^\/api\/bild\/([0-9a-f]{64})$/;
// Obergrenze der Ablage: Bilder gelöschter Beiträge sollen nicht ewig im
// Speicher bleiben. Fällt eins heraus, legt die nächste Antwort, die es
// enthält, es wieder an.
const HOECHSTENS = 5000;

const nachHash = new Map();   // hash -> data-URL (dieselbe Zeichenkette, keine Kopie)
const nachInhalt = new Map(); // data-URL -> hash (spart das Hashen bei jeder Antwort)

function merken(hash, url) {
  nachHash.delete(hash); nachHash.set(hash, url);
  nachInhalt.delete(url); nachInhalt.set(url, hash);
  while (nachHash.size > HOECHSTENS) {
    const [alt, altUrl] = nachHash.entries().next().value;
    nachHash.delete(alt); nachInhalt.delete(altUrl);
  }
}

export const istEingebettet = (v) => typeof v === 'string' && BILD_URL.test(v);

/** data:image-URL -> /api/bild/<hash> (und merken, damit die Adresse antwortet). */
export function bildAdresse(url) {
  let hash = nachInhalt.get(url);
  if (!hash) hash = crypto.createHash('sha256').update(url).digest('hex');
  merken(hash, url);
  return BILD_PFAD + hash;
}

/** /api/bild/<hash> -> gespeicherte data:image-URL, sonst null. */
export function bildAusAdresse(s) {
  const m = typeof s === 'string' && s.match(ADRESSE);
  return m ? (nachHash.get(m[1]) || null) : null;
}

export const istAdresse = (s) => typeof s === 'string' && ADRESSE.test(s);

/** Für die Auslieferung: { typ, daten } oder null. */
export function bildHolen(hash) {
  const url = /^[0-9a-f]{64}$/.test(hash) ? nachHash.get(hash) : null;
  if (!url) return null;
  const komma = url.indexOf(',');
  const typ = url.slice(5, url.indexOf(';')).toLowerCase().replace('image/jpg', 'image/jpeg');
  return { typ, daten: Buffer.from(url.slice(komma + 1).replace(/\s+/g, ''), 'base64') };
}

/** Ersetzer für JSON.stringify: jedes eingebettete Bild wird zur Adresse. */
export const bilderAlsAdresse = (_k, v) => (istEingebettet(v) ? bildAdresse(v) : v);
