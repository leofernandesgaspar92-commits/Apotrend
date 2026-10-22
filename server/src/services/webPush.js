// ============================================================================
//  Web-Push: Engpass-Alarm aufs Handy, auch wenn ApoPulse geschlossen ist
// ============================================================================
//  Ohne Push erfährt eine Apotheke von einem neuen Engpass erst beim nächsten
//  Öffnen der App — oder am Montag im Wochenbericht. Der Informationsvorsprung
//  entsteht aber in den Stunden, bevor alle anderen nachbestellen.
//
//  Umgesetzt nur mit Node-Bordmitteln (Vorgabe: keine Fremdpakete):
//   - VAPID (RFC 8292): signiertes JWT (ES256) je Push-Dienst.
//   - Verschlüsselung (RFC 8291, Inhalt „aes128gcm" nach RFC 8188): ECDH P-256
//     mit dem Schlüssel des Browsers, HKDF, AES-128-GCM. Der Push-Dienst
//     (Google, Mozilla, Apple) sieht nur Chiffre.
//
//  Regeln:
//   - Ziel-Adressen nur https und nur bekannte Push-Dienste — der Server
//     schickt sonst Anfragen an beliebige Adressen, die ein Konto einträgt.
//   - Abgelaufene Abos (404/410 vom Push-Dienst) werden gelöscht.
//   - Nur sicherheitsrelevante Meldungen mit Quelle gehen als Push (Engpass
//     im eigenen Land, wieder lieferbar, Frühwarnung Ausland, Meldung aus
//     Apotheken) — keine Likes, keine Werbung.
// ============================================================================
import crypto from 'node:crypto';
import { AppError } from '../domain/errors.js';
import { frLand } from '../domain/franzLand.js';

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const vonB64u = (s) => Buffer.from(String(s || ''), 'base64url');

export const MAX_ABOS = 10;
// Push-Dienste der Browser. Neue Dienste bewusst ergänzen, nicht offen lassen.
const PUSH_DIENSTE = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];

export function vapidSchluesselErzeugen() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  return { publicKey: b64u(ecdh.getPublicKey()), privateKey: b64u(ecdh.getPrivateKey()) };
}

function privaterSchluessel({ publicKey, privateKey }) {
  const pub = vonB64u(publicKey);
  return crypto.createPrivateKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256', d: privateKey, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) } });
}

/** VAPID-Kopfzeile für einen Push-Dienst (Zielgruppe = Herkunft der Abo-Adresse). */
export function vapidKopf(endpoint, schluessel, subject, jetztS = Math.floor(Date.now() / 1000)) {
  const aud = new URL(endpoint).origin;
  const kopf = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const inhalt = b64u(JSON.stringify({ aud, exp: jetztS + 12 * 3600, sub: subject }));
  const sig = crypto.sign('sha256', Buffer.from(`${kopf}.${inhalt}`), { key: privaterSchluessel(schluessel), dsaEncoding: 'ieee-p1363' });
  return `vapid t=${kopf}.${inhalt}.${b64u(sig)}, k=${schluessel.publicKey}`;
}

/**
 * Nachricht für EIN Abo verschlüsseln (RFC 8291). `zufall` nur für Tests.
 * @returns {Buffer} Rumpf der Push-Anfrage
 */
