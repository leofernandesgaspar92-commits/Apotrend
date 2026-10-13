// ============================================================================
//  Eigene Engpass-Quellen — von der Redaktion in der App eingetragen
// ============================================================================
//  Manche Behörden bieten einen Export an, dessen genaue Adresse nur auf ihrer
//  Seite steht (TGA Australien: „Export active shortage reports"). Statt sie
//  zu raten, trägt die Redaktion sie ein, testet sie sofort und speichert sie.
//
//  SICHERHEIT: Der Server ruft die Adresse ab. Eine frei eingetragene Adresse
//  ist damit eine Möglichkeit, den Server auf interne Dienste zu lenken
//  (Cloud-Metadaten 169.254.169.254, Datenbank im privaten Netz). Darum:
//  nur https, keine Zugangsdaten in der Adresse, keine IP-Literale aus
//  privaten/lokalen Bereichen, kein „localhost". Nur Moderation darf eintragen.
//  (Ein Hostname, der auf eine private IP AUFLÖST, wird hier nicht erkannt —
//  das bleibt eine Restlücke, deshalb auch die Rollenbeschränkung.)
//
//  `lokalErlaubt` (Umgebung APOPULSE_QUELLEN_LOKAL_ERLAUBT=1) nur für Tests.
// ============================================================================

const PRIVAT = [
  /^127\./, /^10\./, /^192\.168\./, /^169\.254\./, /^0\./, /^172\.(1[6-9]|2\d|3[01])\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];

/** @returns {string|null} Fehlergrund oder null, wenn die Adresse erlaubt ist. */
export function quellenUrlFehler(url, { lokalErlaubt = false } = {}) {
  let u;
  try { u = new URL(String(url || '').trim()); } catch { return 'keine gültige Adresse'; }
  if (lokalErlaubt && (u.protocol === 'http:' || u.protocol === 'https:')) return null;
  if (u.protocol !== 'https:') return 'nur https-Adressen';
  if (u.username || u.password) return 'keine Zugangsdaten in der Adresse';
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return 'keine lokalen Adressen';
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) && PRIVAT.some((r) => r.test(h))) return 'keine privaten Netzadressen';
  // IPv6-Literale gar nicht: „[::ffff:127.0.0.1]" verpackt eine interne IPv4-
  // Adresse, und Behörden-Exporte laufen über Hostnamen, nicht über IP-Adressen.
  if (h.includes(':')) return 'keine IP-Adressen, bitte den Hostnamen der Behörde';
  if (/^\d+$/.test(h)) return 'keine gültige Adresse'; // „http://2130706433" = 127.0.0.1
  return null;
}

export function createEigeneQuellen({ istLand, lokalErlaubt = false } = {}) {
  const quellen = new Map(); // id -> Quelle
  let zaehler = 0;

  const SPALTEN = ['wirkstoff', 'bezeichnung', 'status', 'grund', 'gemeldet_am', 'voraussichtlich_bis'];
  // Spaltenzuordnung: nur bekannte Felder, kurze Namen. Leere fallen weg.
  const spalten = (c) => Object.fromEntries(SPALTEN.map((k) => [k, String((c && c[k]) || '').trim()]).filter(([, v]) => v));

  function pruefe({ country, format, url, label, standardStatus, columns }) {
    const cc = String(country || '').toUpperCase();
    if (!istLand(cc)) return 'unbekanntes Land';
    if (!['csv', 'json'].includes(format)) return 'Format muss csv oder json sein';
    const f = quellenUrlFehler(url, { lokalErlaubt });
    if (f) return f;
    if (standardStatus && !['kritisch', 'eingeschraenkt'].includes(standardStatus)) return 'unbekannter Standardstatus';
    if (String(label || '').length > 80) return 'Bezeichnung zu lang (max. 80 Zeichen)';
    if (columns && Object.values(columns).some((v) => String(v || '').length > 80)) return 'Spaltenname zu lang (max. 80 Zeichen)';
    return null;
  }

  const bauen = (id, e) => ({
    id, kind: 'shortages', country: String(e.country).toUpperCase(), format: e.format, url: String(e.url).trim(),
    label: String(e.label || '').trim() || id, standardStatus: e.standardStatus || null, columns: spalten(e.columns),
    official: true, verified: false, configured: true, eigen: true, fallbacks: [],
  });

  return {
    pruefe,
    /** Ungespeicherte Quelle für einen Probe-Abruf bauen (wirft bei Fehler). */
    entwurf(e) {
      const f = pruefe(e); if (f) { const err = new Error(f); err.status = 400; err.code = 'quelle_ungueltig'; throw err; }
      return bauen('entwurf', e);
    },
    hinzufuegen(e) {
      const f = pruefe(e); if (f) { const err = new Error(f); err.status = 400; err.code = 'quelle_ungueltig'; throw err; }
      const id = `eigen_${String(e.country).toLowerCase()}_${++zaehler}`;
      const q = bauen(id, e);
      quellen.set(id, q);
      return q;
    },
    entfernen(id) { return quellen.delete(String(id)); },
    get(id) { return quellen.get(String(id)) || null; },
    liste() { return [...quellen.values()]; },
    __dump() { return { zaehler, quellen: [...quellen.values()] }; },
    __load(d) {
      quellen.clear(); zaehler = 0;
      if (!d) return;
      zaehler = Number(d.zaehler) || 0;
      for (const q of d.quellen || []) if (q && q.id) quellen.set(q.id, q);
    },
  };
}
