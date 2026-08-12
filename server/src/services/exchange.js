// Bestandsaustausch-Modul (Biete/Suche) + Feed-nahe Anreicherung mit Autor-Profil.
// Kontaktaufnahme läuft über Direktnachrichten (social.startDm) — es werden keine
// öffentlichen Kontaktdaten getauscht.
import { ForbiddenError } from './orgAuth.js';
import { cleanImage } from '../domain/media.js';
import { AppError } from '../domain/errors.js';

const KINDS = ['biete', 'suche'];
// Echtes Kalenderdatum (YYYY-MM-DD), kein Überlauf (z.B. 2026-02-31 ungültig).
function isValidCalendarDay(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date().toISOString().slice(0, 10);
  const a = Date.parse(today + 'T00:00:00Z'), b = Date.parse(dateStr + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}
export const BUNDESLAENDER = ['Wien', 'Niederösterreich', 'Oberösterreich', 'Steiermark', 'Tirol', 'Kärnten', 'Salzburg', 'Vorarlberg', 'Burgenland'];

// Darreichungsform-/Füll-/Einheitenwörter, die keine Substanz kennzeichnen — beim
// Matching Biete<->Suche ignoriert, damit gemeinsame Formwörter keine Fehltreffer erzeugen.
const FORM_STOPWORDS = new Set([
  'tablette', 'tabletten', 'filmtablette', 'filmtabletten', 'brausetablette', 'brausetabletten',
  'kapsel', 'kapseln', 'hartkapseln', 'weichkapseln', 'dragee', 'dragees', 'retard', 'retardtabletten',
  'saft', 'sirup', 'tropfen', 'creme', 'salbe', 'lösung', 'loesung', 'losung', 'spray', 'granulat', 'pulver',
  'ampulle', 'ampullen', 'injektion', 'injektionslösung', 'zäpfchen', 'zaepfchen', 'suppositorien', 'pflaster',
  'packung', 'packungen', 'stück', 'stueck', 'flasche', 'flaschen', 'beutel', 'gramm', 'milligramm',
  'milliliter', 'liter', 'dosis', 'dosierung', 'stärke', 'staerke',
]);

export function createExchangeService(exchangeRepo, social, foundationRepo, shortagesRepo = null) {
  function requireUser(userId) {
    if (!foundationRepo.getUserById(userId)) throw new Error('Unbekannter Nutzer.');
  }
  // Bedeutungstragende Wörter (>=4 Zeichen) für das Matching Biete<->Suche. Reine
  // Darreichungsform-/Füllwörter und bloße Zahlen (Dosierung/Menge) fallen raus, damit
  // z.B. „Aspirin Tabletten" nicht auf „Metformin Tabletten" und „Amoxicillin 1000 mg"
  // nicht auf „Metformin 1000 mg" matcht (sonst Fehl-Benachrichtigungen).
  function words(text) {
    const raw = String(text).toLowerCase().match(/[a-zäöüß0-9]{4,}/g) || [];
    return new Set(raw.filter(w => !/^\d+$/.test(w) && !FORM_STOPWORDS.has(w)));
  }
  function shareWord(a, b) { for (const w of a) if (b.has(w)) return true; return false; }
  // Nach dem Anlegen: passende Gegen-Einträge finden und deren Autor:innen benachrichtigen.
  function notifyMatches(entry) {
    if (entry.reserved) return; // reservierte Einträge lösen kein Matchmaking aus (auch nicht beim Umbenennen)
    const opposite = entry.kind === 'biete' ? 'suche' : 'biete';
    const mine = words(entry.bezeichnung);
    if (!mine.size) return;
    const type = entry.kind === 'biete' ? 'exchange_offer' : 'exchange_want';
    const seen = new Set();
    for (const other of exchangeRepo.list()) {
      if (other.status !== 'offen' || other.reserved || other.kind !== opposite || other.id === entry.id) continue;
      if (other.author_user_id === entry.author_user_id || seen.has(other.author_user_id)) continue;
      if (!shareWord(mine, words(other.bezeichnung))) continue;
      seen.add(other.author_user_id);
      social.pushNotification({ userId: other.author_user_id, type, actorUserId: entry.author_user_id, refType: 'exchange', refId: entry.id, label: entry.bezeichnung });
    }
  }

  // Anzahl passender offener Gegen-Einträge (nach Autor:in eindeutig) — für ein sichtbares
  // Matchmaking-Signal am Eintrag: „N passende Angebote/Gesuche". Nur für offene Einträge.
  function countMatches(entry) {
    if (entry.status !== 'offen' || entry.reserved) return 0; // reservierte sind vergeben – kein aktives Matchmaking
    const opposite = entry.kind === 'biete' ? 'suche' : 'biete';
    const mine = words(entry.bezeichnung);
    if (!mine.size) return 0;
    const authors = new Set();
    for (const other of exchangeRepo.list()) {
      if (other.status !== 'offen' || other.reserved || other.kind !== opposite || other.id === entry.id) continue;
      if (other.author_user_id === entry.author_user_id) continue;
      if (!shareWord(mine, words(other.bezeichnung))) continue;
      authors.add(other.author_user_id);
    }
    return authors.size;
  }

  function decorate(e) {
    const prof = social.getProfile ? social.getProfile(e.author_user_id) : null;
    return {
      ...e,
      author: prof ? { handle: prof.handle, display_name: prof.display_name, verified: prof.verified } : null,
      match_count: countMatches(e),
      days_until_expiry: daysUntil(e.ablauf), // null wenn kein Verfallsdatum
    };
  }

  return {
    create(actorUserId, { kind, bezeichnung, menge, ort, bundesland, note, image, ablauf }) {
      requireUser(actorUserId);
      // Bestandsaustausch ist professioneller B2B-Vorgang (Apotheken tauschen Bestand) —
      // Privatnutzer:innen können Einträge lesen, aber keine anlegen.
      const prof = social.getProfile(actorUserId);
      if (prof && prof.account_type === 'private') {
        throw new AppError('exchange_pro_only', 'Der Bestandsaustausch (Biete/Suche) ist Apotheken und Fachkreisen vorbehalten. Als Privatnutzer:in kannst du Einträge lesen, aber keine anlegen.', 403);
      }
      if (!KINDS.includes(kind)) throw new Error('Art muss "biete" oder "suche" sein.');
      const b = String(bezeichnung ?? '').trim();
      if (!b) throw new AppError('exchange_name_required', 'Präparat/Wirkstoff erforderlich.');
      if (b.length > 200) throw new Error('Bezeichnung zu lang.');
      const bl = bundesland ? String(bundesland).trim() : null;
      if (bl && !BUNDESLAENDER.includes(bl)) throw new Error('Ungültiges Bundesland.');
      const abl = ablauf ? String(ablauf).trim() : null;
      if (abl && !isValidCalendarDay(abl)) throw new AppError('exchange_bad_date', 'Ungültiges Verfallsdatum.', 400);
      const created = exchangeRepo.create({
        kind, authorUserId: actorUserId, bezeichnung: b,
        menge: (menge ?? '').toString().trim() || null,
        ort: (ort ?? '').toString().trim() || null,
        bundesland: bl,
        ablauf: abl,
        note: (note ?? '').toString().trim() || null,
        image: cleanImage(image),
      });
      notifyMatches(created); // aktives Matching Biete<->Suche
      // Beobachter:innen benachrichtigen, wenn jemand ihren Wirkstoff anbietet.
      if (created.kind === 'biete' && shortagesRepo && shortagesRepo.watchersForText) {
        for (const { userId, wirkstoff } of shortagesRepo.watchersForText(created.bezeichnung)) {
          social.pushNotification({ userId, type: 'watch_offer', actorUserId: created.author_user_id, refType: 'exchange', refId: created.id, label: wirkstoff });
        }
      }
      return decorate(created);
    },
    // Offene Einträge (Standard), optional nach Art + Text (Präparat) + Bundesland gefiltert.
    // sort='ablauf' -> bald ablaufende zuerst (ohne Verfallsdatum ans Ende).
    list(viewerUserId, { kind = null, status = 'offen', q = null, bundesland = null, sort = null } = {}) {
      requireUser(viewerUserId);
      const query = q ? String(q).trim().toLowerCase() : null;
      const out = exchangeRepo.list()
        .filter(e => (!status || e.status === status) && (!kind || e.kind === kind)
          && (!query || e.bezeichnung.toLowerCase().includes(query))
          && (!bundesland || e.bundesland === bundesland))
        .map(decorate);
      if (sort === 'ablauf') {
        // Nur Einträge MIT Verfallsdatum aufsteigend; ohne Datum unverändert ans Ende.
        out.sort((a, b) => {
          const av = a.ablauf || '9999-12-31', bv = b.ablauf || '9999-12-31';
          return av.localeCompare(bv);
        });
      }
      return out;
    },
    // Offene Einträge einer bestimmten Apotheke — für deren öffentliches Profil (Biete/Suche
    // auf einen Blick; Kontakt läuft wie üblich per DM). Öffentlich lesbar wie die Liste,
    // daher kein Owner-Zwang. Neueste zuerst, begrenzt.
    byAuthor(authorUserId, { status = 'offen', limit = 12 } = {}) {
      if (!authorUserId) return [];
      const out = exchangeRepo.list()
        .filter(e => e.author_user_id === authorUserId && (!status || e.status === status))
        .map(decorate)
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      return limit ? out.slice(0, limit) : out;
    },
    // Eigene Einträge (alle Status), neueste zuerst — für „Meine Einträge"/Historie.
    mine(actorUserId, { status = null } = {}) {
      requireUser(actorUserId);
      return exchangeRepo.list()
        .filter(e => e.author_user_id === actorUserId && (!status || e.status === status))
        .map(decorate);
    },
    // Erledigten Eintrag wieder öffnen (nur Ersteller) — löst erneut Matching aus.
    reopen(actorUserId, id) {
      const e = exchangeRepo.get(id);
      if (!e) throw new Error('Eintrag nicht gefunden.');
      if (e.author_user_id !== actorUserId) throw new ForbiddenError('Nur der Ersteller darf das.');
      const updated = exchangeRepo.update(id, { status: 'offen', resolved_at: null });
      notifyMatches(updated);
      return decorate(updated);
    },
    markResolved(actorUserId, id) {
      const e = exchangeRepo.get(id);
      if (!e) throw new Error('Eintrag nicht gefunden.');
      if (e.author_user_id !== actorUserId) throw new ForbiddenError('Nur der Ersteller darf das.');
      return decorate(exchangeRepo.update(id, { status: 'erledigt', reserved: false, resolved_at: new Date().toISOString() }));
    },
    // Eintrag als „reserviert" markieren/freigeben (nur Ersteller, nur bei offenen Einträgen).
    // Reserviert = ein Tausch ist per Direktnachricht in Absprache; der Eintrag bleibt für alle
    // sichtbar, aber klar gekennzeichnet und aus dem aktiven Matchmaking genommen — so sparen
    // sich Kolleg:innen doppelte Anfragen zu bereits vergebener Ware.
    setReserved(actorUserId, id, reserved) {
      const e = exchangeRepo.get(id);
      if (!e) throw new AppError('exchange_not_found', 'Eintrag nicht gefunden.', 404);
      if (e.author_user_id !== actorUserId) throw new ForbiddenError('Nur der Ersteller darf das.');
      if (e.status !== 'offen') throw new AppError('exchange_not_open', 'Nur offene Einträge lassen sich reservieren.', 400);
      return decorate(exchangeRepo.update(id, { reserved: !!reserved }));
    },
    remove(actorUserId, id) {
      const e = exchangeRepo.get(id);
      if (!e) throw new Error('Eintrag nicht gefunden.');
      if (e.author_user_id !== actorUserId) throw new ForbiddenError('Nur der Ersteller darf loeschen.');
      exchangeRepo.remove(id);
      return { ok: true };
    },
    // Eigenen Eintrag bearbeiten (Ersteller): Präparat/Menge/Ort/Bundesland/Notiz. Die Art
    // (biete/suche) bleibt fest. Ändert sich die Bezeichnung, wird das Matching neu ausgelöst.
    update(actorUserId, id, { bezeichnung, menge, ort, bundesland, note, ablauf } = {}) {
      const e = exchangeRepo.get(id);
      if (!e) throw new AppError('exchange_not_found', 'Eintrag nicht gefunden.', 404);
      if (e.author_user_id !== actorUserId) throw new ForbiddenError('Nur der Ersteller darf bearbeiten.');
      const patch = {};
      if (bezeichnung !== undefined) {
        const b = String(bezeichnung ?? '').trim();
        if (!b) throw new AppError('exchange_name_required', 'Präparat/Wirkstoff erforderlich.');
        if (b.length > 200) throw new Error('Bezeichnung zu lang.');
        patch.bezeichnung = b;
      }
      if (menge !== undefined) patch.menge = (menge ?? '').toString().trim() || null;
      if (ort !== undefined) patch.ort = (ort ?? '').toString().trim() || null;
      if (bundesland !== undefined) {
        const bl = bundesland ? String(bundesland).trim() : null;
        if (bl && !BUNDESLAENDER.includes(bl)) throw new Error('Ungültiges Bundesland.');
        patch.bundesland = bl;
      }
      if (note !== undefined) patch.note = (note ?? '').toString().trim() || null;
      if (ablauf !== undefined) {
        const abl = ablauf ? String(ablauf).trim() : null;
        if (abl && !isValidCalendarDay(abl)) throw new AppError('exchange_bad_date', 'Ungültiges Verfallsdatum.', 400);
        patch.ablauf = abl;
      }
      const updated = exchangeRepo.update(id, patch);
      // Bei geänderter Bezeichnung (und noch offenem Eintrag) erneut passende Gegenstücke suchen.
      if (patch.bezeichnung !== undefined && updated.status === 'offen') notifyMatches(updated);
      return decorate(updated);
    },
  };
}
