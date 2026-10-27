// Engpass-Modul (Priorität 2) + Verknüpfung mit dem Feed (Priorität 1).
// Liest Engpässe (mit Herkunfts-Flag) und verbindet sie mit den Beiträgen, die
// sie referenzieren ("X Apotheker haben dazu gepostet").
import { cleanSourceUrl } from '../domain/media.js';
import { AppError } from '../domain/errors.js';
import { gehoertZuLand } from '../domain/land.js';
import { wirkstoffSchluessel } from '../domain/inn.js';

const STATUS_LABEL = { kritisch: 'Kritischer Engpass', eingeschraenkt: 'Eingeschränkt lieferbar', verfuegbar: 'Wieder verfügbar' };
const VALID_STATUS = Object.keys(STATUS_LABEL);

// Strenger Kalendertag (YYYY-MM-DD): Date.parse normalisiert Überläufe (z. B. 2026-02-30
// -> 02.03.), deshalb muss der geparste Tag wieder exakt denselben ISO-String ergeben.
function isValidCalendarDay(raw) {
  const d = new Date(raw + 'T00:00:00Z');
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === raw;
}

// Tage zwischen zwei ISO-Kalendertagen (YYYY-MM-DD), b − a. Null bei ungültigen Daten.
function daysBetween(a, b) {
  const da = Date.parse(String(a) + 'T00:00:00Z'), db = Date.parse(String(b) + 'T00:00:00Z');
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  return Math.round((db - da) / 86400000);
}

// Alters-/Fristsignal eines Engpasses (rein aus Datumsfeldern abgeleitet, keine
// Sicherheitsaussage): Tage seit Meldung und Tage bis zum voraussichtlichen Termin
// (negativ = Termin überschritten). „verfuegbar" hat keinen offenen Termin mehr.
export function shortageAging(gemeldetAm, voraussichtlichBis, status, today) {
  const dr = gemeldetAm ? daysBetween(gemeldetAm, today) : null;
  const days_until = (voraussichtlichBis && status !== 'verfuegbar') ? daysBetween(today, voraussichtlichBis) : null;
  return {
    days_reported: dr != null && dr >= 0 ? dr : null,
    days_until,
    overdue: days_until != null && days_until < 0,
  };
}

// Änderung eines Engpasses innerhalb der letzten `windowDays` Tage — rein aus dem
// Statusverlauf (history) abgeleitet, keine Sicherheitsaussage. Grundlage des
// Wochenrückblicks: neu gemeldet, wieder verfügbar oder Status geändert.
//   - genau ein History-Eintrag + aktiver Status  => 'neu' (Erstmeldung)
//   - aktueller Status 'verfuegbar'               => 'wieder_verfuegbar'
//   - mehrere Einträge + aktiver Status           => 'status' (verschärft/gelockert)
// Gibt null zurück, wenn die letzte relevante Änderung außerhalb des Fensters liegt.
export function weeklyChange(s, today, windowDays = 7) {
  const hist = Array.isArray(s && s.history) ? s.history : [];
  if (!hist.length) return null;
  const last = hist[hist.length - 1];
  const first = hist[0];
  const daysLast = last.am ? daysBetween(last.am, today) : null;
  const daysFirst = first.am ? daysBetween(first.am, today) : null;
  const within = (d) => d != null && d >= 0 && d <= windowDays;
  if (s.status === 'verfuegbar') {
    return within(daysLast) ? { kind: 'wieder_verfuegbar', am: last.am, days_ago: daysLast, status: s.status } : null;
  }
  if (hist.length === 1) {
    return within(daysFirst) ? { kind: 'neu', am: first.am, days_ago: daysFirst, status: s.status } : null;
  }
  return within(daysLast) ? { kind: 'status', am: last.am, days_ago: daysLast, status: s.status } : null;
}

/** Ab so vielen Apotheken (Meldende eingeschlossen) gilt eine Meldung als bestätigt. */
export const BESTAETIGT_AB_APOTHEKEN = 3;

// ── Schein-Konten bremsen ───────────────────────────────────────────────────
//  Eine Registrierung dauert eine Minute. Ohne Bremse konnte eine einzelne
//  Person zwei Schein-Apotheken anlegen und jede Meldung als „von 3 Apotheken
//  bestätigt" erscheinen lassen — in Ländern ohne Behördenliste die stärkste
//  Aussage, die ApoPulse macht. Darum zählen für die Schwelle nur Konten, die
//  mindestens ZAEHLT_AB_STUNDEN alt sind. Echte Kolleg:innen zählen damit von
//  selbst ab dem nächsten Tag; wer fälscht, muss warten — und in der Zeit
//  sehen Moderation und Meldende, was passiert. Angezeigt wird weiter, wie
//  viele Apotheken melden; nur „bestätigt" wartet.
//  Unbekanntes Kontoalter (z. B. ohne Konto-Speicher in Tests) zählt.
export const ZAEHLT_AB_STUNDEN = 24;
const vertrauen = { kontoSeit: () => null, abStunden: ZAEHLT_AB_STUNDEN, jetzt: () => Date.now() };
/** Einmal beim Start (server.js): Woher das Kontoalter kommt, ab wann es zählt. */
export function vertrauenEinstellen(o) { Object.assign(vertrauen, o); }
/** Wie viele der meldenden/bestätigenden Apotheken für „bestätigt" zählen. */
export function zaehlendeApotheken(s) {
  if (!s || s.provenance !== 'community') return 0;
  const grenze = vertrauen.jetzt() - vertrauen.abStunden * 3600000;
  const zaehlt = (uid) => { const seit = uid ? vertrauen.kontoSeit(uid) : null; const t = seit ? Date.parse(seit) : NaN; return Number.isNaN(t) || t <= grenze; };
  return (zaehlt(s.reporter_user_id) ? 1 : 0) + (s.confirmations || []).filter(zaehlt).length;
}
/** „Bestätigt": genug zählende Apotheken und nicht veraltet. Eine Stelle für alle Ansichten. */
export function istBestaetigt(s, heute) {
  return zaehlendeApotheken(s) >= BESTAETIGT_AB_APOTHEKEN && aktualitaet(s, heute).stufe !== 'veraltet';
}
/** Apotheken-Meldung ohne Bestätigung seit … Tagen: „noch aktuell?" bzw. „veraltet". */
export const PRUEFEN_NACH_TAGEN = 14;
export const VERALTET_NACH_TAGEN = 30;

