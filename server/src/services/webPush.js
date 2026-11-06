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

export function createWebPush({ schluessel = vapidSchluesselErzeugen(), subject = 'mailto:kontakt@apopulse.com', fetchImpl = globalThis.fetch, lokalErlaubt = false, ausUmgebung = false, sitzungenAb = () => null } = {}) {
  let keys = schluessel;
  const abos = new Map(); // endpoint -> { user_id, endpoint, keys, seit }
  // Ein Abo endet mit der Sitzung, in der es entstand: älter als „Sitzungen beendet" (Passwort geändert/
  // zurückgesetzt, „auf allen anderen Geräten abmelden") = ungültig — dieselbe Regel wie für Anmelde-Schlüssel.
  const gueltig = (a) => { const ab = sitzungenAb(a.user_id); return !ab || Date.parse(a.seit || 0) >= ab; };
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
    geraete: (userId) => [...abos.values()].filter((x) => x.user_id === userId && gueltig(x)).length,
    /** Auskunft (DSGVO Art. 15): welcher Push-Dienst, seit wann — ohne die Geräteschlüssel. */
    geraeteVon: (userId) => [...abos.values()].filter((x) => x.user_id === userId && gueltig(x)).map((x) => { let dienst = ''; try { dienst = new URL(x.endpoint).host; } catch { /* egal */ } return { dienst, seit: x.seit || null }; }),
    nutzerEntfernen(userId) { for (const a of [...abos.values()]) if (a.user_id === userId) abos.delete(a.endpoint); },
    /** An alle Geräte einer Person. Fehler eines Geräts halten die anderen nicht auf. */
    async senden(userId, nachricht) {
      const text = JSON.stringify(nachricht);
      const alle = [...abos.values()].filter((x) => x.user_id === userId);
      const erg = { ok: 0, entfernt: 0, fehler: 0 };
      for (const a of alle) if (!gueltig(a)) { abos.delete(a.endpoint); erg.entfernt++; }
      const ziele = alle.filter(gueltig);
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
    watch_redaktion: (w, s) => [`Redaktion: ${w}`, `Die ApoPulse-Redaktion meldet ${w} als ${s} — mit Quelle in der App.`],
    status: { kritisch: 'kritisch knapp', eingeschraenkt: 'eingeschränkt lieferbar', verfuegbar: 'wieder lieferbar' },
    shortage_home: (w, l) => [`Engpass: ${w}`, `${w} ist laut Behörde in ${l} knapp. Tippen für Quelle und Verlauf.`],
    shortage_ended: (w, l) => [`Wieder lieferbar: ${w}`, `${w} steht in ${l} nicht mehr auf der Engpassliste.`],
    shortage_abroad: (w, l) => [`Frühwarnung: ${w}`, `${w} ist in ${l} knapp — bei Ihnen noch nicht. Vorrat prüfen.`],
    shortage_bestaetigt: (w, l, n) => [`Bestätigt: ${w}`, `${n} Fachbetriebe in ${l} melden ${w} als knapp (nicht amtlich).`],
    watch_alert: (w) => [`Meldung aus Fachkreisen: ${w}`, `Ein Fachbetrieb meldet ${w} als knapp (nicht amtlich).`],
    watch_wieder: (w) => [`Wieder verfügbar: ${w}`, `${w} ist laut Meldung aus Fachkreisen wieder lieferbar (nicht amtlich).`],
    watch_eingeschraenkt: (w) => [`Eingeschränkt lieferbar: ${w}`, `Ein Fachbetrieb meldet ${w} als eingeschränkt lieferbar (nicht amtlich).`],
    watch_termin: (w, d) => [`Neuer Termin: ${w}`, d ? `${w} voraussichtlich wieder lieferbar bis ${d} (Meldung aus Fachkreisen).` : `Für ${w} gibt es noch keinen Liefertermin (Meldung aus Fachkreisen).`],
    verified: () => ['Betrieb bestätigt ✔', 'Ihr Betrieb ist jetzt in ApoPulse bestätigt. Tippen zum Öffnen.'],
    verify_rejected: () => ['Bestätigung abgelehnt', 'Ihr Antrag wurde abgelehnt. Grund und neuen Antrag finden Sie in ApoPulse.'],
    payment_confirmed: () => ['Zahlung bestätigt ✔', 'Ihre Zahlung ist eingegangen und freigeschaltet. Tippen zum Öffnen.'],
    payment_rejected: () => ['Zahlung nicht bestätigt', 'Ihre Zahlung konnte nicht bestätigt werden. Den Grund finden Sie in ApoPulse.'],
    sourcing_antwort: (p, st) => st === 'in_bearbeitung' ? ['Angebotsanfrage in Bearbeitung', `${p}: Das Handelsteam holt Angebote ein. Die Antwort kommt mit einer weiteren Nachricht.`]
      : st === 'abgelehnt' ? ['Angebotsanfrage abgelehnt', `${p}: Den Grund finden Sie in ApoPulse.`]
      : ['Antwort auf Ihre Angebotsanfrage', `Neuer Stand zu ${p}. Tippen, um die Antwort zu lesen.`],
    ausbruch_signal: (w, r, n) => [`Frühwarnung: ${w}`, `In ${r} wird ${w} deutlich öfter als knapp gemeldet: ${n} neue Meldungen in 14 Tagen (Behörden und Fachkreise). Keine Kaufempfehlung.`],
    region: { AFRICA: 'Afrika', EUROPE: 'Europa', AMERICAS: 'Amerika', OCEANIA: 'Ozeanien' },
    payment_review: (art, betrag) => ['Zahlung prüfen', `Eine Zahlung wartet auf Ihre Prüfung: ${art}, ${betrag}. Die Freischaltung wartet auf Sie.`],
    ueberweisung: 'Überweisung',
    sourcing_anfrage: (p, weg) => ['Neue Angebotsanfrage', `${p} (${weg}). Tippen zum Bearbeiten.`],
    anzeige_pruefen: (titel) => ['Anzeige prüfen', `Eine Anzeige wartet auf Freigabe: ${titel}.`],
    anzeige_freigegeben: (x) => ['Anzeige freigegeben', `„${x}" ist geprüft und freigegeben. Bitte jetzt bezahlen, dann läuft sie.`],
    anzeige_abgelehnt: (x) => ['Anzeige abgelehnt', `„${x}" wurde nicht freigegeben. Den Grund finden Sie in ApoPulse.`],
    anzeige_bezahlt: (x) => ['Anzeige läuft ✔', `Zahlung verbucht: „${x}" wird jetzt angezeigt.`],
    test: () => ['ApoPulse: Benachrichtigung funktioniert', 'So kommt ein Engpass-Alarm an, auch wenn die App geschlossen ist.'],
  },
  en: {
    watch_redaktion: (w, s) => [`Editors: ${w}`, `The ApoPulse editors report ${w} as ${s} — with the source in the app.`],
    status: { kritisch: 'critically short', eingeschraenkt: 'of limited availability', verfuegbar: 'available again' },
    shortage_home: (w, l) => [`Shortage: ${w}`, `${w} is short in ${l} according to the authority. Tap for source and history.`],
    shortage_ended: (w, l) => [`Available again: ${w}`, `${w} is no longer on the shortage list in ${l}.`],
    shortage_abroad: (w, l) => [`Early warning: ${w}`, `${w} is short in ${l} — not yet in your country. Check your stock.`],
    shortage_bestaetigt: (w, l, n) => [`Confirmed: ${w}`, `${n} professionals in ${l} report ${w} as short (not official).`],
    watch_alert: (w) => [`Professional report: ${w}`, `A professional reports ${w} as short (not official).`],
    watch_wieder: (w) => [`Available again: ${w}`, `According to a professional report, ${w} is available again (not official).`],
    watch_eingeschraenkt: (w) => [`Limited availability: ${w}`, `A professional reports limited availability of ${w} (not official).`],
    watch_termin: (w, d) => [`New date: ${w}`, d ? `${w} expected back in stock by ${d} (professional report).` : `No delivery date for ${w} yet (professional report).`],
    verified: () => ['Business verified ✔', 'Your business is now verified on ApoPulse. Tap to open.'],
    verify_rejected: () => ['Verification rejected', 'Your request was rejected. See the reason and send a new request in ApoPulse.'],
    payment_confirmed: () => ['Payment confirmed ✔', 'Your payment was received and is now active. Tap to open.'],
    payment_rejected: () => ['Payment not confirmed', 'Your payment could not be confirmed. See the reason in ApoPulse.'],
    sourcing_antwort: (p, st) => st === 'in_bearbeitung' ? ['Quote request in progress', `${p}: the trade team is collecting offers. The reply will follow in another message.`]
      : st === 'abgelehnt' ? ['Quote request declined', `${p}: see the reason in ApoPulse.`]
      : ['Reply to your quote request', `Update on ${p}. Tap to read the reply.`],
    ausbruch_signal: (w, r, n) => [`Early warning: ${w}`, `${w} is reported as short much more often in ${r}: ${n} new reports in 14 days (authorities and professionals). Not a purchase recommendation.`],
    region: { AFRICA: 'Africa', EUROPE: 'Europe', AMERICAS: 'the Americas', OCEANIA: 'Oceania' },
    payment_review: (art, betrag) => ['Payment to review', `A payment is waiting for your review: ${art}, ${betrag}. Activation is waiting for you.`],
    ueberweisung: 'bank transfer',
    sourcing_anfrage: (p, weg) => ['New quote request', `${p} (${weg}). Tap to handle it.`],
    anzeige_pruefen: (titel) => ['Ad to review', `An ad is waiting for approval: ${titel}.`],
    anzeige_freigegeben: (x) => ['Ad approved', `“${x}” has been reviewed and approved. Please pay now and it will go live.`],
    anzeige_abgelehnt: (x) => ['Ad rejected', `“${x}” was not approved. See the reason in ApoPulse.`],
    anzeige_bezahlt: (x) => ['Ad is live ✔', `Payment received: “${x}” is now being shown.`],
    test: () => ['ApoPulse: notifications work', 'This is how a shortage alert arrives, even when the app is closed.'],
  },
  pt: {
    watch_redaktion: (w, s) => [`Redação: ${w}`, `A redação do ApoPulse indica ${w} como ${s} — com fonte na app.`],
    status: { kritisch: 'em rutura crítica', eingeschraenkt: 'com disponibilidade limitada', verfuegbar: 'novamente disponível' },
    shortage_home: (w, l) => [`Rutura: ${w}`, `${w} está em rutura em ${l} segundo a autoridade. Toque para ver fonte e histórico.`],
    shortage_ended: (w, l) => [`Novamente disponível: ${w}`, `${w} já não consta da lista de ruturas em ${l}.`],
    shortage_abroad: (w, l) => [`Alerta precoce: ${w}`, `${w} está em rutura em ${l} — no seu país ainda não. Verifique o stock.`],
    shortage_bestaetigt: (w, l, n) => [`Confirmado: ${w}`, `${n} profissionais em ${l} comunicam ${w} em rutura (não oficial).`],
    watch_alert: (w) => [`Aviso de profissionais: ${w}`, `Um profissional comunica ${w} em rutura (não oficial).`],
    watch_wieder: (w) => [`Novamente disponível: ${w}`, `Segundo um aviso de profissionais, ${w} está novamente disponível (não oficial).`],
    watch_eingeschraenkt: (w) => [`Disponibilidade limitada: ${w}`, `Um profissional comunica disponibilidade limitada de ${w} (não oficial).`],
    watch_termin: (w, d) => [`Nova data: ${w}`, d ? `${w} previsto de novo em stock até ${d} (aviso de profissionais).` : `Ainda sem data de entrega para ${w} (aviso de profissionais).`],
    verified: () => ['Estabelecimento verificado ✔', 'O seu estabelecimento está agora verificado no ApoPulse. Toque para abrir.'],
    verify_rejected: () => ['Verificação recusada', 'O seu pedido foi recusado. Veja o motivo e envie um novo pedido no ApoPulse.'],
    payment_confirmed: () => ['Pagamento confirmado ✔', 'O seu pagamento foi recebido e está ativo. Toque para abrir.'],
    payment_rejected: () => ['Pagamento não confirmado', 'Não foi possível confirmar o seu pagamento. Veja o motivo no ApoPulse.'],
    sourcing_antwort: (p, st) => st === 'in_bearbeitung' ? ['Pedido de cotação em tratamento', `${p}: a equipa comercial está a recolher ofertas. A resposta segue noutra mensagem.`]
      : st === 'abgelehnt' ? ['Pedido de cotação recusado', `${p}: veja o motivo no ApoPulse.`]
      : ['Resposta ao seu pedido de cotação', `Novidades sobre ${p}. Toque para ler a resposta.`],
    ausbruch_signal: (w, r, n) => [`Alerta precoce: ${w}`, `${w} é comunicado em rutura com muito mais frequência em ${r}: ${n} novas comunicações em 14 dias (autoridades e profissionais). Não é uma recomendação de compra.`],
    region: { AFRICA: 'África', EUROPE: 'Europa', AMERICAS: 'Américas', OCEANIA: 'Oceânia' },
    payment_review: (art, betrag) => ['Pagamento a verificar', `Um pagamento aguarda a sua verificação: ${art}, ${betrag}. A ativação aguarda por si.`],
    ueberweisung: 'transferência bancária',
    sourcing_anfrage: (p, weg) => ['Novo pedido de cotação', `${p} (${weg}). Toque para tratar.`],
    anzeige_pruefen: (titel) => ['Anúncio a verificar', `Um anúncio aguarda aprovação: ${titel}.`],
    anzeige_freigegeben: (x) => ['Anúncio aprovado', `“${x}” foi verificado e aprovado. Pague agora para que fique ativo.`],
    anzeige_abgelehnt: (x) => ['Anúncio recusado', `“${x}” não foi aprovado. Veja o motivo no ApoPulse.`],
    anzeige_bezahlt: (x) => ['Anúncio ativo ✔', `Pagamento registado: “${x}” está agora a ser exibido.`],
    test: () => ['ApoPulse: notificações a funcionar', 'É assim que chega um alerta de rutura, mesmo com a app fechada.'],
  },
  fr: {
    watch_redaktion: (w, s) => [`Rédaction : ${w}`, `La rédaction d’ApoPulse signale ${w} comme ${s} — avec la source dans l’app.`],
    status: { kritisch: 'en pénurie critique', eingeschraenkt: 'de disponibilité limitée', verfuegbar: 'de nouveau disponible' },
    shortage_home: (w, l) => [`Pénurie : ${w}`, `${w} est en pénurie ${frLand(l)} selon l’autorité. Touchez pour voir la source et l’historique.`],
    shortage_ended: (w, l) => [`De nouveau disponible : ${w}`, `${w} ne figure plus sur la liste des pénuries ${frLand(l)}.`],
    shortage_abroad: (w, l) => [`Alerte précoce : ${w}`, `${w} est en pénurie ${frLand(l)} — pas encore dans votre pays. Vérifiez votre stock.`],
    shortage_bestaetigt: (w, l, n) => [`Confirmé : ${w}`, `${n} professionnels ${frLand(l)} signalent ${w} en pénurie (non officiel).`],
    watch_alert: (w) => [`Signalement de professionnels : ${w}`, `Un professionnel signale ${w} en pénurie (non officiel).`],
    watch_wieder: (w) => [`De nouveau disponible : ${w}`, `Selon un signalement de professionnels, ${w} est de nouveau disponible (non officiel).`],
    watch_eingeschraenkt: (w) => [`Disponibilité limitée : ${w}`, `Un professionnel signale une disponibilité limitée de ${w} (non officiel).`],
    watch_termin: (w, d) => [`Nouvelle date : ${w}`, d ? `${w} de nouveau en stock prévu d’ici le ${d} (signalement de professionnels).` : `Pas encore de date de livraison pour ${w} (signalement de professionnels).`],
    verified: () => ['Établissement vérifié ✔', 'Votre établissement est désormais vérifié sur ApoPulse. Touchez pour ouvrir.'],
    verify_rejected: () => ['Vérification refusée', 'Votre demande a été refusée. Consultez le motif et envoyez une nouvelle demande dans ApoPulse.'],
    payment_confirmed: () => ['Paiement confirmé ✔', 'Votre paiement a été reçu et est maintenant actif. Touchez pour ouvrir.'],
    payment_rejected: () => ['Paiement non confirmé', 'Votre paiement n’a pas pu être confirmé. Le motif se trouve dans ApoPulse.'],
    sourcing_antwort: (p, st) => st === 'in_bearbeitung' ? ['Demande de devis en cours', `${p} : l’équipe commerciale recueille des offres. La réponse suivra dans un autre message.`]
      : st === 'abgelehnt' ? ['Demande de devis refusée', `${p} : le motif se trouve dans ApoPulse.`]
      : ['Réponse à votre demande de devis', `Du nouveau pour ${p}. Touchez pour lire la réponse.`],
    ausbruch_signal: (w, r, n) => [`Alerte précoce : ${w}`, `Région ${r} : ${w} est signalé en pénurie bien plus souvent — ${n} nouveaux signalements en 14 jours (autorités et professionnels). Pas une recommandation d’achat.`],
    region: { AFRICA: 'Afrique', EUROPE: 'Europe', AMERICAS: 'Amériques', OCEANIA: 'Océanie' },
    payment_review: (art, betrag) => ['Paiement à vérifier', `Un paiement attend votre vérification : ${art}, ${betrag}. L’activation attend votre décision.`],
    ueberweisung: 'virement bancaire',
    sourcing_anfrage: (p, weg) => ['Nouvelle demande de devis', `${p} (${weg}). Touchez pour la traiter.`],
    anzeige_pruefen: (titel) => ['Annonce à vérifier', `Une annonce attend sa validation : ${titel}.`],
    anzeige_freigegeben: (x) => ['Annonce validée', `« ${x} » a été vérifiée et validée. Payez maintenant pour la mettre en ligne.`],
    anzeige_abgelehnt: (x) => ['Annonce refusée', `« ${x} » n’a pas été validée. Le motif se trouve dans ApoPulse.`],
    anzeige_bezahlt: (x) => ['Annonce en ligne ✔', `Paiement enregistré : « ${x} » est maintenant diffusée.`],
    test: () => ['ApoPulse : les notifications fonctionnent', 'Voici comment arrive une alerte de pénurie, même quand l’application est fermée.'],
  },
  ar: {
    watch_redaktion: (w, s) => [`التحرير: ${w}`, `يفيد تحرير ApoPulse بأن ${w} ${s} — مع المصدر في التطبيق.`],
    status: { kritisch: 'في نقص حرج', eingeschraenkt: 'متوفر بشكل محدود', verfuegbar: 'متوفر مجددًا' },
    shortage_home: (w, l) => [`نقص: ${w}`, `${w} ناقص في ${l} وفق الجهة الرسمية. اضغط لرؤية المصدر والسجل.`],
    shortage_ended: (w, l) => [`متوفر من جديد: ${w}`, `لم يعد ${w} على قائمة النقص في ${l}.`],
    shortage_abroad: (w, l) => [`إنذار مبكر: ${w}`, `${w} ناقص في ${l} — ليس في بلدك بعد. تحقق من مخزونك.`],
    shortage_bestaetigt: (w, l, n) => [`مؤكد: ${w}`, `${n} جهات مهنية في ${l} تبلّغ عن نقص ${w} (غير رسمي).`],
    watch_alert: (w) => [`بلاغ مهني: ${w}`, `جهة مهنية تبلّغ عن نقص ${w} (غير رسمي).`],
    watch_wieder: (w) => [`متوفر من جديد: ${w}`, `وفق بلاغ مهني، ${w} متوفر من جديد (غير رسمي).`],
    watch_eingeschraenkt: (w) => [`توفر محدود: ${w}`, `جهة مهنية تبلّغ عن توفر محدود لـ ${w} (غير رسمي).`],
    watch_termin: (w, d) => [`موعد جديد: ${w}`, d ? `يُتوقع توفر ${w} من جديد حتى ${d} (بلاغ مهني).` : `لا يوجد بعد موعد توريد لـ ${w} (بلاغ مهني).`],
    verified: () => ['تم توثيق المنشأة ✔', 'منشأتك موثَّقة الآن في ApoPulse. اضغط للفتح.'],
    verify_rejected: () => ['تم رفض التوثيق', 'تم رفض طلبك. اطّلع على السبب وأرسل طلبًا جديدًا في ApoPulse.'],
    payment_confirmed: () => ['تم تأكيد الدفع ✔', 'تم استلام دفعتك وأصبحت مفعّلة. اضغط للفتح.'],
    payment_rejected: () => ['لم يتم تأكيد الدفع', 'تعذّر تأكيد دفعتك. ستجد السبب في ApoPulse.'],
    sourcing_antwort: (p, st) => st === 'in_bearbeitung' ? ['طلب عرض السعر قيد المعالجة', `${p}: يجمع فريق التجارة العروض. سيصلك الرد في رسالة أخرى.`]
      : st === 'abgelehnt' ? ['تم رفض طلب عرض السعر', `${p}: ستجد السبب في ApoPulse.`]
      : ['رد على طلب عرض السعر', `تحديث بشأن ${p}. اضغط لقراءة الرد.`],
    ausbruch_signal: (w, r, n) => [`إنذار مبكر: ${w}`, `يُبلَّغ عن نقص ${w} في ${r} أكثر بكثير: ${n} بلاغات جديدة خلال 14 يومًا (جهات رسمية وجهات مهنية). ليست توصية بالشراء.`],
    region: { AFRICA: 'أفريقيا', EUROPE: 'أوروبا', AMERICAS: 'الأمريكتين', OCEANIA: 'أوقيانوسيا' },
    payment_review: (art, betrag) => ['دفعة بانتظار المراجعة', `دفعة بانتظار مراجعتك: ${art}، ${betrag}. التفعيل بانتظارك.`],
    ueberweisung: 'تحويل بنكي',
    sourcing_anfrage: (p, weg) => ['طلب عرض سعر جديد', `${p} (${weg}). اضغط للمعالجة.`],
    anzeige_pruefen: (titel) => ['إعلان بانتظار المراجعة', `إعلان بانتظار الموافقة: ${titel}.`],
    anzeige_freigegeben: (x) => ['تمت الموافقة على الإعلان', `تمت مراجعة «${x}» والموافقة عليه. ادفع الآن ليبدأ عرضه.`],
    anzeige_abgelehnt: (x) => ['تم رفض الإعلان', `لم تتم الموافقة على «${x}». ستجد السبب في ApoPulse.`],
    anzeige_bezahlt: (x) => ['الإعلان قيد العرض ✔', `تم تسجيل الدفع: يُعرض «${x}» الآن.`],
    test: () => ['ApoPulse: الإشعارات تعمل', 'هكذا يصل تنبيه النقص، حتى عندما يكون التطبيق مغلقًا.'],
  },
};
// verified / verify_rejected: Ergebnis der Betriebs-Bestätigung — wer die App nicht öffnet, erfuhr sonst
// nichts davon. Den Grund (Freitext der Redaktion) nennt der Push bewusst nicht: Er steht in der App.
// payment_* / sourcing_antwort / ausbruch_signal (11/2026): Ereignisse, auf die jemand wartet — eine von Hand
// geprüfte Krypto-Zahlung, die Antwort des Handelsteams, die Frühwarnung an den Großhandel. Vorher nur in der Glocke.
export const PUSH_TYPEN = new Set(['shortage_home', 'shortage_ended', 'shortage_abroad', 'watch_alert', 'shortage_bestaetigt', 'verified', 'verify_rejected',
  'payment_confirmed', 'payment_rejected', 'sourcing_antwort', 'ausbruch_signal',
  // An die Redaktion: hier wartet eine Kundin auf uns (Krypto-Freischaltung, Angebotsanfrage, bezahlte Anzeige).
  'payment_review', 'sourcing_anfrage', 'anzeige_pruefen',
  // An Werbekunden: Freigabe, Ablehnung (ohne Grund), Zahlungseingang ihrer Anzeige.
  'anzeige_freigegeben', 'anzeige_abgelehnt', 'anzeige_bezahlt']);

