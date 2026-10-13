// ============================================================================
//  @Handle: Format, Vorschlag aus dem Namen, freier Handle
// ============================================================================
//  Bis 10/2026 musste man bei der Registrierung einen Handle selbst wählen.
//  War er zu kurz oder vergeben, legte der Server das Konto TROTZDEM an und
//  scheiterte erst beim Profil — die E-Mail war damit verbrannt („bereits
//  vergeben"), das Konto hatte kein Profil. Jetzt wird vorher geprüft, und
//  ohne Wunsch entsteht der Handle aus dem Namen (wie eine LinkedIn-Adresse).
// ============================================================================

export const HANDLE_RE = /^[a-z0-9_]{3,30}$/;

/** „@Anna_Huber " -> „anna_huber" (ohne Prüfung). */
export function normalizeHandle(h) {
  return String(h || '').trim().replace(/^@+/, '').toLowerCase();
}

const UMSCHRIFT = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss', æ: 'ae', ø: 'o', œ: 'oe', å: 'a', ł: 'l', đ: 'd' };

/** Lesbarer Vorschlag aus einem Namen: „Dr. Jürgen Müller" -> „dr_juergen_mueller". */
export function handleAusName(name) {
  let s = String(name || '').toLowerCase();
  s = s.replace(/[äöüßæøœåłđ]/g, (c) => UMSCHRIFT[c]);
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); // José -> jose, Conceição -> conceicao
  s = s.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24).replace(/_+$/, '');
  return s.length >= 3 ? s : 'mitglied';
}

/** Erster freier Handle zum Namen: „anna_huber", sonst „anna_huber_2", „_3" … */
export function freierHandle(name, vergeben) {
  const basis = handleAusName(name);
  if (!vergeben(basis)) return basis;
  for (let i = 2; i < 1000; i++) {
    const h = `${basis}_${i}`;
    if (!vergeben(h)) return h;
  }
  // Praktisch unerreichbar; dann eine Zufallsendung statt Endlosschleife.
  return `${basis}_${Date.now().toString(36)}`.slice(0, 30);
}
