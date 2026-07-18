// Bestandsaustausch-Modul (Biete/Suche) + Feed-nahe Anreicherung mit Autor-Profil.
// Kontaktaufnahme läuft über Direktnachrichten (social.startDm) — es werden keine
// öffentlichen Kontaktdaten getauscht.
import { ForbiddenError } from './orgAuth.js';
import { cleanImage } from '../domain/media.js';
import { AppError } from '../domain/errors.js';

const KINDS = ['biete', 'suche'];
export const BUNDESLAENDER = ['Wien', 'Niederösterreich', 'Oberösterreich', 'Steiermark', 'Tirol', 'Kärnten', 'Salzburg', 'Vorarlberg', 'Burgenland'];

export function createExchangeService(exchangeRepo, social, foundationRepo, shortagesRepo = null) {
  function requireUser(userId) {
    if (!foundationRepo.getUserById(userId)) throw new Error('Unbekannter Nutzer.');
  }
  // Bedeutungstragende Wörter (>=4 Zeichen) für das Matching Biete<->Suche.
  function words(text) {
    return new Set(String(text).toLowerCase().match(/[a-zäöüß0-9]{4,}/g) || []);
  }
  function shareWord(a, b) { for (const w of a) if (b.has(w)) return true; return false; }
  // Nach dem Anlegen: passende Gegen-Einträge finden und deren Autor:innen benachrichtigen.
  function notifyMatches(entry) {
    const opposite = entry.kind === 'biete' ? 'suche' : 'biete';
    const mine = words(entry.bezeichnung);
    if (!mine.size) return;
    const type = entry.kind === 'biete' ? 'exchange_offer' : 'exchange_want';
    const seen = new Set();
    for (const other of exchangeRepo.list()) {
      if (other.status !== 'offen' || other.kind !== opposite || other.id === entry.id) continue;
      if (other.author_user_id === entry.author_user_id || seen.has(other.author_user_id)) continue;
      if (!shareWord(mine, words(other.bezeichnung))) continue;
      seen.add(other.author_user_id);
      social.pushNotification({ userId: other.author_user_id, type, actorUserId: entry.author_user_id, refType: 'exchange', refId: entry.id, label: entry.bezeichnung });
    }
  }

  function decorate(e) {
    const prof = social.getProfile ? social.getProfile(e.author_user_id) : null;
    return {
      ...e,
      author: prof ? { handle: prof.handle, display_name: prof.display_name, verified: prof.verified } : null,
    };
  }

  return {
    create(actorUserId, { kind, bezeichnung, menge, ort, bundesland, note, image }) {
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
      const created = exchangeRepo.create({
        kind, authorUserId: actorUserId, bezeichnung: b,
        menge: (menge ?? '').toString().trim() || null,
        ort: (ort ?? '').toString().trim() || null,
        bundesland: bl,
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
    list(viewerUserId, { kind = null, status = 'offen', q = null, bundesland = null } = {}) {
      requireUser(viewerUserId);
      const query = q ? String(q).trim().toLowerCase() : null;
      return exchangeRepo.list()
        .filter(e => (!status || e.status === status) && (!kind || e.kind === kind)
          && (!query || e.bezeichnung.toLowerCase().includes(query))
          && (!bundesland || e.bundesland === bundesland))
        .map(decorate);
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
      return exchangeRepo.update(id, { status: 'erledigt', resolved_at: new Date().toISOString() });
    },
    remove(actorUserId, id) {
      const e = exchangeRepo.get(id);
      if (!e) throw new Error('Eintrag nicht gefunden.');
      if (e.author_user_id !== actorUserId) throw new ForbiddenError('Nur der Ersteller darf loeschen.');
      exchangeRepo.remove(id);
      return { ok: true };
    },
  };
}
