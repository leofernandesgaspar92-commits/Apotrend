// Engpass-Modul (Priorität 2) + Verknüpfung mit dem Feed (Priorität 1).
// Liest Engpässe (mit Herkunfts-Flag) und verbindet sie mit den Beiträgen, die
// sie referenzieren ("X Apotheker haben dazu gepostet").
import { cleanSourceUrl } from '../domain/media.js';
import { AppError } from '../domain/errors.js';

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

export function createShortagesService(shortagesRepo, social, options = {}) {
  // Heutiger Kalendertag (injizierbar für Tests) — Grundlage der Alters-/Fristsignale.
  const today = () => (options.today ? options.today() : new Date().toISOString().slice(0, 10));
  // Premium-Gate (injiziert): Notizen an beobachteten Wirkstoffen sind ein Premium-Vorteil.
  const hasPremium = options.hasPremium || (() => false);
  // Engpass-Zeile für die Anzeige anreichern: Melder-Profil + Bestätigungen.
  function decorate(s, viewerUserId) {
    const confirmations = s.confirmations || [];
    const reporter = s.reporter_user_id ? social.getProfile(s.reporter_user_id) : null;
    return {
      ...s,
      confirmations: undefined, // rohe User-IDs nicht nach außen geben
      confirm_count: confirmations.length,
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
  function requireProfessional(userId) {
    const prof = social.getProfile(userId);
    if (prof && prof.account_type === 'private') {
      throw new AppError('shortage_pro_only', 'Engpass-Meldungen sind sicherheitsrelevant und Fachkreisen (Apotheke, Pharma-Unternehmen, Behörde) vorbehalten. Als Privatnutzer:in kannst du Engpässe lesen, aber nicht melden oder bestätigen.', 403);
    }
  }
  return {
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
      if (!shortage) throw new Error('Engpass nicht gefunden.');
      return social.createPost(actorUserId, { body, visibility, refType: 'shortage', refId: id });
    },

    // Liste mit Aktivitäts-Zähler pro Engpass (fuer das Dashboard).
    listWithCounts(viewerUserId) {
      return shortagesRepo.list().map(s => decorate(s, viewerUserId));
    },

    // ── Community-Meldung: eine Apotheke meldet einen selbst beobachteten Engpass ──
    // Herkunft klar als 'community' gekennzeichnet (nicht offiziell/BASG-verifiziert).
    reportShortage(userId, { wirkstoff, bezeichnung, grund, status = 'kritisch', voraussichtlichBis }) {
      requireProfessional(userId);
      const w = String(wirkstoff || '').trim();
      if (!w) throw new AppError('shortage_wirkstoff_missing', 'Wirkstoff fehlt.');
      if (w.length > 120) throw new Error('Wirkstoff zu lang.');
      const bez = String(bezeichnung || '').trim() || w;
      if (bez.length > 200) throw new Error('Bezeichnung zu lang.');
      if (!VALID_STATUS.includes(status)) throw new Error('Unbekannter Status.');
      // Optionales "voraussichtlich lieferbar bis"-Datum (Kalendertag, ISO YYYY-MM-DD).
      let voraussichtlich_bis = null;
      const vb = String(voraussichtlichBis || '').trim();
      if (vb) {
        if (!isValidCalendarDay(vb)) throw new Error('Ungültiges Datum (voraussichtlich bis).');
        voraussichtlich_bis = vb;
      }
      // Doppel-/Fehlklick-Schutz: dieselbe Apotheke soll denselben Wirkstoff nicht
      // mehrfach offen melden (andere sollen stattdessen bestätigen).
      const dupe = shortagesRepo.list().find(s =>
        s.reporter_user_id === userId &&
        s.provenance === 'community' &&
        s.status !== 'verfuegbar' &&
        s.wirkstoff.trim().toLowerCase() === w.toLowerCase());
      if (dupe) throw new AppError('shortage_duplicate', 'Du hast diesen Wirkstoff bereits gemeldet.');
      const today = new Date().toISOString().slice(0, 10);
      const created = shortagesRepo.upsert({
        wirkstoff: w, bezeichnung: bez, status, grund: (grund ? String(grund).trim().slice(0, 200) : null),
        provenance: 'community', quelle: null, reporter_user_id: userId, gemeldet_am: today,
        voraussichtlich_bis,
      });
      // Beobachter:innen dieses Wirkstoffs informieren (ausser Melder selbst).
      const label = `${w} · ${STATUS_LABEL[status]} (Community-Meldung)`;
      for (const uid of shortagesRepo.usersWatching(w)) {
        social.pushNotification({ userId: uid, type: 'watch_alert', actorUserId: userId, refType: 'shortage', refId: created.id, label });
      }
      return decorate(created, userId);
    },

    // "Auch bei uns" — andere Apotheke bestätigt einen gemeldeten Engpass.
    confirmShortage(userId, id) {
      requireProfessional(userId);
      const before = shortagesRepo.get(id);
      if (!before) { const e = new Error('Engpass nicht gefunden.'); e.status = 404; throw e; }
      const updated = shortagesRepo.confirm(id, userId);
      // Melder:in über Bestätigung informieren (soziales Feedback).
      if (before.reporter_user_id && (updated.confirmations || []).length > (before.confirmations || []).length) {
        social.pushNotification({ userId: before.reporter_user_id, type: 'shortage_confirm', actorUserId: userId, refType: 'shortage', refId: id, label: before.wirkstoff });
      }
      return decorate(updated, userId);
    },

    // Melder:in (oder Moderation) meldet die eigene Community-Meldung als wieder lieferbar.
    resolveShortage(userId, id) {
      const s = shortagesRepo.get(id);
      if (!s) { const e = new Error('Engpass nicht gefunden.'); e.status = 404; throw e; }
      if (s.provenance !== 'community') throw new Error('Nur Community-Meldungen können so aufgelöst werden.');
      if (s.reporter_user_id !== userId && !social.isModerator(userId)) {
        const e = new Error('Nur die meldende Apotheke kann das auflösen.');
        e.status = 403; throw e;
      }
      if (s.status === 'verfuegbar') return decorate(s, userId);
      const today = new Date().toISOString().slice(0, 10);
      const updated = shortagesRepo.setStatus(id, { status: 'verfuegbar', gemeldet_am: today });
      // Beobachter:innen UND Bestätiger:innen informieren (ausser Auslöser).
      const targets = new Set([...shortagesRepo.usersWatching(s.wirkstoff), ...(s.confirmations || [])]);
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
      if (!s) { const e = new Error('Engpass nicht gefunden.'); e.status = 404; throw e; }
      if (s.provenance !== 'community') throw new AppError('shortage_not_community', 'Nur Community-Meldungen können so geändert werden.', 400);
      if (s.reporter_user_id !== userId && !social.isModerator(userId)) {
        const e = new Error('Nur die meldende Apotheke kann den Termin ändern.');
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
      const targets = new Set([...shortagesRepo.usersWatching(s.wirkstoff), ...(s.confirmations || [])]);
      targets.delete(userId);
      const label = vb ? `${s.wirkstoff} · Termin ${vb}` : `${s.wirkstoff} · Termin offen`;
      for (const uid of targets) {
        social.pushNotification({ userId: uid, type: 'watch_alert', actorUserId: userId, refType: 'shortage', refId: id, label });
      }
      return decorate(updated, userId);
    },

    // ── Engpass-Status ändern (nur Redaktion/Moderation) + Watcher benachrichtigen ──
    // Sicherheitsrelevante Aussage => Quelle (http[s]-Link) ist Pflicht (CLAUDE.md).
    updateStatus(actorUserId, id, { status, sourceUrl }) {
      if (!social.isModerator(actorUserId)) {
        const e = new Error('Nur Redaktion/Moderation darf den Status ändern.');
        e.status = 403; throw e;
      }
      if (!VALID_STATUS.includes(status)) throw new Error('Unbekannter Status.');
      const quelle = cleanSourceUrl(sourceUrl); // wirft ohne gültigen Link
      if (!quelle) throw new Error('Quelle (Link) ist erforderlich.');
      const before = shortagesRepo.get(id);
      if (!before) { const e = new Error('Engpass nicht gefunden.'); e.status = 404; throw e; }
      const today = new Date().toISOString().slice(0, 10);
      const updated = shortagesRepo.setStatus(id, { status, quelle, provenance: 'editorial', gemeldet_am: today });

      // Nur bei tatsächlicher Änderung die Beobachter:innen informieren.
      if (before.status !== status) {
        const label = `${updated.wirkstoff} · ${STATUS_LABEL[status]}`;
        for (const uid of shortagesRepo.usersWatching(updated.wirkstoff)) {
          social.pushNotification({ userId: uid, type: 'watch_alert', actorUserId, refType: 'shortage', refId: id, label });
        }
      }
      // wie die übrigen Mutatoren dekoriert zurückgeben (keine rohen User-IDs nach außen).
      return decorate(updated, actorUserId);
    },

    // ── Beobachtungsliste: Wirkstoffe, die ein:e Apotheker:in im Blick behalten will ──
    watch(userId, wirkstoff) {
      const w = String(wirkstoff || '').trim();
      if (!w) throw new Error('Wirkstoff fehlt.');
      if (w.length > 120) throw new Error('Wirkstoff zu lang.');
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
      let p = (pct == null || pct === '') ? null : Math.round(Number(pct));
      if (p != null && (isNaN(p) || p < 1 || p > 99)) throw new AppError('alert_pct_range', 'Alarm-Schwelle: 1–99 %.');
      const watched = shortagesRepo.listWatch(userId);
      for (const w of watched) shortagesRepo.setWatchAlert(userId, w, p);
      return { count: watched.length, pct: p, items: this.myWatchlist(userId) };
    },
    wasAlerted(userId, dealKey) { return shortagesRepo.wasDealAlerted(userId, dealKey); },
    markAlerted(userId, dealKey) { shortagesRepo.markDealAlerted(userId, dealKey); },

    // Beobachtete Wirkstoffe mit aktuellem Engpass-Status (rot = kritisch).
    // Kein passender Engpass-Eintrag => Status 'unauffaellig' (derzeit keine Meldung).
    myWatchlist(userId) {
      const all = shortagesRepo.list(); // nach Kritikalität sortiert
      const byWirkstoff = new Map();
      for (const s of all) {
        const k = s.wirkstoff.trim().toLowerCase();
        if (!byWirkstoff.has(k)) byWirkstoff.set(k, s); // erster Treffer = kritischster
      }
      const t0 = today();
      return shortagesRepo.listWatch(userId).map(w => {
        const s = byWirkstoff.get(w.trim().toLowerCase());
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
        };
      }).sort((a, b) => {
        const rank = { kritisch: 3, eingeschraenkt: 2, verfuegbar: 1, unauffaellig: 0 };
        return (rank[b.status] || 0) - (rank[a.status] || 0) || a.wirkstoff.localeCompare(b.wirkstoff);
      });
    },
  };
}
