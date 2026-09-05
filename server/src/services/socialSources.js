// ============================================================================
//  Amtliche Konten in sozialen Netzwerken — nur mit NACHGEWIESENER Identität
// ============================================================================
//  Der Owner will Meldungen auch aus sozialen Netzwerken übernehmen, „aber nur
//  wenn sie verifiziert sind". Das ist die richtige Bedingung, und sie ist der
//  Grund, warum hier nur EIN Netzwerk unterstützt wird.
//
//  ──────────────────────────────────────────────────────────────────────────
//  WARUM NUR MASTODON
//  ──────────────────────────────────────────────────────────────────────────
//  · X/Twitter: Lesender Zugriff ist kostenpflichtig. Ausgeschlossen.
//  · Instagram/Facebook: Zugriff nur auf Seiten, die man selbst verwaltet,
//    nach App-Prüfung und Unternehmens-Verifizierung. Fremde Behördenkonten
//    lassen sich damit nicht abrufen.
//  · LinkedIn: Nur über ein Partnerprogramm.
//  · Mastodon: Öffentliche Schnittstelle, kein Schlüssel, keine Kosten —
//    UND als einziges mit einem Nachweis, der sich technisch prüfen lässt.
//
//  ──────────────────────────────────────────────────────────────────────────
//  WAS „VERIFIZIERT" HIER HEISST
//  ──────────────────────────────────────────────────────────────────────────
//  NICHT ein gekaufter Haken. Ein Mastodon-Konto kann in seinem Profil eine
//  Adresse hinterlegen; der Server prüft, ob von DIESER Seite ein Rückverweis
//  auf das Konto zeigt (`rel="me"`). Erst dann setzt er `verified_at`. Das ist
//  ein Nachweis, dass dieselbe Stelle beide Seiten kontrolliert.
//
//  Dieses Modul geht einen Schritt weiter und verlangt zusätzlich, dass die
//  nachgewiesene Adresse zur AMTLICHEN DOMAIN der Behörde des jeweiligen
//  Landes gehört (`regulator_url` aus data/countries.js).
//
//  Beispiel: Ein Konto @bfarm@irgendein.server ist erst dann als BfArM
//  akzeptiert, wenn es nachweislich bfarm.de kontrolliert. Ein Konto, das
//  lediglich „BfArM" heißt und ein Behördenlogo trägt, kommt nicht durch.
//
//  Diese Strenge ist Absicht. Eine falsche Engpass- oder Rückrufmeldung mit
//  Amtsanstrich ist der teuerste denkbare Fehler dieser Plattform.
// ============================================================================

import { COUNTRIES } from '../data/countries.js';
// Dieselbe Textbereinigung wie bei den Behoerden-Feeds statt einer zweiten,
// eigenen Fassung. Sie kann drei Dinge, die eine schnell hingeschriebene
// Variante nicht kann: Sie frisst kein „Preis < 5 €" weg, sie macht aus
// doppelt kodiertem Markup kein echtes Tag, und sie loest ein doppelt
// kodiertes Kaufmanns-Und trotzdem auf. Zwei Fassungen derselben Regeln
// laufen sonst auseinander — ausgerechnet bei der Frage, was am Ende auf dem
// Bildschirm einer Apotheke steht.
import { stripMarkup } from './feedParsers.js';

/** Erlaubte Netzwerke. Bewusst kurz — siehe Kopf. */
export const SOCIAL_NETWORKS = ['mastodon'];

/**
 * Host einer Adresse, klein geschrieben, ohne `www.`.
 * Gibt null zurück statt zu werfen: Eine unbrauchbare Adresse ist hier kein
 * Fehlerfall, sondern schlicht „kein Nachweis".
 */
export function hostOf(url) {
  try {
    const h = new URL(String(url)).hostname.toLowerCase();
    return h.startsWith('www.') ? h.slice(4) : h;
  } catch { return null; }
}

/**
 * Gehört `host` zur Domain `domain` (oder einer ihrer Unterdomains)?
 *
 * Der Punkt-Vergleich ist wichtig: Ohne ihn würde `nicht-bfarm.de` als
 * Unterdomain von `bfarm.de` durchgehen — ein naives `endsWith` ist hier eine
 * Sicherheitslücke, keine Bequemlichkeit.
 */
export function isSameOrSubdomain(host, domain) {
  if (!host || !domain) return false;
  return host === domain || host.endsWith('.' + domain);
}

/** Adressen, deren Besitz ein Konto NACHGEWIESEN hat. */
export function verifiedUrls(account) {
  const felder = (account && account.fields) || [];
  return felder
    // `verified_at` setzt der Server NUR nach erfolgreichem Rückverweis.
    .filter((f) => f && f.verified_at)
    // Der Wert kommt als HTML-Schnipsel mit <a href="…">.
    .map((f) => {
      const roh = String(f.value || '');
      const m = roh.match(/href=["']([^"']+)["']/i);
      return m ? m[1] : roh.trim();
    })
    .filter(Boolean);
}

