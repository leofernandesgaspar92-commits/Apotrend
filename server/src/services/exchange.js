// Bestandsaustausch-Modul (Biete/Suche) + Feed-nahe Anreicherung mit Autor-Profil.
// Kontaktaufnahme läuft über Direktnachrichten (social.startDm) — es werden keine
// öffentlichen Kontaktdaten getauscht.
import { ForbiddenError } from './orgAuth.js';

const KINDS = ['biete', 'suche'];

export function createExchangeService(exchangeRepo, social, foundationRepo) {
  function requireUser(userId) {
    if (!foundationRepo.getUserById(userId)) throw new Error('Unbekannter Nutzer.');
  }
  function decorate(e) {
    const prof = social.getProfile ? social.getProfile(e.author_user_id) : null;
    return {
      ...e,
      author: prof ? { handle: prof.handle, display_name: prof.display_name, verified: prof.verified } : null,
    };
  }

  return {
    create(actorUserId, { kind, bezeichnung, menge, ort, note }) {
      requireUser(actorUserId);
      if (!KINDS.includes(kind)) throw new Error('Art muss "biete" oder "suche" sein.');
      const b = String(bezeichnung ?? '').trim();
      if (!b) throw new Error('Präparat/Wirkstoff erforderlich.');
      if (b.length > 200) throw new Error('Bezeichnung zu lang.');
      return decorate(exchangeRepo.create({
        kind, authorUserId: actorUserId, bezeichnung: b,
        menge: (menge ?? '').toString().trim() || null,
        ort: (ort ?? '').toString().trim() || null,
        note: (note ?? '').toString().trim() || null,
      }));
    },
    // Offene Einträge (Standard), optional nach Art gefiltert, neueste zuerst.
    list(viewerUserId, { kind = null, status = 'offen' } = {}) {
      requireUser(viewerUserId);
      return exchangeRepo.list()
        .filter(e => (!status || e.status === status) && (!kind || e.kind === kind))
        .map(decorate);
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
