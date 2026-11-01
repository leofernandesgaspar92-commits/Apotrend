// ============================================================================
//  Datenbank-Adressen für Prisma — Render-Postgres UND Supabase
// ============================================================================
//  Von Render aus erreicht man Supabase über dessen Pooler (Supavisor):
//    …pooler.supabase.com:6543  Transaktionsmodus — Prisma braucht dort
//                               `pgbouncer=true` (keine vorbereiteten Anfragen),
//                               sonst bricht es mit „prepared statement … already
//                               exists" ab.
//    …pooler.supabase.com:5432  Sitzungsmodus — hier laufen Migrationen
//                               (`prisma migrate deploy` hängt im Transaktionsmodus).
//  Damit der Owner nur EINE Variable (DATABASE_URL) setzen muss, leitet dieses
//  Modul beides ab. Wer es anders braucht, setzt DIRECT_URL selbst.
//  Nie Zugangsdaten protokollieren — nur Host und Port (dbZiel).
// ============================================================================

const istSupabasePooler = (u) => /\.pooler\.supabase\.com$/i.test(u.hostname);

/** Laufzeit-Adresse: bei Supabase-Transaktions-Pooler `pgbouncer=true` ergänzen. */
export function laufzeitUrl(roh) {
  const s = String(roh || '').trim();
  if (!s) return '';
  let u;
  try { u = new URL(s); } catch { return s; } // unbekanntes Format: unverändert (Prisma meldet selbst)
  if (istSupabasePooler(u) && u.port === '6543' && !u.searchParams.has('pgbouncer')) u.searchParams.set('pgbouncer', 'true');
  return u.toString();
}

/** Adresse für Migrationen: DIRECT_URL, sonst beim Supabase-Pooler der Sitzungsmodus (5432). */
export function migrationsUrl(roh, direkt = '') {
  if (String(direkt || '').trim()) return String(direkt).trim();
  const s = String(roh || '').trim();
  if (!s) return '';
  let u;
  try { u = new URL(s); } catch { return s; }
  if (istSupabasePooler(u) && u.port === '6543') {
    u.port = '5432';
    u.searchParams.delete('pgbouncer');
  }
  return u.toString();
}

/** Für Meldungen: nur Host und Port, nie Benutzer/Passwort. */
export function dbZiel(roh) {
  try { const u = new URL(String(roh || '').trim()); return `${u.hostname}${u.port ? ':' + u.port : ''}`; } catch { return 'unbekannt'; }
}