/**
 * Ist das Konto die amtliche Stelle dieses Landes?
 *
 * Gibt einen BEGRÜNDETEN Befund zurück, nicht nur true/false: Wer eine Quelle
 * einträgt, die abgelehnt wird, muss erfahren warum — sonst probiert er
 * ratlos herum.
 */
export function checkOfficial(account, country) {
  const land = COUNTRIES[String(country || '').toUpperCase()];
  if (!land) return { ok: false, reason: `Unbekanntes Land: ${country}` };

  const amtlich = hostOf(land.regulator_url);
  if (!amtlich) {
    // Für einige Länder ist die amtliche Domain im Register bewusst null,
    // weil sie nicht belegt ist. Ohne Bezugspunkt kann hier nichts geprüft
    // werden — und ungeprüft durchzulassen wäre das Gegenteil des Auftrags.
    return { ok: false, reason: `Für ${land.code} ist keine amtliche Domain hinterlegt — nicht prüfbar` };
  }

  const nachgewiesen = verifiedUrls(account);
  if (!nachgewiesen.length) {
    return { ok: false, reason: 'Das Konto hat keine nachgewiesene Adresse (kein verified_at)' };
  }

  const treffer = nachgewiesen.find((u) => isSameOrSubdomain(hostOf(u), amtlich));
  if (!treffer) {
    return {
      ok: false,
      reason: `Nachgewiesen sind ${nachgewiesen.map(hostOf).filter(Boolean).join(', ')} — `
        + `erwartet wurde ${amtlich} (${land.regulator})`,
    };
  }
  return { ok: true, verifiedUrl: treffer, domain: amtlich, regulator: land.regulator };
}

/**
 * Beiträge eines Mastodon-Kontos in dieselbe Form bringen wie News-Meldungen.
 *
 * Übersprungen werden:
 *  · Weiterleitungen (reblog) — der Ursprung gehört der anderen Stelle, und
 *    dessen Identität ist hier NICHT geprüft.
 *  · Antworten (in_reply_to_id) — Gesprächsfetzen ohne den Zusammenhang sind
 *    im Fach-Feed unbrauchbar.
 *  · Beiträge, die nicht öffentlich sind.
 */
export function postsFromMastodon(statuses, { source }) {
  const liste = Array.isArray(statuses) ? statuses : [];
  return liste
    .filter((st) => st && !st.reblog && !st.in_reply_to_id && st.visibility === 'public')
    .map((st) => {
      const text = stripMarkup(String(st.content || ''));
      return {
        key: `${source.id}:${st.url || st.uri || st.id}`,
        sourceId: source.id,
        sourceLabel: source.label || source.id,
        official: true, // nur nachgewiesene Konten kommen bis hierher
        country: source.country,
        // Als Titel dient der erste Satz — ein Mastodon-Beitrag hat keinen.
        title: ersterSatz(text, 140),
        link: st.url || st.uri || null,
        summary: text,
        publishedAt: st.created_at || null,
        categories: (st.tags || []).map((t) => t && t.name).filter(Boolean),
      };
    })
    .filter((p) => p.title && p.link); // ohne Rückverweis keine belegbare Meldung
}

function ersterSatz(text, max) {
  if (text.length <= max) return text;
  const schnitt = text.slice(0, max);
  const stopp = Math.max(schnitt.lastIndexOf('. '), schnitt.lastIndexOf('! '), schnitt.lastIndexOf('? '));
  return stopp > max * 0.4 ? schnitt.slice(0, stopp + 1) : schnitt.trimEnd() + ' …';
}

/**
 * Eine Konto-Quelle abrufen: Konto suchen, Identität prüfen, dann erst lesen.
 *
 * Die Reihenfolge ist der ganze Punkt. Erst wird geprüft, WER da schreibt —
 * und nur bei bestandener Prüfung werden überhaupt Beiträge geholt.
 */
export async function fetchMastodonSource(source, { fetchJson, log = console } = {}) {
  const server = hostOf(source.url) || String(source.url || '').trim();
  const handle = String(source.account || '').replace(/^@/, '');
  if (!server || !handle) {
    throw new Error('Quelle unvollständig: Server und Konto (account) nötig');
  }

  const konto = await fetchJson(`https://${server}/api/v1/accounts/lookup?acct=${encodeURIComponent(handle)}`);
  const befund = checkOfficial(konto, source.country);
  if (!befund.ok) {
    // KEIN Abruf der Beiträge. Ein nicht nachgewiesenes Konto liefert hier
    // nichts — auch dann nicht, wenn es echt aussieht.
    log.warn?.(`ApoPulse Social: ${source.id} abgelehnt — ${befund.reason}`);
    return { verified: false, reason: befund.reason, items: [] };
  }

  const statuses = await fetchJson(
    `https://${server}/api/v1/accounts/${encodeURIComponent(konto.id)}/statuses`
    + '?limit=20&exclude_replies=true&exclude_reblogs=true',
  );
  return {
    verified: true,
    verifiedUrl: befund.verifiedUrl,
    regulator: befund.regulator,
    items: postsFromMastodon(statuses, { source }),
  };
}
