// ============================================================================
//  Render-Variablen: Leerzeichen und Zeilenumbrüche am Rand entfernen
// ============================================================================
//  Beim Kopieren in das Render-Dashboard rutscht leicht ein Leerzeichen oder
//  Zeilenumbruch an den Rand eines Werts. Bis 11/2026 sperrte das z. B. die
//  Redaktion aus (APOPULSE_ADMIN_PASSWORD mit „\n" am Ende) oder schrieb den
//  Umbruch in die client_id des Google-Anmeldelinks — jeweils ohne Hinweis.
//  Einige Bausteine bereinigten selbst (Mail, Wallets, VAPID), die meisten nicht.
//
//  Dieser Baustein wird direkt nach env-compat.js geladen (vor allem anderen,
//  das Werte beim Laden liest) und bereinigt NUR die Ränder der App-Variablen —
//  innen bleibt alles (z. B. eine mehrzeilige Anschrift). Fremde Variablen
//  (PATH usw.) bleiben unangetastet. Ins Protokoll kommen nur NAMEN, nie Werte.
// ============================================================================

const APP_VARIABLE = /^(APOPULSE_|APOTREND_|OAUTH_|STRIPE_|PAYPAL_|COINBASE_|AISSTREAM_|DATABASE_URL$|DIRECT_URL$)/;

/** Ränder bereinigen; gibt die Namen der geänderten Variablen zurück. */
export function raenderBereinigen(env = process.env) {
  const geaendert = [];
  for (const [name, wert] of Object.entries(env)) {
    if (!APP_VARIABLE.test(name) || typeof wert !== 'string') continue;
    const sauber = wert.trim();
    if (sauber !== wert) { env[name] = sauber; geaendert.push(name); }
  }
  return geaendert;
}

const namen = raenderBereinigen();
if (namen.length) console.warn(`ℹ️  Leerzeichen/Zeilenumbruch am Rand entfernt bei: ${namen.join(', ')} (Werte unverändert gelassen, nur die Ränder). Am besten in Render einmal sauber neu eintragen.`);
