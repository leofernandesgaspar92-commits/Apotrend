// Gemeinsame Validierung für Medien (Bilder) + Quellen-Links. Wird von der
// Social- und der Austausch-Schicht genutzt — bewusst streng, damit weder
// Fremd-Hosts noch Skript-URLs (XSS) hineinkommen.
import { istAdresse, bildAusAdresse } from './bilder.js';

export const MAX_IMAGE = 900_000; // ~ base64-Länge (Client verkleinert vorab)

// Bild nur als data:image-URL (png/jpeg/webp/gif). Sonst -> Fehler.
// Ausnahme: /api/bild/<hash> — so steht ein vorhandenes Bild in den Antworten
// (domain/bilder.js); wer bearbeitet, schickt es unverändert zurück. Aufgelöst
// wird nur, was der Server selbst gespeichert hat — fremde Adressen nie.
export function cleanImage(image) {
  if (image == null || image === '') return null;
  let s = String(image);
  if (istAdresse(s)) {
    s = bildAusAdresse(s);
    if (!s) { const e = new Error('Bild bitte noch einmal auswählen.'); e.code = 'image_invalid'; throw e; }
  }
  if (!/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(s)) { const e = new Error('Ungueltiges Bildformat.'); e.code = 'image_invalid'; throw e; }
  if (s.length > MAX_IMAGE) { const e = new Error('Bild zu groß (bitte kleineres wählen).'); e.code = 'image_too_large'; throw e; }
  return s;
}

// Quelle nur als http(s)-Link (keine javascript:/data:-URLs).
export function cleanSourceUrl(url) {
  if (url == null || url === '') return null;
  const s = String(url).trim();
  if (!/^https?:\/\/[^\s]{3,500}$/i.test(s)) throw Object.assign(new Error('Quelle muss ein http(s)-Link sein.'), { code: 'source_url_invalid' });
  return s;
}
