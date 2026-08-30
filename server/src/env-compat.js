// ============================================================================
//  Alte Variablennamen weiterhin akzeptieren (APOTREND_* -> APOPULSE_*)
// ============================================================================
//  Mit der Umbenennung auf ApoPulse heissen alle Umgebungsvariablen
//  APOPULSE_*. Vier davon liegen aber im Render-Dashboard und NUR dort:
//
//    APOTREND_TOKEN_SECRET     einmalig erzeugt (generateValue) — ein neuer
//                              Wert loggt saemtliche Nutzer:innen aus
//    APOTREND_ADMIN_PASSWORD   von Hand gesetzt (sync:false) — nicht
//                              wiederherstellbar, der Moderationszugang waere weg
//    APOTREND_DATA_FILE        Pfad des Snapshots — ein anderer Pfad heisst
//                              „alle Daten verschwunden"
//    APOTREND_ADMIN_EMAIL
//
//  Ein reines Suchen-und-Ersetzen haette diese vier Werte beim naechsten
//  Deploy ins Leere laufen lassen. Deshalb dieser Baustein: Er spiegelt jede
//  vorhandene APOTREND_-Variable auf ihren APOPULSE_-Namen, sofern der neue
//  Name nicht ohnehin gesetzt ist. Der neue Name gewinnt also immer.
//
//  WICHTIG — Reihenfolge: Dieses Modul muss VOR allen anderen importiert
//  werden. Manche Module lesen ihre Werte beim Laden (z. B. http/token.js).
//  ESM wertet Importe in Quelltextreihenfolge aus; steht dieser Import oben,
//  ist die Spiegelung fertig, bevor irgendein anderes Modul nachsieht.
//
//  Der Baustein ist eine Uebergangshilfe, kein Dauerzustand: Sobald die
//  Variablen in Render auf APOPULSE_ umbenannt sind, kann er entfallen.
//  `legacyEnvNamesInUse()` sagt, ob noch jemand die alten Namen benutzt.
// ============================================================================

export const LEGACY_PREFIX = 'APOTREND_';
export const CURRENT_PREFIX = 'APOPULSE_';

/**
 * Alte Namen auf neue spiegeln. Gibt die uebernommenen Namen zurueck.
 *
 * Bewusst NICHT umgekehrt: Ein gesetzter APOPULSE_-Wert wird nie ueberschrieben.
 * Sonst koennte der Owner nach der Umstellung in Render nicht mehr steuern,
 * welcher Wert gilt — der alte wuerde den neuen verdraengen.
 */
export function applyLegacyEnvAliases(env = process.env) {
  const uebernommen = [];
  for (const key of Object.keys(env)) {
    if (!key.startsWith(LEGACY_PREFIX)) continue;
    const neu = CURRENT_PREFIX + key.slice(LEGACY_PREFIX.length);
    // Nur setzen, wenn der neue Name FEHLT. Ein absichtlich leerer neuer Wert
    // (z. B. „Quelle abschalten") ist eine Aussage und darf nicht vom alten
    // Wert ueberschrieben werden — deshalb `in`, nicht Wahrheitswert.
    if (neu in env) continue;
    env[neu] = env[key];
    uebernommen.push(key);
  }
  return uebernommen;
}

/**
 * Welche alten Namen liegen noch in der Umgebung? Fuer Hinweis und
 * Statusansicht — solange hier etwas steht, ist die Umbenennung in Render
 * noch nicht nachgezogen.
 */
export function legacyEnvNamesInUse(env = process.env) {
  return Object.keys(env).filter((k) => k.startsWith(LEGACY_PREFIX)).sort();
}

// Beim Import ausfuehren — genau darum wird dieses Modul zuerst importiert.
const uebernommen = applyLegacyEnvAliases();
if (uebernommen.length) {
  console.log(`ApoPulse: ${uebernommen.length} Umgebungsvariable(n) noch unter dem alten `
    + `Namen ${LEGACY_PREFIX}* gefunden und uebernommen. Sie funktionieren weiter; `
    + `in Render koennen sie bei Gelegenheit auf ${CURRENT_PREFIX}* umbenannt werden.`);
}