/**
 * Aktualität einer Apotheken-Meldung (amtliche Zeilen sind immer „aktuell" —
 * ihre Aktualität kommt aus dem Abruf der Behördenliste).
 * In Ländern, die fast nur Apotheken-Meldungen haben, darf eine Meldung von vor
 * zwei Monaten nicht wie eine von heute aussehen.
 */
export function aktualitaet(s, today) {
  if (!s || s.provenance !== 'community' || !['kritisch', 'eingeschraenkt'].includes(s.status)) return { stufe: 'aktuell', tage: null };
  const seit = s.zuletzt_aktiv || s.gemeldet_am;
  const tage = seit ? daysBetween(seit, today) : 0;
  return { stufe: tage >= VERALTET_NACH_TAGEN ? 'veraltet' : tage >= PRUEFEN_NACH_TAGEN ? 'pruefen' : 'aktuell', tage };
}

export const MAX_NEUE_MELDUNGEN_TAG = 10;

export function createShortagesService(shortagesRepo, social, options = {}) {
  // Heutiger Kalendertag (injizierbar für Tests) — Grundlage der Alters-/Fristsignale.
  const today = () => (options.today ? options.today() : new Date().toISOString().slice(0, 10));
  // Premium-Gate (injiziert): Notizen an beobachteten Wirkstoffen sind ein Premium-Vorteil.
  const hasPremium = options.hasPremium || (() => false);
  // Engpass-Zeile für die Anzeige anreichern: Melder-Profil + Bestätigungen.
  function decorate(s, viewerUserId) {
    const confirmations = s.confirmations || [];
    const apotheken = s.provenance === 'community' ? 1 + confirmations.length : 0;
    const zaehlend = zaehlendeApotheken(s);
    const akt = aktualitaet(s, today());
    const reporter = s.reporter_user_id ? social.getProfile(s.reporter_user_id) : null;
    return {
      ...s,
      confirmations: undefined, // rohe User-IDs nicht nach außen geben
      notified_confirmers: undefined, // interne Dedup-Liste nicht nach außen geben
      confirm_count: confirmations.length,
      // Vertrauensstufe einer Apotheken-Meldung (nicht amtlich): ab drei
      // Apotheken (Meldende + zwei Bestätigungen) „bestätigt". In Ländern ohne
      // amtliche Liste (große Teile Afrikas) ist das die beste verfügbare Aussage.
      apotheken, bestaetigt: istBestaetigt(s, today()),
      // Wie viele davon (noch) nicht zählen, weil das Konto jünger als ZAEHLT_AB_STUNDEN ist.
      apotheken_neu: s.provenance === 'community' ? apotheken - zaehlend : 0,
      aktualitaet: akt.stufe, tage_ohne_bestaetigung: akt.tage,
      erinnert: undefined, pruef_gemeldet: undefined, bestaetigt_gemeldet: undefined,
      i_confirmed: !!viewerUserId && confirmations.includes(viewerUserId),
      reporter: reporter ? { handle: reporter.handle, display_name: reporter.display_name, verified: !!reporter.verified } : null,
      is_reporter: !!viewerUserId && s.reporter_user_id === viewerUserId,
      post_count: social.postsAbout(viewerUserId, 'shortage', s.id).length,
      watched: shortagesRepo.isWatched(viewerUserId, s.wirkstoff),
      ...shortageAging(s.gemeldet_am, s.voraussichtlich_bis, s.status, today()),
    };
  }
  // Sicherheitsrelevante Engpass-Aktionen (melden/bestätigen) sind Fachkreisen vorbehalten.
  // Privatnutzer:innen dürfen Engpässe lesen, aber nicht selbst mitmelden — direkt aus dem
  // Owner-Prinzip: „Sicherheitsrelevante Aussagen … nur mit Quelle" (Quelle = Fachperson).
  // Beobachter:innen eines Wirkstoffs, deren HEIMATLAND zum Engpass passt.
  //
  // Vorher ging jede Engpass-Benachrichtigung an ALLE, die den Wirkstoff
  // beobachten — eine portugiesische Apotheke bekam „Amoxicillin · kritisch"
  // für eine Meldung aus Wien. Eine Push-Meldung meint den eigenen Markt
  // (domain/land.js). Länderlose Einträge gelten wie in der Liste überall.
  const heimatVon = (uid) => { const p = social.getProfile ? social.getProfile(uid) : null; return p && p.country; };
  // Über den Wirkstoff-SCHLÜSSEL (domain/inn.js), nicht über den Wortlaut:
  // Wer „Amoxicillin" beobachtet, meint auch das „Amoxicillin-Trihydrat" des
  // BfArM. Vorher galt nur die exakte Schreibweise — der Alarm blieb stumm.
  const wkKey = (w) => wirkstoffSchluessel(w) || String(w || '').trim().toLowerCase();
  function beobachterImLand(wirkstoff, land) {
    const key = wkKey(wirkstoff);
    return shortagesRepo.listWatchers()
      .filter((b) => b.wirkstoffe.some((w) => wkKey(w) === key))
      .map((b) => b.userId)
      .filter((uid) => gehoertZuLand({ country: land }, heimatVon(uid)));
  }

  // Schwelle „bestätigt" erreicht (einmal je Meldung): Beobachter:innen im Land
  // und die Meldende erfahren es. Aufgerufen bei jeder Bestätigung UND im
  // Zeitplan (erinnern) — eine Bestätigung eines neuen Kontos zählt erst
  // später, und dann soll der Alarm trotzdem kommen.
  function bestaetigtMelden(s, actorUserId = null) {
    if (s.provenance !== 'community' || !istBestaetigt(s, today()) || shortagesRepo.wasBestaetigtGemeldet(s.id)) return false;
    if (!['kritisch', 'eingeschraenkt'].includes(s.status)) return false;
    shortagesRepo.markBestaetigtGemeldet(s.id);
    const n = zaehlendeApotheken(s);
    const empf = new Set([...beobachterImLand(s.wirkstoff, s.country), s.reporter_user_id].filter(Boolean));
    for (const uid of empf) {
      social.pushNotification({ userId: uid, type: 'shortage_bestaetigt', actorUserId, refType: 'wirkstoff', refId: s.wirkstoff, label: `${s.wirkstoff} · ${s.country || ''} · ${n}` });
    }
    return true;
  }

  // Auffälligkeiten einer aktiven Apotheken-Meldung (Moderation). null = nicht prüfbar.
  const optVonWem = options.vonWem || (() => null);
  const moderatoren = options.moderatoren || (() => []);
  function pruefSignale(s, vonWem = optVonWem) {
    if (s.provenance !== 'community' || !['kritisch', 'eingeschraenkt'].includes(s.status) || aktualitaet(s, today()).stufe === 'veraltet') return null;
    const best = s.confirmations || [];
    if (!best.length) return null;
    const jetzt = vertrauen.jetzt();
    const angelegt = (uid) => { const t = Date.parse((uid && vertrauen.kontoSeit(uid)) || ''); return Number.isNaN(t) ? null : t; };
    const wer = (uid, rolle) => {
      const p = uid ? social.getProfile(uid) : null; const t = angelegt(uid);
      return { rolle, handle: p ? p.handle : null, name: p ? p.display_name : null, verifiziert: !!(p && p.verified), alter_stunden: t == null ? null : Math.max(0, Math.floor((jetzt - t) / 3600000)), eingeladen_von_meldender: rolle === 'bestaetigt' && !!s.reporter_user_id && vonWem(uid) === s.reporter_user_id };
    };
    const leute = [wer(s.reporter_user_id, 'meldet'), ...best.map((u) => wer(u, 'bestaetigt'))];
    const signale = [];
    const neu = leute.filter((l) => l.alter_stunden != null && l.alter_stunden < vertrauen.abStunden).length;
    if (neu) signale.push({ art: 'neue_konten', n: neu });
    const eing = leute.filter((l) => l.eingeladen_von_meldender).length;
    if (eing) signale.push({ art: 'eingeladen', n: eing });
    // Bestätigende, deren Konto binnen einer Stunde nach einem anderen Beteiligten entstand.
    const zeiten = [s.reporter_user_id, ...best].map(angelegt);
    const nah = best.filter((u, i) => { const t = zeiten[i + 1]; return t != null && zeiten.some((x, j) => j !== i + 1 && x != null && Math.abs(x - t) < 3600000); }).length;
    if (nah >= 2) signale.push({ art: 'kurz_nacheinander', n: nah });
    return { signale, leute };
  }
  // Auffällige Meldung erreicht die Schwelle (3 Apotheken): die Moderation
  // erfährt es, einmal je Meldung — sonst müsste sie die Prüfliste von sich
  // aus öffnen, und die 24 Stunden vergingen ungesehen.
  function pruefungMelden(s, actorUserId) {
    if (1 + (s.confirmations || []).length < BESTAETIGT_AB_APOTHEKEN || shortagesRepo.wasPruefGemeldet(s.id)) return false;
    const p = pruefSignale(s);
    if (!p || !p.signale.length) return false;
    shortagesRepo.markPruefGemeldet(s.id);
    for (const uid of moderatoren()) social.pushNotification({ userId: uid, type: 'meldung_pruefen', actorUserId, refType: 'shortage', refId: s.id, label: `${s.wirkstoff} · ${s.country || ''}` });
    return true;
  }

  function requireModerator(userId) {
    if (!social.isModerator(userId)) throw new AppError('forbidden', 'Nur Moderation.', 403);
  }

  function requireProfessional(userId) {
    const prof = social.getProfile(userId);
    if (prof && prof.account_type === 'private') {
      throw new AppError('shortage_pro_only', 'Engpass-Meldungen sind sicherheitsrelevant und Fachkreisen (Apotheke, Pharma-Unternehmen, Behörde) vorbehalten. Als Privatnutzer:in kannst du Engpässe lesen, aber nicht melden oder bestätigen.', 403);
    }
  }
  const dienst = {
    list() { return shortagesRepo.list(); },
    get(id) { return shortagesRepo.get(id); },

    // Engpass + Feed-Aktivität (sichtbarkeitsgefiltert fuer den Betrachter).
    withActivity(viewerUserId, id) {
      const shortage = shortagesRepo.get(id);
      if (!shortage) return null;
      const posts = social.postsAbout(viewerUserId, 'shortage', id);
      return { shortage: decorate(shortage, viewerUserId), post_count: posts.length, posts };
    },

    // Aus einem Engpass heraus in den Feed posten (Beitrag referenziert den Engpass).
    postAbout(actorUserId, id, { body, visibility = 'public' }) {
      const shortage = shortagesRepo.get(id);
      if (!shortage) throw new AppError('shortage_not_found', 'Engpass nicht gefunden.', 404);
      return social.createPost(actorUserId, { body, visibility, refType: 'shortage', refId: id });
    },

    // Liste mit Aktivitäts-Zähler pro Engpass (fuer das Dashboard).
    /**
     * `country` beschraenkt auf ein Land. Ohne Angabe bleibt alles sichtbar —
     * die Entscheidung, wer filtert, liegt bewusst beim Aufrufer: Die
     * Wirkstoff-Detailseite etwa will auch Nachbarlaender zeigen duerfen.
     */
    listWithCounts(viewerUserId, { country = null } = {}) {
      return shortagesRepo.list({ country }).map(s => decorate(s, viewerUserId));
    },

    // Rohe Repo-Zeile → Anzeige-Form (für andere Dienste, z. B. die Suche): mit
    // Vertrauensstufe, OHNE interne Listen (Benutzer-IDs der Bestätigenden).
    fuerAnzeige(viewerUserId, s) { return decorate(s, viewerUserId); },

    // ── Community-Meldung: eine Apotheke meldet einen selbst beobachteten Engpass ──
    // Herkunft klar als 'community' gekennzeichnet (nicht offiziell/BASG-verifiziert).
    /**
     * `country` kommt vom Aufrufer (HTTP-Schicht), nicht aus dem Dienst: Nur
     * dort ist bekannt, zu welchem Land der Betrieb gehoert. Und es ist
     * bewusst NICHT frei waehlbar — duerfte man sein Land selbst angeben,
     * liesse sich die Laenderregulierung der Rabatt-/Engpassanzeige umgehen.
     */
    reportShortage(userId, { wirkstoff, bezeichnung, grund, status = 'kritisch', voraussichtlichBis, country = null }) {
      requireProfessional(userId);
      const w = String(wirkstoff || '').trim();
      if (!w) throw new AppError('shortage_wirkstoff_missing', 'Wirkstoff fehlt.');
      if (w.length > 120) throw new AppError('wirkstoff_zu_lang', 'Wirkstoff zu lang.');
      const bez = String(bezeichnung || '').trim() || w;
      if (bez.length > 200) throw new AppError('bezeichnung_zu_lang', 'Bezeichnung zu lang.');
      if (!VALID_STATUS.includes(status)) throw new AppError('status_unbekannt', 'Unbekannter Status.');
      // Optionales "voraussichtlich lieferbar bis"-Datum (Kalendertag, ISO YYYY-MM-DD).
      let voraussichtlich_bis = null;
      const vb = String(voraussichtlichBis || '').trim();
      if (vb) {
        if (!isValidCalendarDay(vb)) throw new AppError('shortage_bad_date', 'Ungültiges Datum (voraussichtlich bis).');
        voraussichtlich_bis = vb;
      }
      // Gleicher Wirkstoff über Schreibweisen und Sprachen hinweg (domain/inn.js):
      // „Amoxicilina" = „Amoxicillin" = „Amoxicillin-Trihydrat".
      const schluessel = wirkstoffSchluessel(w);
      const gleich = (s) => s.provenance === 'community' && s.status !== 'verfuegbar'
        && (wirkstoffSchluessel(s.wirkstoff) === schluessel || s.wirkstoff.trim().toLowerCase() === w.toLowerCase());
      // Doppel-/Fehlklick-Schutz: dieselbe Apotheke soll denselben Wirkstoff nicht
      // mehrfach offen melden (andere sollen stattdessen bestätigen).
      const dupe = shortagesRepo.list().find(s => s.reporter_user_id === userId && gleich(s));
      if (dupe) throw new AppError('shortage_duplicate', 'Du hast diesen Wirkstoff bereits gemeldet.');
      // Hat eine ANDERE Apotheke im selben Land denselben Wirkstoff schon offen gemeldet,
      // zählt diese Meldung als Bestätigung („Auch bei uns"). Vorher entstand eine zweite,
      // getrennte Meldung — keine von beiden erreichte die Schwelle „von 3 Apotheken
      // bestätigt", gerade dort, wo Apotheken-Meldungen die einzige Quelle sind (Afrika).
      const fremd = shortagesRepo.list().find(s => s.reporter_user_id && s.reporter_user_id !== userId
        && (s.country || null) === (country || null) && gleich(s));
      if (fremd) return { ...dienst.confirmShortage(userId, fremd.id), zusammengefuehrt: true };
      const today = new Date().toISOString().slice(0, 10);
      // Tagesgrenze für NEUE Meldungen je Konto (Bestätigungen oben zählen nicht). Ein frisch
      // angelegtes Konto konnte sonst Hunderte erfundene Engpässe in ein Land schreiben — dort,
      // wo Apotheken-Meldungen die einzige Quelle sind, wäre die Liste unbrauchbar geworden.
      // Eine echte Apotheke meldet selten mehr als eine Handvoll neue Engpässe am Tag.
      const heute = shortagesRepo.list().filter(s => s.reporter_user_id === userId && s.gemeldet_am === today).length;
      if (heute >= MAX_NEUE_MELDUNGEN_TAG && !(social.isModerator && social.isModerator(userId))) {
        throw new AppError('meldungen_tageslimit', `Heute schon ${MAX_NEUE_MELDUNGEN_TAG} neue Engpässe gemeldet. Weitere bitte morgen — bestehende Meldungen bestätigen geht weiter.`, 429);
      }
      const created = shortagesRepo.upsert({
        wirkstoff: w, bezeichnung: bez, status, grund: (grund ? String(grund).trim().slice(0, 200) : null),
        provenance: 'community', quelle: null, reporter_user_id: userId, gemeldet_am: today,
        voraussichtlich_bis, country,
      });
      // Beobachter:innen dieses Wirkstoffs informieren (ausser Melder selbst).
      const label = `${w} · ${STATUS_LABEL[status]} (Community-Meldung)`;
      for (const uid of beobachterImLand(w, created.country)) {
        social.pushNotification({ userId: uid, type: 'watch_alert', actorUserId: userId, refType: 'shortage', refId: created.id, label });
      }
      return decorate(created, userId);
    },

    // "Auch bei uns" — andere Apotheke bestätigt einen gemeldeten Engpass.
    confirmShortage(userId, id) {
      requireProfessional(userId);
      const before = shortagesRepo.get(id);
      if (!before) throw new AppError('shortage_not_found', 'Engpass nicht gefunden.', 404);
      const updated = shortagesRepo.confirm(id, userId, today());
      // Melder:in über Bestätigung informieren (soziales Feedback) — aber nur EINMAL je Apotheke,
      // sonst würde ein confirm/unconfirm/confirm-Toggle die Melder:in mit Meldungen fluten.
      const grew = (updated.confirmations || []).length > (before.confirmations || []).length;
      if (before.reporter_user_id && grew && !shortagesRepo.wasConfirmNotified(id, userId)) {
        shortagesRepo.markConfirmNotified(id, userId);
        social.pushNotification({ userId: before.reporter_user_id, type: 'shortage_confirm', actorUserId: userId, refType: 'shortage', refId: id, label: before.wirkstoff });
      }
      // Schwelle „bestätigt" erreicht (einmal je Meldung): Beobachter:innen im
      // Land erfahren, dass aus einem Hinweis ein von mehreren Apotheken
      // bestätigter Engpass wurde — klar als nicht amtlich gekennzeichnet.
      if (grew) { bestaetigtMelden(updated, userId); pruefungMelden(updated, userId); }
      return decorate(updated, userId);
    },
    // Bestätigung zurücknehmen (Fehlklick/Wieder-lieferbar bei uns) — Gegenstück zu confirmShortage.
    unconfirmShortage(userId, id) {
      requireProfessional(userId);
      const s = shortagesRepo.get(id);
      if (!s) throw new AppError('shortage_not_found', 'Engpass nicht gefunden.', 404);
      return decorate(shortagesRepo.unconfirm(id, userId), userId);
    },

    // Melder:in (oder Moderation) meldet die eigene Community-Meldung als wieder lieferbar.
    resolveShortage(userId, id) {
      const s = shortagesRepo.get(id);
      if (!s) throw new AppError('shortage_not_found', 'Engpass nicht gefunden.', 404);
      if (s.provenance !== 'community') throw new AppError('shortage_not_community', 'Nur Community-Meldungen können so aufgelöst werden.');
      if (s.reporter_user_id !== userId && !social.isModerator(userId)) {
        const e = new AppError('shortage_nur_meldende', 'Nur die meldende Apotheke kann das auflösen.');
        e.status = 403; throw e;
      }
      if (s.status === 'verfuegbar') return decorate(s, userId);
      const today = new Date().toISOString().slice(0, 10);
      const updated = shortagesRepo.setStatus(id, { status: 'verfuegbar', gemeldet_am: today });
      // Beobachter:innen UND Bestätiger:innen informieren (ausser Auslöser).
      const targets = new Set([...beobachterImLand(s.wirkstoff, s.country), ...(s.confirmations || [])]);
      const label = `${s.wirkstoff} · Wieder verfügbar`;
      for (const uid of targets) {
        social.pushNotification({ userId: uid, type: 'watch_alert', actorUserId: userId, refType: 'shortage', refId: id, label });
      }
      return decorate(updated, userId);
    },

    // Melder:in (oder Moderation) aktualisiert den voraussichtlichen Wiederverfügbarkeits-
    // Termin der eigenen Community-Meldung (z. B. wenn der Großhandel den Termin verschiebt).
    // Leerer Wert entfernt den Termin. Beobachter:innen + Bestätiger:innen werden informiert.
    updateExpectedDate(userId, id, voraussichtlichBis) {
      const s = shortagesRepo.get(id);
      if (!s) throw new AppError('shortage_not_found', 'Engpass nicht gefunden.', 404);
      if (s.provenance !== 'community') throw new AppError('shortage_not_community', 'Nur Community-Meldungen können so geändert werden.', 400);
      if (s.reporter_user_id !== userId && !social.isModerator(userId)) {
        const e = new AppError('shortage_nur_meldende', 'Nur die meldende Apotheke kann den Termin ändern.');
        e.status = 403; throw e;
      }
      let vb = null;
      const raw = String(voraussichtlichBis || '').trim();
      if (raw) {
        if (!isValidCalendarDay(raw)) {
          throw new AppError('shortage_bad_date', 'Ungültiges Datum (voraussichtlich bis).', 400);
        }
        vb = raw;
      }
      if ((s.voraussichtlich_bis || null) === vb) return decorate(s, userId); // keine Änderung
      const updated = shortagesRepo.setExpectedDate(id, vb);
      const targets = new Set([...beobachterImLand(s.wirkstoff, s.country), ...(s.confirmations || [])]);
      targets.delete(userId);
      const label = vb ? `${s.wirkstoff} · Termin ${vb}` : `${s.wirkstoff} · Termin offen`;
      for (const uid of targets) {
        social.pushNotification({ userId: uid, type: 'watch_alert', actorUserId: userId, refType: 'shortage', refId: id, label });
      }
      return decorate(updated, userId);
    },

    // Melder:in (oder Moderation) aktualisiert die eigene Community-Meldung: Lieferstatus
    // (kritisch ↔ eingeschränkt lieferbar) und/oder Grund — ohne die Meldung löschen/neu
    // anlegen zu müssen (Bestätigungen der Kolleg:innen bleiben erhalten). „Wieder verfügbar"
    // läuft bewusst weiter über resolveShortage (eigene Semantik). Nur bei echter
    // Statusänderung werden Beobachter:innen + Bestätiger:innen informiert (kein Spam bei
    // reiner Grund-Korrektur).
    updateShortageReport(userId, id, { status, grund } = {}) {
      requireProfessional(userId);
      const s = shortagesRepo.get(id);
      if (!s) throw new AppError('shortage_not_found', 'Engpass nicht gefunden.', 404);
      if (s.provenance !== 'community') throw new AppError('shortage_not_community', 'Nur Community-Meldungen können bearbeitet werden.', 400);
      if (s.reporter_user_id !== userId && !social.isModerator(userId)) {
        const e = new AppError('shortage_nur_meldende', 'Nur die meldende Apotheke kann die Meldung bearbeiten.');
        e.status = 403; throw e;
      }
      // Validierung vorab, damit nichts halb angewendet wird.
      let newStatus;
      if (status !== undefined && status !== null && String(status) !== '') {
        if (!['kritisch', 'eingeschraenkt'].includes(status)) {
          throw new AppError('shortage_bad_status', 'Status hier nur „kritisch" oder „eingeschränkt lieferbar". Für wieder lieferbar den Button „wieder verfügbar" nutzen.', 400);
        }
        newStatus = status;
      }
      const statusChanged = newStatus !== undefined && newStatus !== s.status;
      const patch = {};
      if (statusChanged) { patch.status = newStatus; patch.gemeldet_am = new Date().toISOString().slice(0, 10); }
      if (grund !== undefined) patch.grund = grund ? String(grund).trim().slice(0, 200) : null;
      let updated = s;
      if (Object.keys(patch).length) updated = shortagesRepo.setStatus(id, patch);
      if (statusChanged) {
        const targets = new Set([...beobachterImLand(s.wirkstoff, s.country), ...(s.confirmations || [])]);
        targets.delete(userId);
        const label = `${s.wirkstoff} · ${STATUS_LABEL[newStatus]} (aktualisiert)`;
        for (const uid of targets) {
          social.pushNotification({ userId: uid, type: 'watch_alert', actorUserId: userId, refType: 'shortage', refId: id, label });
        }
      }
      return decorate(updated, userId);
    },

    // ── Engpass-Status ändern (nur Redaktion/Moderation) + Watcher benachrichtigen ──
    // Sicherheitsrelevante Aussage => Quelle (http[s]-Link) ist Pflicht (CLAUDE.md).
    updateStatus(actorUserId, id, { status, sourceUrl }) {
      if (!social.isModerator(actorUserId)) {
        const e = new AppError('forbidden', 'Nur Redaktion/Moderation darf den Status ändern.');
        e.status = 403; throw e;
      }
      if (!VALID_STATUS.includes(status)) throw new AppError('status_unbekannt', 'Unbekannter Status.');
      const quelle = cleanSourceUrl(sourceUrl); // wirft ohne gültigen Link
      if (!quelle) throw new AppError('quelle_fehlt', 'Quelle (Link) ist erforderlich.');
      const before = shortagesRepo.get(id);
      if (!before) throw new AppError('shortage_not_found', 'Engpass nicht gefunden.', 404);
      const today = new Date().toISOString().slice(0, 10);
      const updated = shortagesRepo.setStatus(id, { status, quelle, provenance: 'editorial', gemeldet_am: today });

      // Nur bei tatsächlicher Änderung die Beobachter:innen informieren.
      if (before.status !== status) {
        const label = `${updated.wirkstoff} · ${STATUS_LABEL[status]}`;
        for (const uid of beobachterImLand(updated.wirkstoff, updated.country)) {
          social.pushNotification({ userId: uid, type: 'watch_alert', actorUserId, refType: 'shortage', refId: id, label });
        }
      }
      // wie die übrigen Mutatoren dekoriert zurückgeben (keine rohen User-IDs nach außen).
      return decorate(updated, actorUserId);
    },

    // ── Aktualität von Apotheken-Meldungen ────────────────────────────────
    // „Still short": jede Fachperson im Land frischt auf (und bestätigt damit).
    nochAktuell(userId, id) {
      requireProfessional(userId);
      const s = shortagesRepo.get(id);
      if (!s) throw new AppError('shortage_not_found', 'Engpass nicht gefunden.', 404);
      if (s.provenance !== 'community' || !['kritisch', 'eingeschraenkt'].includes(s.status)) throw new AppError('shortage_not_community', 'Nur offene Meldungen aus Apotheken lassen sich auffrischen.', 409);
      return decorate(shortagesRepo.nochAktuell(id, userId, today()), userId);
    },
    // „Wieder lieferbar": nur wer gemeldet oder bestätigt hat (oder die Redaktion).
    wiederLieferbar(userId, id) {
      requireProfessional(userId);
      const s = shortagesRepo.get(id);
      if (!s) throw new AppError('shortage_not_found', 'Engpass nicht gefunden.', 404);
      if (s.provenance !== 'community') throw new AppError('shortage_not_community', 'Amtliche Einträge ändert nur die Behördenliste.', 409);
      const beteiligt = s.reporter_user_id === userId || (s.confirmations || []).includes(userId) || social.isModerator(userId);
      if (!beteiligt) throw new AppError('shortage_not_involved', 'Wieder lieferbar melden kann, wer den Engpass gemeldet oder bestätigt hat.', 403);
      if (s.status === 'verfuegbar') return decorate(s, userId);
      const updated = shortagesRepo.setStatus(id, { status: 'verfuegbar', gemeldet_am: today() });
      const label = `${updated.wirkstoff} · ${STATUS_LABEL.verfuegbar} (Community-Meldung)`;
      for (const uid of beobachterImLand(updated.wirkstoff, updated.country)) {
        social.pushNotification({ userId: uid, type: 'watch_alert', actorUserId: userId, refType: 'shortage', refId: id, label });
      }
      return decorate(updated, userId);
    },
    // ── Moderation: Prüfliste für Apotheken-Meldungen ──────────────────────
    //  Die 24-Stunden-Regel (zaehlendeApotheken) verzögert Schein-Konten nur.
    //  In der Zeit soll die Moderation SEHEN, was auffällt — sonst ist die
    //  Verzögerung bloß ein Warten. Signale, keine Urteile: Kolleg:innen, die
    //  sich gegenseitig einladen und am selben Tag anlegen, sind oft echt.
    pruefliste(modUserId, { vonWem = optVonWem } = {}) {
      requireModerator(modUserId);
      const out = [];
      for (const s of shortagesRepo.list()) {
        const p = pruefSignale(s, vonWem);
        if (!p || !p.signale.length) continue;
        out.push({ id: s.id, wirkstoff: s.wirkstoff, bezeichnung: s.bezeichnung, land: s.country || null, status: s.status, gemeldet_am: s.gemeldet_am, apotheken: 1 + (s.confirmations || []).length, bestaetigt: istBestaetigt(s, today()), signale: p.signale, beteiligte: p.leute });
      }
      return out.sort((a, b) => (b.bestaetigt - a.bestaetigt) || (b.signale.length - a.signale.length));
    },
    // Moderation: eine Bestätigung entfernen (z. B. Schein-Konto).
    modBestaetigungEntfernen(modUserId, id, handle) {
      requireModerator(modUserId);
      const p = social.getProfile(String(handle || ''));
      if (!p) throw new AppError('profil_unbekannt', 'Konto nicht gefunden.', 404);
      const s = shortagesRepo.get(id);
      if (!s || s.provenance !== 'community') throw new AppError('shortage_not_community', 'Nur Apotheken-Meldungen.', 404);
      return decorate(shortagesRepo.unconfirm(id, p.user_id), modUserId);
    },
    // Moderation: falsche Meldung entfernen. NICHT über „wieder lieferbar" —
    // das meldete allen Beobachter:innen „Wieder verfügbar", was falsch wäre.
    modEntfernen(modUserId, id) {
      requireModerator(modUserId);
      const weg = shortagesRepo.remove(id);
      if (!weg) throw new AppError('shortage_not_community', 'Nur Apotheken-Meldungen können entfernt werden.', 404);
      if (weg.reporter_user_id) social.pushNotification({ userId: weg.reporter_user_id, type: 'shortage_entfernt', actorUserId: modUserId, refType: 'wirkstoff', refId: weg.wirkstoff, label: `${weg.wirkstoff} · ${weg.country || ''}` });
      return { ok: true, id };
    },

    // Erinnerung an die Meldende, sobald „noch aktuell?" fällig ist (einmal je Runde).
    erinnern() {
      let n = 0;
      for (const s of shortagesRepo.list()) {
        // Bestätigungen neuer Konten zählen erst nach ZAEHLT_AB_STUNDEN — jetzt nachholen.
        bestaetigtMelden(s);
        if (!s.reporter_user_id || s.erinnert || aktualitaet(s, today()).stufe !== 'pruefen') continue;
        shortagesRepo.markErinnert(s.id);
        if (social.pushNotification({ userId: s.reporter_user_id, type: 'shortage_noch_aktuell', refType: 'shortage', refId: s.id, label: `${s.wirkstoff} · ${s.country || ''}` })) n++;
      }
      return n;
    },

    // ── Beobachtungsliste: Wirkstoffe, die ein:e Apotheker:in im Blick behalten will ──
    watch(userId, wirkstoff) {
      const w = String(wirkstoff || '').trim();
      if (!w) throw new AppError('shortage_wirkstoff_missing', 'Wirkstoff fehlt.');
      if (w.length > 120) throw new AppError('wirkstoff_zu_lang', 'Wirkstoff zu lang.');
      shortagesRepo.addWatch(userId, w);
      return this.myWatchlist(userId);
    },
    // Mehrere Wirkstoffe auf einmal beobachten (Liste oder mit , ; Zeilenumbruch getrennt).
    // Onboarding-Beschleuniger: eigene Merkliste einmal einfügen statt einzeln tippen.
    watchMany(userId, input) {
      const raw = Array.isArray(input) ? input : String(input || '').split(/[,;\n]+/);
      const seen = new Set();
      const names = [];
      for (const item of raw) {
        const w = String(item || '').trim();
        if (!w || w.length > 120) continue;
        const k = w.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k); names.push(w);
      }
      if (!names.length) throw new AppError('watch_none', 'Kein gültiger Wirkstoff angegeben.');
      for (const w of names) shortagesRepo.addWatch(userId, w);
      return this.myWatchlist(userId);
    },
    unwatch(userId, wirkstoff) {
      shortagesRepo.removeWatch(userId, wirkstoff);
      return this.myWatchlist(userId);
    },
    // Premium: private Notiz an einem beobachteten Wirkstoff setzen/ändern/löschen.
    setWatchNote(userId, wirkstoff, note) {
      if (!hasPremium(userId)) { const e = new Error('Notizen sind eine Premium-Funktion.'); e.code = 'premium_required'; e.status = 403; throw e; }
      if (!shortagesRepo.isWatched(userId, wirkstoff)) { const e = new Error('Wirkstoff nicht in der Beobachtungsliste.'); e.code = 'not_watched'; e.status = 400; throw e; }
      shortagesRepo.setWatchNote(userId, wirkstoff, note);
      return this.myWatchlist(userId);
    },
    // Rabatt-Alarm: „benachrichtige mich ab X % Rabatt" für einen beobachteten Wirkstoff.
    // pct leer/0 schaltet den Alarm ab. 1..99.
    setWatchAlert(userId, wirkstoff, pct) {
      if (!shortagesRepo.isWatched(userId, wirkstoff)) throw new AppError('not_watched', 'Wirkstoff nicht in der Beobachtungsliste.');
      let p = (pct == null || pct === '') ? null : Math.round(Number(pct));
      if (p != null && (isNaN(p) || p < 1 || p > 99)) throw new AppError('alert_pct_range', 'Alarm-Schwelle: 1–99 %.');
      shortagesRepo.setWatchAlert(userId, wirkstoff, p);
      return this.myWatchlist(userId);
    },
    // Rabatt-Alarm für ALLE beobachteten Wirkstoffe auf einmal setzen/abschalten — spart
    // Zeit bei großer Beobachtungsliste. pct leer/0 => alle Alarme aus. 1..99. Gibt die
    // Anzahl betroffener Wirkstoffe + die aktualisierte Liste zurück.
    setWatchAlertAll(userId, pct) {
      // leer/null/0 => alle Alarme aus; sonst 1..99.
      let p = (pct == null || pct === '' || Number(pct) === 0) ? null : Math.round(Number(pct));
      if (p != null && (isNaN(p) || p < 1 || p > 99)) throw new AppError('alert_pct_range', 'Alarm-Schwelle: 1–99 %.');
      const watched = shortagesRepo.listWatch(userId);
      for (const w of watched) shortagesRepo.setWatchAlert(userId, w, p);
      return { count: watched.length, pct: p, items: this.myWatchlist(userId) };
    },
    wasAlerted(userId, dealKey) { return shortagesRepo.wasDealAlerted(userId, dealKey); },
    markAlerted(userId, dealKey) { shortagesRepo.markDealAlerted(userId, dealKey); },

    // Beobachtete Wirkstoffe mit aktuellem Engpass-Status (rot = kritisch).
    // Kein passender Engpass-Eintrag => Status 'unauffaellig' (derzeit keine Meldung).
    // Status je beobachtetem Wirkstoff — aus EINEM Land: dem angesehenen, sonst
    // dem Heimatland. Vorher der kritischste Engpass aus irgendeinem Land: Eine
    // deutsche Apotheke sah „Amoxicillin: kritisch" wegen eines Wiener Eintrags.
    myWatchlist(userId, { country = null } = {}) {
      const all = shortagesRepo.list({ country: country || heimatVon(userId) || null }); // nach Kritikalität sortiert
      const byWirkstoff = new Map();
      for (const s of all) {
        const k = wkKey(s.wirkstoff);
        if (!byWirkstoff.has(k)) byWirkstoff.set(k, s); // erster Treffer = kritischster
      }
      const t0 = today();
      return shortagesRepo.listWatch(userId).map(w => {
        const s = byWirkstoff.get(wkKey(w));
        const aging = s ? shortageAging(s.gemeldet_am, s.voraussichtlich_bis, s.status, t0) : { days_reported: null, days_until: null, overdue: false };
        return {
          wirkstoff: w,
          status: s ? s.status : 'unauffaellig',
          bezeichnung: s ? s.bezeichnung : null,
          shortage_id: s ? s.id : null,
          quelle: s ? s.quelle : null,
          provenance: s ? s.provenance : null,
          voraussichtlich_bis: s ? (s.voraussichtlich_bis || null) : null,
          days_until: aging.days_until,       // Tage bis voraussichtlichem Termin (negativ = überfällig)
          overdue: aging.overdue,             // voraussichtlicher Termin überschritten
          note: shortagesRepo.getWatchNote(userId, w), // Premium: private Notiz (leer für Gratis)
          alert_pct: shortagesRepo.getWatchAlert(userId, w), // Rabatt-Alarm-Schwelle (null = aus)
          week_change: s ? weeklyChange(s, t0) : null, // Änderung der letzten 7 Tage (Wochenrückblick)
        };
      }).sort((a, b) => {
        const rank = { kritisch: 3, eingeschraenkt: 2, verfuegbar: 1, unauffaellig: 0 };
        return (rank[b.status] || 0) - (rank[a.status] || 0) || a.wirkstoff.localeCompare(b.wirkstoff);
      });
    },
  };
  return dienst;
}
