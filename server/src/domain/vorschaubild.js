// Vorschaubild (Open Graph) in der Sprache der Seite — erzeugt mit tools/og-bilder.mjs.
// Bis 10/2026 zeigte jede Vorschau in WhatsApp & Co. ein deutsches Bild („Behördenlisten aus Europa"),
// auch in Ghana oder Senegal. Unbekannte Sprache: Englisch.
const SPRACHEN = new Set(['de', 'en', 'fr', 'pt', 'ar']);
export const vorschaubild = (sp) => `/og-bild-${SPRACHEN.has(sp) ? sp : 'en'}.png`;