/** Benachrichtigung -> Push-Nachricht in der Sprache der Person. */
export function pushNachricht(n, { sprache = 'de', landName = (c) => c } = {}) {
  const T = TEXTE[sprache] || TEXTE.de;
  const teile = String(n.label || '').split(' · ');
  // watch_alert steht für mehrere Ereignisse — der Inhalt steckt im Label. Vorher
  // hieß JEDE Push-Nachricht „meldet … als knapp", auch „wieder verfügbar".
  let typ = n.type;
  if (typ === 'watch_alert') {
    const was = teile[1] || '';
    // Von der Redaktion mit Quellen-Link gesetzt — nicht „Meldung aus Apotheken".
    if (/\(Redaktion\)/.test(was)) typ = 'watch_redaktion';
    else if (/Wieder verfügbar/.test(was)) typ = 'watch_wieder';
    else if (/Eingeschränkt lieferbar/.test(was)) typ = 'watch_eingeschraenkt';
    else if (/^Termin/.test(was)) typ = 'watch_termin';
  }
  const f = T[typ];
  if (!f) return null;
  if (typ === 'verified' || typ === 'verify_rejected') {
    const [titel, text] = f();
    return { titel, text, url: typ === 'verify_rejected' ? '/?bestaetigung=1' : '/', tag: 'verifizierung' };
  }
  // Den Grund einer Ablehnung (Freitext der Prüfung) nennt der Push nicht — er steht in der App.
  const anzeige = (n.ref_type || n.refType) === 'anzeige';
  // Abgelehnte Zahlung einer Anzeige: zurück zur Anzeige (dort neu zahlen), nicht zur Premium-Seite.
  if (typ === 'payment_confirmed' || typ === 'payment_rejected') { const [titel, text] = f(); return { titel, text, url: anzeige ? '/?werbung=1' : '/?zahlung=1', tag: 'zahlung' }; }
  if (typ === 'anzeige_freigegeben' || typ === 'anzeige_abgelehnt' || typ === 'anzeige_bezahlt') {
    const [titel, text] = f(String(n.label || ''));
    return { titel, text, url: '/?werbung=1', tag: `anzeige:${n.ref_id || n.refId || ''}` };
  }
  if (typ === 'payment_review' || typ === 'sourcing_anfrage' || typ === 'anzeige_pruefen') {
    const art = teile[0] === 'Überweisung' ? (T.ueberweisung || teile[0]) : teile[0] || '';
    const [titel, text] = typ === 'payment_review' ? f(art, teile[1] || '') : typ === 'sourcing_anfrage' ? f(teile.slice(0, -1).join(' · ') || teile[0] || '', teile.length > 1 ? teile[teile.length - 1] : '') : f(String(n.label || ''));
    return { titel, text, url: '/?moderation=1', tag: `${typ}:${n.ref_id || n.refId || ''}` };
  }
  if (typ === 'sourcing_antwort') {
    // Status ist das LETZTE Stück — ein Präparat darf selbst „ · " enthalten.
    const [titel, text] = f(teile.length > 1 ? teile.slice(0, -1).join(' · ') : teile[0] || '', teile.length > 1 ? teile[teile.length - 1] : '');
    return { titel, text, url: `/sourcing?anfrage=${encodeURIComponent(String(n.ref_id || n.refId || ''))}`, tag: `sourcing:${n.ref_id || n.refId || ''}` };
  }
  if (typ === 'ausbruch_signal') {
    const w = n.ref_id || n.refId || teile[0] || '';
    const [titel, text] = f(w, (T.region || TEXTE.de.region)[teile[1]] || teile[1] || '', teile[2] || '');
    return { titel, text, url: '/?radar=1', tag: `ausbruch:${w}:${teile[1] || ''}` };
  }
  const wirkstoff = n.ref_type === 'wirkstoff' || n.refType === 'wirkstoff' ? (n.ref_id || n.refId || teile[0]) : teile[0];
  const land = teile[1] && /^[A-Z]{2}$/.test(teile[1]) ? landName(teile[1]) : (teile[1] || '');
  const termin = typ === 'watch_termin' ? ((teile[1] || '').match(/(\d{4})-(\d{2})-(\d{2})/) || null) : null;
  if (typ === 'watch_redaktion') {
    const st = /Wieder verfügbar/.test(teile[1] || '') ? 'verfuegbar' : /Eingeschränkt/.test(teile[1] || '') ? 'eingeschraenkt' : 'kritisch';
    const [titel, text] = f(wirkstoff, (T.status || TEXTE.de.status)[st]);
    return { titel, text, url: `/?wirkstoff=${encodeURIComponent(wirkstoff)}`, tag: `${n.type}:${wirkstoff}` };
  }
  const [titel, text] = typ === 'watch_termin'
    ? f(wirkstoff, termin ? (sprache === 'de' ? `${termin[3]}.${termin[2]}.${termin[1]}` : `${termin[3]}/${termin[2]}/${termin[1]}`) : '')
    : f(wirkstoff, land, teile[2] || '');
  const url = n.type === 'watch_alert' ? '/?tab=shortages' : `/?wirkstoff=${encodeURIComponent(wirkstoff)}`;
  return { titel, text, url, tag: `${n.type}:${wirkstoff}` };
}
export const testNachricht = (sprache = 'de') => { const [titel, text] = (TEXTE[sprache] || TEXTE.de).test(); return { titel, text, url: '/', tag: 'test' }; };