export function verschluesseln(text, { p256dh, auth }, zufall = {}) {
  const uaPublic = vonB64u(p256dh);
  const authSecret = vonB64u(auth);
  const ecdh = crypto.createECDH('prime256v1');
  if (zufall.privat) ecdh.setPrivateKey(zufall.privat); else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const geteilt = ecdh.computeSecret(uaPublic);
  const salt = zufall.salt || crypto.randomBytes(16);
  const hkdf = (ikm, s, info, n) => Buffer.from(crypto.hkdfSync('sha256', ikm, s, info, n));
  const ikm = hkdf(geteilt, authSecret, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]), 32);
  const cek = hkdf(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const chiffre = Buffer.concat([c.update(Buffer.concat([Buffer.from(String(text)), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, chiffre]);
}

/** Abo-Angaben des Browsers prüfen (PushSubscription.toJSON()). */
export function aboPruefen(sub, { lokalErlaubt = false } = {}) {
  let u;
  try { u = new URL(String(sub && sub.endpoint)); } catch { throw new AppError('push_abo', 'Ungültiges Abo.'); }
  const lokal = lokalErlaubt && u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
  if (!lokal && (u.protocol !== 'https:' || !PUSH_DIENSTE.some((rx) => rx.test(u.hostname)))) throw new AppError('push_dienst', 'Unbekannter Push-Dienst.');
  const k = (sub && sub.keys) || {};
  const p = vonB64u(k.p256dh); const a = vonB64u(k.auth);
  if (p.length !== 65 || p[0] !== 4 || a.length !== 16) throw new AppError('push_abo', 'Ungültiges Abo.');
  return { endpoint: u.href, keys: { p256dh: b64u(p), auth: b64u(a) } };
}

export function createWebPush({ schluessel = vapidSchluesselErzeugen(), subject = 'mailto:kontakt@apopulse.com', fetchImpl = globalThis.fetch, lokalErlaubt = false, ausUmgebung = false } = {}) {
  let keys = schluessel;
  const abos = new Map(); // endpoint -> { user_id, endpoint, keys, seit }
  let gesendetGesamt = 0;

  async function an(abo, text) {
    const r = await fetchImpl(abo.endpoint, {
      method: 'POST',
      headers: { TTL: '86400', Urgency: 'high', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', Authorization: vapidKopf(abo.endpoint, keys, subject) },
      body: verschluesseln(text, abo.keys),
    });
    if (r.status === 404 || r.status === 410) { abos.delete(abo.endpoint); return 'entfernt'; }
    return r.status >= 200 && r.status < 300 ? 'ok' : 'fehler';
  }

  return {
    oeffentlicherSchluessel: () => keys.publicKey,
    abonnieren(userId, sub) {
      const a = aboPruefen(sub, { lokalErlaubt });
      // Dasselbe Gerät, anderes Konto: das Abo wandert (sonst bekäme die
      // vorherige Person auf diesem Gerät weiter fremde Alarme).
      abos.delete(a.endpoint);
      const eigene = [...abos.values()].filter((x) => x.user_id === userId).sort((x, y) => x.seit.localeCompare(y.seit));
      if (eigene.length >= MAX_ABOS) abos.delete(eigene[0].endpoint); // ältestes Gerät fällt heraus
      abos.set(a.endpoint, { user_id: userId, ...a, seit: new Date().toISOString() });
      return { ok: true, geraete: this.geraete(userId) };
    },
    abbestellen(userId, endpoint) {
      const a = abos.get(String(endpoint || ''));
      if (a && a.user_id === userId) abos.delete(a.endpoint);
      return { ok: true, geraete: this.geraete(userId) };
    },
    geraete: (userId) => [...abos.values()].filter((x) => x.user_id === userId).length,
    nutzerEntfernen(userId) { for (const a of [...abos.values()]) if (a.user_id === userId) abos.delete(a.endpoint); },
    /** An alle Geräte einer Person. Fehler eines Geräts halten die anderen nicht auf. */
    async senden(userId, nachricht) {
      const text = JSON.stringify(nachricht);
      const ziele = [...abos.values()].filter((x) => x.user_id === userId);
      const erg = { ok: 0, entfernt: 0, fehler: 0 };
      await Promise.all(ziele.map(async (a) => {
        try { const s = await an(a, text); if (s === 'ok') erg.ok++; else if (s === 'entfernt') erg.entfernt++; else erg.fehler++; } catch { erg.fehler++; }
      }));
      gesendetGesamt += erg.ok;
      return erg;
    },
    stand: () => ({ abos: abos.size, gesendet: gesendetGesamt }),
    __dump() { return { abos: [...abos.values()], schluessel: ausUmgebung ? null : keys }; },
    __load(d) {
      abos.clear();
      // Gesicherte Schlüssel übernehmen (sonst wären alle Abos nach einem Neustart
      // wertlos) — außer sie kommen fest aus der Umgebung.
      if (!ausUmgebung && d && d.schluessel && d.schluessel.publicKey && d.schluessel.privateKey) keys = d.schluessel;
      for (const a of (d && d.abos) || []) if (a && a.endpoint) abos.set(a.endpoint, a);
    },
  };
}

// ── Texte ───────────────────────────────────────────────────────────────────
const TEXTE = {
  de: {
    shortage_home: (w, l) => [`Engpass: ${w}`, `${w} ist laut Behörde in ${l} knapp. Tippen für Quelle und Verlauf.`],
    shortage_ended: (w, l) => [`Wieder lieferbar: ${w}`, `${w} steht in ${l} nicht mehr auf der Engpassliste.`],
    shortage_abroad: (w, l) => [`Frühwarnung: ${w}`, `${w} ist in ${l} knapp — bei Ihnen noch nicht. Vorrat prüfen.`],
    shortage_bestaetigt: (w, l, n) => [`Bestätigt: ${w}`, `${n} Apotheken in ${l} melden ${w} als knapp (nicht amtlich).`],
    watch_alert: (w) => [`Meldung aus Apotheken: ${w}`, `Eine Apotheke meldet ${w} als knapp (nicht amtlich).`],
    watch_wieder: (w) => [`Wieder verfügbar: ${w}`, `${w} ist laut Meldung aus Apotheken wieder lieferbar (nicht amtlich).`],
    watch_eingeschraenkt: (w) => [`Eingeschränkt lieferbar: ${w}`, `Eine Apotheke meldet ${w} als eingeschränkt lieferbar (nicht amtlich).`],
    watch_termin: (w, d) => [`Neuer Termin: ${w}`, d ? `${w} voraussichtlich wieder lieferbar bis ${d} (Meldung aus Apotheken).` : `Für ${w} gibt es noch keinen Liefertermin (Meldung aus Apotheken).`],
    test: () => ['ApoPulse: Benachrichtigung funktioniert', 'So kommt ein Engpass-Alarm an, auch wenn die App geschlossen ist.'],
  },
  en: {
    shortage_home: (w, l) => [`Shortage: ${w}`, `${w} is short in ${l} according to the authority. Tap for source and history.`],
    shortage_ended: (w, l) => [`Available again: ${w}`, `${w} is no longer on the shortage list in ${l}.`],
    shortage_abroad: (w, l) => [`Early warning: ${w}`, `${w} is short in ${l} — not yet in your country. Check your stock.`],
    shortage_bestaetigt: (w, l, n) => [`Confirmed: ${w}`, `${n} pharmacies in ${l} report ${w} as short (not official).`],
    watch_alert: (w) => [`Pharmacy report: ${w}`, `A pharmacy reports ${w} as short (not official).`],
    watch_wieder: (w) => [`Available again: ${w}`, `According to a pharmacy report, ${w} is available again (not official).`],
    watch_eingeschraenkt: (w) => [`Limited availability: ${w}`, `A pharmacy reports limited availability of ${w} (not official).`],
    watch_termin: (w, d) => [`New date: ${w}`, d ? `${w} expected back in stock by ${d} (pharmacy report).` : `No delivery date for ${w} yet (pharmacy report).`],
    test: () => ['ApoPulse: notifications work', 'This is how a shortage alert arrives, even when the app is closed.'],
  },
  pt: {
    shortage_home: (w, l) => [`Rutura: ${w}`, `${w} está em rutura em ${l} segundo a autoridade. Toque para ver fonte e histórico.`],
    shortage_ended: (w, l) => [`Novamente disponível: ${w}`, `${w} já não consta da lista de ruturas em ${l}.`],
    shortage_abroad: (w, l) => [`Alerta precoce: ${w}`, `${w} está em rutura em ${l} — no seu país ainda não. Verifique o stock.`],
    shortage_bestaetigt: (w, l, n) => [`Confirmado: ${w}`, `${n} farmácias em ${l} comunicam ${w} em rutura (não oficial).`],
    watch_alert: (w) => [`Comunicação de farmácias: ${w}`, `Uma farmácia comunica ${w} em rutura (não oficial).`],
    watch_wieder: (w) => [`Novamente disponível: ${w}`, `Segundo uma farmácia, ${w} está novamente disponível (não oficial).`],
    watch_eingeschraenkt: (w) => [`Disponibilidade limitada: ${w}`, `Uma farmácia comunica disponibilidade limitada de ${w} (não oficial).`],
    watch_termin: (w, d) => [`Nova data: ${w}`, d ? `${w} previsto de novo em stock até ${d} (comunicação de farmácias).` : `Ainda sem data de entrega para ${w} (comunicação de farmácias).`],
    test: () => ['ApoPulse: notificações a funcionar', 'É assim que chega um alerta de rutura, mesmo com a app fechada.'],
  },
  fr: {
    shortage_home: (w, l) => [`Pénurie : ${w}`, `${w} est en pénurie ${frLand(l)} selon l’autorité. Touchez pour voir la source et l’historique.`],
    shortage_ended: (w, l) => [`De nouveau disponible : ${w}`, `${w} ne figure plus sur la liste des pénuries ${frLand(l)}.`],
    shortage_abroad: (w, l) => [`Alerte précoce : ${w}`, `${w} est en pénurie ${frLand(l)} — pas encore dans votre pays. Vérifiez votre stock.`],
    shortage_bestaetigt: (w, l, n) => [`Confirmé : ${w}`, `${n} pharmacies ${frLand(l)} signalent ${w} en pénurie (non officiel).`],
    watch_alert: (w) => [`Signalement de pharmacie : ${w}`, `Une pharmacie signale ${w} en pénurie (non officiel).`],
    watch_wieder: (w) => [`De nouveau disponible : ${w}`, `Selon le signalement d’une pharmacie, ${w} est de nouveau disponible (non officiel).`],
    watch_eingeschraenkt: (w) => [`Disponibilité limitée : ${w}`, `Une pharmacie signale une disponibilité limitée de ${w} (non officiel).`],
    watch_termin: (w, d) => [`Nouvelle date : ${w}`, d ? `${w} de nouveau en stock prévu d’ici le ${d} (signalement de pharmacie).` : `Pas encore de date de livraison pour ${w} (signalement de pharmacie).`],
    test: () => ['ApoPulse : les notifications fonctionnent', 'Voici comment arrive une alerte de pénurie, même quand l’application est fermée.'],
  },
};
export const PUSH_TYPEN = new Set(['shortage_home', 'shortage_ended', 'shortage_abroad', 'watch_alert', 'shortage_bestaetigt']);

/** Benachrichtigung -> Push-Nachricht in der Sprache der Person. */
export function pushNachricht(n, { sprache = 'de', landName = (c) => c } = {}) {
  const T = TEXTE[sprache] || TEXTE.de;
  const teile = String(n.label || '').split(' · ');
  // watch_alert steht für mehrere Ereignisse — der Inhalt steckt im Label. Vorher
  // hieß JEDE Push-Nachricht „meldet … als knapp", auch „wieder verfügbar".
  let typ = n.type;
  if (typ === 'watch_alert') {
    const was = teile[1] || '';
    if (/Wieder verfügbar/.test(was)) typ = 'watch_wieder';
    else if (/Eingeschränkt lieferbar/.test(was)) typ = 'watch_eingeschraenkt';
    else if (/^Termin/.test(was)) typ = 'watch_termin';
  }
  const f = T[typ];
  if (!f) return null;
  const wirkstoff = n.ref_type === 'wirkstoff' || n.refType === 'wirkstoff' ? (n.ref_id || n.refId || teile[0]) : teile[0];
  const land = teile[1] && /^[A-Z]{2}$/.test(teile[1]) ? landName(teile[1]) : (teile[1] || '');
  const termin = typ === 'watch_termin' ? ((teile[1] || '').match(/(\d{4})-(\d{2})-(\d{2})/) || null) : null;
  const [titel, text] = typ === 'watch_termin'
    ? f(wirkstoff, termin ? (sprache === 'de' ? `${termin[3]}.${termin[2]}.${termin[1]}` : `${termin[3]}/${termin[2]}/${termin[1]}`) : '')
    : f(wirkstoff, land, teile[2] || '');
  const url = n.type === 'watch_alert' ? '/?tab=shortages' : `/?wirkstoff=${encodeURIComponent(wirkstoff)}`;
  return { titel, text, url, tag: `${n.type}:${wirkstoff}` };
}
export const testNachricht = (sprache = 'de') => { const [titel, text] = (TEXTE[sprache] || TEXTE.de).test(); return { titel, text, url: '/', tag: 'test' }; };
