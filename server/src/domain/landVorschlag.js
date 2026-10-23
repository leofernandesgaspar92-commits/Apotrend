// ============================================================================
//  Land automatisch vorschlagen — und nur dann festlegen, wenn es sicher ist
// ============================================================================
//  Owner: „Länder automatisch nach Lokation wählen und nur nach Bedarf ändern."
//
//  Signale (alle aus dem Browser, ohne Rückfrage):
//    1. Zeitzone des Geräts  — der Ort („Africa/Dakar" → SN).
//    2. Sprach-Region        — „fr-SN", „en-KE" (oft Standard „en-US", daher schwach).
//
//  SICHER (Land wird ohne Nachfrage gesetzt) nur, wenn die Zeitzone genau ein
//  Land des Registers ergibt UND keine Sprach-Region auf ein ANDERES Land des
//  Registers zeigt. Wer in Kenia „de-AT" eingestellt hat, wird gefragt (Kenia
//  oder Österreich). Werksvorgaben wie „en-US" zählen nicht (siehe unten).
//  Ohne passende Zeitzone: Vorschläge, die Person wählt.
//  Geändert wird später nur auf Wunsch („Land ändern").
// ============================================================================
import { ZEITZONE_LAND } from '../data/zeitzonen.js';

// Werksvorgaben der Handys: Android stellt weltweit „en-US", „pt-BR", „ar-EG" ein —
// auch in Uganda, Mosambik, Marokko. Sie sagen nichts über den Ort und dürfen die
// Zeitzone nicht überstimmen. Nur eine bewusst gewählte Region („en-KE", „fr-SN") zählt.
export const WERKSVORGABEN = Object.freeze(['en-US', 'pt-BR', 'ar-EG', 'ar-SA', 'fr-FR', 'es-ES', 'de-DE', 'zh-CN', 'ru-RU']);

export function landVorschlag({ zeitzone = '', sprachen = [], laender = {} } = {}) {
  const imRegister = (cc) => !!laender[cc];
  const ausZone = (ZEITZONE_LAND[String(zeitzone)] || []).filter(imRegister);
  const region = (s) => (String(s).trim().match(/^[a-z]{2,3}[-_]([A-Za-z]{2})\b/) || [])[1];
  const liste = (Array.isArray(sprachen) ? sprachen : String(sprachen).split(',')).map((s) => String(s).trim()).filter(Boolean);
  const ausSprache = [...new Set(liste.filter((s) => !WERKSVORGABEN.some((w) => w.toLowerCase() === s.replace('_', '-').toLowerCase()))
    .map(region).filter(Boolean).map((c) => c.toUpperCase()).filter(imRegister))];
  if (ausZone.length === 1) {
    const land = ausZone[0];
    const anderes = ausSprache.filter((c) => c !== land);
    if (!anderes.length) return { land, kandidaten: [land], grund: 'zeitzone' };
    return { land: null, kandidaten: [land, ...anderes].slice(0, 3), grund: 'widerspruch' };
  }
  const kandidaten = [...new Set([...ausZone, ...ausSprache])].slice(0, 3);
  return { land: null, kandidaten, grund: kandidaten.length ? 'unklar' : 'unbekannt' };
}
