// Social-Layer (Priorität 1): Apotheker als Person. Profile, kurze Posts,
// Kommentar-Threads, typisierte Reaktionen, gerichtete Follows, Home-/Öffentlich-Feed.
// Sichtbarkeit pro Post (public/followers) wird bei JEDER Leseoperation erzwungen.
import { ForbiddenError } from './orgAuth.js';
import { AppError } from '../domain/errors.js';
import { cleanImage, cleanSourceUrl } from '../domain/media.js';
import { BUNDESLAENDER } from './exchange.js';
import { isValidCountry, normalizeCountry, normalizeLocale } from '../data/countries.js';
import { isValidAccountType, normalizeAccountType } from '../data/accountTypes.js';

const REACTION_TYPES = ['hilfreich', 'danke', 'bestaetigt', 'interessant'];
const MAX_BODY = 1000;
// „Offen für" — wofür ein Profil offen ist (Vernetzungs-/Geschäftssignale). Feste
// Schlüssel; die Beschriftung/Übersetzung liegt im Frontend.
export const OPEN_TO_KEYS = ['kooperation', 'einkauf', 'vertretung', 'austausch', 'mentoring', 'jobs'];

export function createSocialService(social, foundationRepo, options = {}) {
  // Wer darf moderieren (Reports bearbeiten, fremde Inhalte entfernen)? Bewusst
  // injiziert — eine echte Plattform-Moderator-Rolle ist noch nicht modelliert.
  const isModerator = options.isModerator || (() => false);

  function requireUser(userId) {
    const u = foundationRepo.getUserById(userId);
    if (!u) throw new Error('Unbekannter Nutzer.');
    return u;
  }

  function notify(userId, type, actorUserId, refType, refId) {
    if (!userId || userId === actorUserId) return; // nie sich selbst benachrichtigen
    social.createNotification({ userId, type, actorUserId, refType, refId });
  }

  // @handle-Erwaehnungen im Text -> Mention-Benachrichtigungen.
  function notifyMentions(text, actorUserId, refType, refId) {
    const seen = new Set();
    for (const m of String(text).matchAll(/@([a-z0-9_]{3,30})/gi)) {
      const handle = m[1].toLowerCase();
      if (seen.has(handle)) continue;
      seen.add(handle);
      const prof = social.getProfileByHandle(handle);
      if (prof) notify(prof.user_id, 'mention', actorUserId, refType, refId);
    }
  }
  // Darf viewer diesen Post sehen?
  function visibleTo(post, viewerId) {
    if (post.deleted_at) return false;
    if (post.author_user_id === viewerId) return true;
    if (post.visibility === 'public') return true;
    return post.visibility === 'followers' && social.isFollowing(viewerId, post.author_user_id);
  }
  // Post + leichte Metadaten (Autor, Zähler) fuer die Anzeige.
  function decorate(post, viewerUserId = null) {
    const prof = social.getProfileByUserId(post.author_user_id);
    const reacts = social.listReactions('post', post.id);
    const counts = {};
    for (const t of REACTION_TYPES) counts[t] = reacts.filter(r => r.type === t).length;
    // Eigene Reaktion der/des Betrachtenden (für Aktiv-Markierung + Umschalten in der UI).
    const mine = viewerUserId ? reacts.find(r => r.user_id === viewerUserId) : null;
    return {
      ...post,
      author: prof ? { handle: prof.handle, display_name: prof.display_name, avatar_url: prof.avatar_url || null, verified: prof.verified, is_editorial: prof.is_editorial, account_type: prof.account_type, premium: foundationRepo.hasEntitlement(prof.user_id, 'premium'), is_following: !!(viewerUserId && prof.user_id !== viewerUserId && social.isFollowing(viewerUserId, prof.user_id)) } : null,
      comment_count: social.countComments(post.id),
      reaction_counts: counts,
      my_reaction: mine ? mine.type : null,
      is_question: post.kind === 'frage',
      answered: !!post.accepted_comment_id,
      // Umfrage: Optionen mit Auszählung + eigene Stimme für die UI.
      poll: (post.kind === 'poll' && Array.isArray(post.poll_options)) ? (() => {
        const tally = social.pollTally(post.id, viewerUserId);
        return { options: post.poll_options, counts: tally.counts, total: tally.total, my_vote: tally.my };
      })() : null,
      // Repost: das eingebettete Original mitdekorieren (oder als gelöscht markieren).
      repost_of_post: post.kind === 'repost' && post.repost_of ? (() => {
        const orig = social.getPost(post.repost_of);
        if (!orig || orig.deleted_at) return { deleted: true };
        return decorate(orig, viewerUserId);
      })() : null,
      // Repost-Traktion des zugrundeliegenden Originals (bei Reposts das Original, sonst der Post selbst).
      repost_count: social.countReposts(post.kind === 'repost' && post.repost_of ? post.repost_of : post.id),
      reposted_by_me: viewerUserId ? !!social.findUserRepost(viewerUserId, post.kind === 'repost' && post.repost_of ? post.repost_of : post.id) : false,
    };
  }

  return {
    // ── Profil ──
    createProfile(actorUserId, { handle, displayName, title, pharmacyOrgId, bio, specializations, avatarUrl, visibility, isEditorial, country, locale, accountType }) {
      requireUser(actorUserId);
      if (!handle || !/^[a-z0-9_]{3,30}$/i.test(handle)) throw new AppError('profile_handle_format', 'Handle: 3–30 Zeichen, nur a–z 0–9 _.');
      if (!displayName) throw new AppError('display_name_required', 'Anzeigename erforderlich.');
      const c = normalizeCountry(country);
      return social.createProfile({ userId: actorUserId, handle, displayName, title, pharmacyOrgId, bio, specializations, avatarUrl, visibility, isEditorial, country: c, locale: normalizeLocale(locale, c), accountType: normalizeAccountType(accountType) });
    },
    getProfile(handleOrUserId) {
      return social.getProfileByHandle(handleOrUserId) || social.getProfileByUserId(handleOrUserId);
    },
    // Eigenes Profil bearbeiten (Handle bleibt als Identität unveränderlich).
    updateProfile(actorUserId, { displayName, title, bio, specializations, experience, education, openTo, avatarUrl, coverUrl, website, publicEmail, phone, visibility, bundesland, country, locale, accountType }) {
      requireUser(actorUserId);
      const current = social.getProfileByUserId(actorUserId);
      if (!current) throw new Error('Profil nicht gefunden.');
      const patch = {};
      // Profilbild: leerer String entfernt es (null), data:image-URL wird validiert.
      if (avatarUrl !== undefined) patch.avatar_url = avatarUrl ? cleanImage(avatarUrl) : null;
      // Titelbild (Banner) wie bei LinkedIn/Facebook: gleiche geprüfte Bild-Pipeline.
      if (coverUrl !== undefined) patch.cover_url = coverUrl ? cleanImage(coverUrl) : null;
      // Website/Kontakt-Link (nur http(s), keine Skript-URLs).
      if (website !== undefined) patch.website = website ? cleanSourceUrl(website) : null;
      // Öffentliche Kontaktdaten (freiwillig, für alle sichtbar): Geschäfts-E-Mail + Telefon.
      if (publicEmail !== undefined) {
        const e = String(publicEmail).trim();
        if (e && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 120)) throw new AppError('public_email_invalid', 'Bitte eine gültige E-Mail-Adresse angeben.');
        patch.public_email = e || null;
      }
      if (phone !== undefined) {
        const raw = String(phone).trim();
        if (raw && !/^[0-9+()\/\s.\-]{4,40}$/.test(raw)) throw new AppError('phone_invalid', 'Telefonnummer enthält ungültige Zeichen.');
        patch.phone = raw || null;
      }
      if (displayName !== undefined) {
        const dn = String(displayName).trim();
        if (!dn) throw new AppError('display_name_required', 'Anzeigename erforderlich.');
        patch.display_name = dn;
      }
      if (title !== undefined) patch.title = String(title).trim() || null;
      if (bio !== undefined) {
        const b = String(bio).trim();
        if (b.length > 500) throw new AppError('bio_too_long', 'Bio zu lang (max 500 Zeichen).');
        patch.bio = b || null;
      }
      if (specializations !== undefined) {
        const list = (Array.isArray(specializations) ? specializations : String(specializations).split(','))
          .map(s => String(s).trim()).filter(Boolean).slice(0, 12);
        patch.specializations = list;
      }
      // Werdegang/Berufserfahrung (wie bei LinkedIn): Liste von Stationen. Rolle ist
      // Pflicht, Rest optional; leere Stationen werden verworfen, max. 20.
      if (experience !== undefined) {
        const arr = Array.isArray(experience) ? experience : [];
        patch.experience = arr.map(e => ({
          role: String(e && e.role || '').trim().slice(0, 120),
          org: String(e && e.org || '').trim().slice(0, 120),
          from: String(e && e.from || '').trim().slice(0, 10),
          to: String(e && e.to || '').trim().slice(0, 10),
          description: String(e && e.description || '').trim().slice(0, 300),
        })).filter(e => e.role).slice(0, 20);
      }
      // Aus- & Weiterbildung: Abschluss ist Pflicht, Institution/Jahr optional. Max. 20.
      if (education !== undefined) {
        const arr = Array.isArray(education) ? education : [];
        patch.education = arr.map(e => ({
          degree: String(e && e.degree || '').trim().slice(0, 120),
          school: String(e && e.school || '').trim().slice(0, 120),
          year: String(e && e.year || '').trim().slice(0, 10),
        })).filter(e => e.degree).slice(0, 20);
      }
      // „Offen für": nur bekannte Schlüssel, dedupliziert.
      if (openTo !== undefined) {
        const arr = Array.isArray(openTo) ? openTo : [];
        patch.open_to = [...new Set(arr.map(x => String(x)).filter(x => OPEN_TO_KEYS.includes(x)))];
      }
      if (visibility !== undefined) {
        if (!['network', 'public'].includes(visibility)) throw new Error('Ungueltige Profil-Sichtbarkeit.');
        patch.visibility = visibility;
      }
      if (bundesland !== undefined) {
        const bl = String(bundesland).trim();
        if (bl && !BUNDESLAENDER.includes(bl)) throw new Error('Ungültiges Bundesland.');
        patch.bundesland = bl || null;
      }
      // Land wechseln (Länder-Switch); Sprache folgt dem Land, außer explizit gesetzt.
      if (country !== undefined) {
        if (!isValidCountry(country)) throw new Error('Ungültiges Land.');
        patch.country = String(country).toUpperCase();
        // Ohne explizite Sprache folgt die UI-Sprache automatisch dem neuen Land.
        patch.locale = normalizeLocale(locale, patch.country);
      } else if (locale !== undefined) {
        patch.locale = normalizeLocale(locale, current.country);
      }
      if (accountType !== undefined) {
        if (!isValidAccountType(accountType)) throw new Error('Ungültiger Kontotyp.');
        patch.account_type = normalizeAccountType(accountType);
      }
      return social.updateProfile(actorUserId, patch);
    },
    // Profil-Detailseite: Profil + dessen sichtbare Beiträge + Zähler + Beziehung
    // zum Betrachter (folge ich? bin ich das selbst?).
    profilePage(viewerUserId, handleOrUserId) {
      requireUser(viewerUserId);
      const prof = social.getProfileByHandle(handleOrUserId) || social.getProfileByUserId(handleOrUserId);
      if (!prof) return null;
      const posts = social.listAllPosts()
        .filter(p => p.author_user_id === prof.user_id && visibleTo(p, viewerUserId))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(p => decorate(p, viewerUserId));
      // Reputation: wie oft eine Antwort dieser Person als beste markiert wurde.
      let best_answers = 0;
      for (const p of social.listAllPosts()) {
        if (!p.accepted_comment_id) continue;
        const c = social.getComment(p.accepted_comment_id);
        if (c && !c.deleted_at && c.author_user_id === prof.user_id) best_answers++;
      }
      const isSelf = viewerUserId === prof.user_id;
      // Profil-Besuch protokollieren (nicht bei sich selbst) — für „Wer hat mein Profil angesehen".
      if (!isSelf) social.recordProfileView(viewerUserId, prof.user_id);
      // Besucher:innen nur der/dem Profil-Eigentümer:in zeigen (Datenschutz): jüngste zuerst.
      let viewers = null, viewer_count = 0;
      if (isSelf) {
        const rows = social.listProfileViewers(prof.user_id);
        viewer_count = rows.length;
        viewers = rows.slice(0, 20).map(r => {
          const vp = social.getProfileByUserId(r.viewer_user_id);
          return vp ? { handle: vp.handle, display_name: vp.display_name, avatar_url: vp.avatar_url || null, title: vp.title || null, viewed_at: r.viewed_at } : null;
        }).filter(Boolean);
      }
      // Empfehlungen (öffentlicher Social Proof) mit Autor:innen-Info; entfernbar durch Autor:in oder Empfohlene:n.
      const recommendations = social.listRecommendationsForTarget(prof.user_id).map(r => {
        const ap = social.getProfileByUserId(r.author_user_id);
        return {
          id: r.id, body: r.body, created_at: r.created_at,
          author: ap ? { handle: ap.handle, display_name: ap.display_name, avatar_url: ap.avatar_url || null, title: ap.title || null } : null,
          can_remove: r.author_user_id === viewerUserId || isSelf,
        };
      });
      // Fachgebiet-Bestätigungen: Zähler je Fachgebiet + ob der/die Betrachter:in bestätigt hat.
      const endRows = social.listEndorsementsForTarget(prof.user_id);
      const endorsements = {};
      for (const s of (prof.specializations || [])) {
        const forS = endRows.filter(e => e.skill === s);
        endorsements[s] = { count: forS.length, mine: forS.some(e => e.endorser_user_id === viewerUserId) };
      }
      return {
        profile: { ...prof, premium: foundationRepo.hasEntitlement(prof.user_id, 'premium') },
        posts,
        follower_count: social.listFollowers(prof.user_id).length,
        following_count: social.listFollowing(prof.user_id).length,
        post_count: posts.length,
        best_answers,
        endorsements,
        recommendations,
        can_recommend: !isSelf,
        my_recommendation: isSelf ? null : (social.findRecommendation(viewerUserId, prof.user_id)?.body || null),
        viewers, viewer_count,
        is_following: social.isFollowing(viewerUserId, prof.user_id),
        is_self: isSelf,
        is_muted: !isSelf && social.isMuted(viewerUserId, prof.user_id),
        muted_count: isSelf ? social.listMuted(viewerUserId).length : undefined,
      };
    },
    // Fachgebiet bestätigen (Endorsement) — Umschalten; benachrichtigt bei neuer Bestätigung.
    endorseSkill(actorUserId, targetHandleOrId, skill) {
      requireUser(actorUserId);
      const prof = social.getProfileByHandle(targetHandleOrId) || social.getProfileByUserId(targetHandleOrId);
      if (!prof) throw new AppError('profile_not_found', 'Profil nicht gefunden.');
      if (prof.user_id === actorUserId) throw new AppError('endorse_self', 'Eigene Fachgebiete kann man nicht bestätigen.');
      const s = String(skill || '').trim();
      if (!s || !(prof.specializations || []).includes(s)) throw new AppError('endorse_skill_unknown', 'Dieses Fachgebiet gibt es im Profil nicht.');
      let mine;
      if (social.hasEndorsed(actorUserId, prof.user_id, s)) {
        social.removeEndorsement(actorUserId, prof.user_id, s); mine = false;
      } else {
        social.addEndorsement({ endorserUserId: actorUserId, targetUserId: prof.user_id, skill: s }); mine = true;
        social.createNotification({ userId: prof.user_id, type: 'endorsement', actorUserId, refType: 'skill', refId: s, label: s });
      }
      const count = social.listEndorsementsForTarget(prof.user_id).filter(e => e.skill === s).length;
      return { skill: s, count, mine };
    },
    // Empfehlung schreiben (ein:e Autor:in je Zielprofil — erneutes Schreiben aktualisiert).
    writeRecommendation(actorUserId, targetHandleOrId, body) {
      requireUser(actorUserId);
      const prof = social.getProfileByHandle(targetHandleOrId) || social.getProfileByUserId(targetHandleOrId);
      if (!prof) throw new AppError('profile_not_found', 'Profil nicht gefunden.');
      if (prof.user_id === actorUserId) throw new AppError('recommend_self', 'Man kann sich nicht selbst empfehlen.');
      const text = String(body ?? '').trim();
      if (!text) throw new AppError('recommend_empty', 'Empfehlung darf nicht leer sein.');
      if (text.length > 600) throw new AppError('recommend_too_long', 'Empfehlung zu lang (max. 600 Zeichen).');
      const existing = social.findRecommendation(actorUserId, prof.user_id);
      let row;
      if (existing) {
        social.deleteRecommendation(existing.id);
        row = social.createRecommendation({ authorUserId: actorUserId, targetUserId: prof.user_id, body: text });
      } else {
        row = social.createRecommendation({ authorUserId: actorUserId, targetUserId: prof.user_id, body: text });
        social.createNotification({ userId: prof.user_id, type: 'recommendation', actorUserId, refType: 'profile', refId: prof.handle });
      }
      return row;
    },
    // Empfehlung entfernen: erlaubt der/dem Autor:in ODER der/dem Empfohlenen (Kontrolle).
    removeRecommendation(actorUserId, recId) {
      requireUser(actorUserId);
      const r = social.getRecommendation(recId);
      if (!r) throw new AppError('recommend_not_found', 'Empfehlung nicht gefunden.');
      if (r.author_user_id !== actorUserId && r.target_user_id !== actorUserId) throw new ForbiddenError('Nicht berechtigt.');
      social.deleteRecommendation(recId);
      return { ok: true };
    },
    // Folge-Vorschläge: Profile, denen der Betrachter noch nicht folgt (aktivste zuerst).
    suggestFollows(viewerUserId, limit = 5) {
      requireUser(viewerUserId);
      const following = new Set(social.listFollowing(viewerUserId));
      return social.listProfiles()
        .filter(p => p.user_id !== viewerUserId && !following.has(p.user_id))
        .map(p => ({ handle: p.handle, display_name: p.display_name, verified: p.verified, is_editorial: p.is_editorial, title: p.title, specializations: p.specializations || [], follower_count: social.listFollowers(p.user_id).length }))
        .sort((a, b) => b.follower_count - a.follower_count)
        .slice(0, limit);
    },
    // Apotheken im selben Bundesland (für Umkreis-Vernetzung). Ohne eigenes
    // Bundesland: leere Liste. Nicht sich selbst, nicht bereits gefolgt zuerst egal.
    colleaguesInBundesland(viewerUserId, limit = 10) {
      requireUser(viewerUserId);
      const meProf = social.getProfileByUserId(viewerUserId);
      const bl = meProf && meProf.bundesland;
      if (!bl) return { bundesland: null, people: [] };
      const following = new Set(social.listFollowing(viewerUserId));
      const people = social.listProfiles()
        .filter(p => p.user_id !== viewerUserId && p.bundesland === bl)
        .map(p => ({
          handle: p.handle, display_name: p.display_name, verified: p.verified, is_editorial: p.is_editorial,
          title: p.title, specializations: p.specializations || [], bundesland: p.bundesland,
          is_following: following.has(p.user_id), follower_count: social.listFollowers(p.user_id).length,
        }))
        .sort((a, b) => Number(a.is_following) - Number(b.is_following) || b.follower_count - a.follower_count)
        .slice(0, limit);
      return { bundesland: bl, people };
    },
    // „Offen für"-Entdecken: Kolleg:innen, die für dasselbe offen sind (nicht man selbst).
    // Gefolgte zuerst als Trennung egal; sortiert nach Reichweite. Nach Land des Betrachters.
    discoverByOpenTo(viewerUserId, key, limit = 30) {
      requireUser(viewerUserId);
      if (!OPEN_TO_KEYS.includes(String(key))) throw new AppError('open_to_unknown', 'Unbekannte „Offen für"-Kategorie.');
      const meProf = social.getProfileByUserId(viewerUserId);
      const country = meProf && meProf.country;
      const following = new Set(social.listFollowing(viewerUserId));
      const people = social.listProfiles()
        .filter(p => p.user_id !== viewerUserId && Array.isArray(p.open_to) && p.open_to.includes(key) && (!country || p.country === country))
        .map(p => ({
          handle: p.handle, display_name: p.display_name, avatar_url: p.avatar_url || null,
          verified: p.verified, is_editorial: p.is_editorial, account_type: p.account_type,
          title: p.title, bundesland: p.bundesland, open_to: p.open_to || [],
          is_following: following.has(p.user_id), follower_count: social.listFollowers(p.user_id).length,
        }))
        .sort((a, b) => b.follower_count - a.follower_count)
        .slice(0, limit);
      return { key, people };
    },
    // „Offen für"-Übersicht: wie viele Kolleg:innen (im Land des Betrachters, ohne
    // sich selbst) je Kategorie offen sind — für den Entdecken-Einstieg.
    openToCounts(viewerUserId) {
      requireUser(viewerUserId);
      const meProf = social.getProfileByUserId(viewerUserId);
      const country = meProf && meProf.country;
      const counts = Object.fromEntries(OPEN_TO_KEYS.map(k => [k, 0]));
      for (const p of social.listProfiles()) {
        if (p.user_id === viewerUserId) continue;
        if (country && p.country !== country) continue;
        for (const k of (p.open_to || [])) if (k in counts) counts[k]++;
      }
      return { counts };
    },
    // Handle-Vorschläge für @-Autovervollständigung (Präfix zuerst, dann enthält).
    searchHandles(q, limit = 6) {
      const s = String(q ?? '').trim().toLowerCase();
      if (!s) return [];
      const all = social.listProfiles();
      const starts = all.filter(p => p.handle.startsWith(s));
      const contains = all.filter(p => !p.handle.startsWith(s) && (p.handle.includes(s) || String(p.display_name).toLowerCase().includes(s)));
      return [...starts, ...contains].slice(0, limit).map(p => ({ handle: p.handle, display_name: p.display_name, verified: p.verified }));
    },
    // Personen-Suche: Handle, Anzeigename oder Fachgebiet enthält q.
    searchProfiles(q) {
      const s = String(q ?? '').trim().toLowerCase();
      if (!s) return [];
      return social.listProfiles().filter(p =>
        p.handle.includes(s) ||
        String(p.display_name).toLowerCase().includes(s) ||
        (p.specializations || []).some(x => String(x).toLowerCase().includes(s))
      );
    },
    // Themen-Filter: sichtbare Beiträge mit dem Hashtag #tag (ganzes Tag, dekoriert).
    postsByHashtag(viewerUserId, tag) {
      requireUser(viewerUserId);
      const t = String(tag ?? '').trim().toLowerCase().replace(/^#/, '');
      if (!t) return [];
      const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp('(^|[^\\w#])#' + esc + '(?![\\wäöüß])', 'i');
      const muted = new Set(social.listMuted(viewerUserId));
      return social.listAllPosts()
        .filter(p => !muted.has(p.author_user_id) && visibleTo(p, viewerUserId) && re.test(p.body))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(p => decorate(p, viewerUserId));
    },
    // Aktuelle Themen: häufigste #Hashtags aus den letzten sichtbaren Beiträgen.
    trendingHashtags(viewerUserId, { limit = 8, lookback = 200 } = {}) {
      requireUser(viewerUserId);
      const counts = new Map();     // tagLower -> count
      const display = new Map();    // tagLower -> Original-Schreibweise (erste)
      const muted = new Set(social.listMuted(viewerUserId));
      const posts = social.listAllPosts()
        .filter(p => !muted.has(p.author_user_id) && visibleTo(p, viewerUserId))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, lookback);
      for (const p of posts) {
        const seen = new Set(); // ein Beitrag zählt je Hashtag nur einmal
        for (const m of String(p.body || '').matchAll(/(?:^|[^\wäöüß#])#([\wäöüß]{2,30})/gi)) {
          const raw = m[1]; const key = raw.toLowerCase();
          if (seen.has(key)) continue; seen.add(key);
          counts.set(key, (counts.get(key) || 0) + 1);
          if (!display.has(key)) display.set(key, raw);
        }
      }
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, limit)
        .map(([key, count]) => ({ tag: display.get(key), count }));
    },
    // Beitrags-Suche: sichtbare Beiträge, deren Text q enthält (dekoriert).
    searchPosts(viewerUserId, q) {
      requireUser(viewerUserId);
      const s = String(q ?? '').trim().toLowerCase();
      if (!s) return [];
      const muted = new Set(social.listMuted(viewerUserId));
      return social.listAllPosts()
        .filter(p => !muted.has(p.author_user_id) && visibleTo(p, viewerUserId) && String(p.body).toLowerCase().includes(s))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(p => decorate(p, viewerUserId));
    },

    // ── Posts ──
    createPost(actorUserId, { body, visibility = 'public', refType = null, refId = null, kind = 'post', image = null, sourceUrl = null, pollOptions = null }) {
      requireUser(actorUserId);
      const text = String(body ?? '').trim();
      const img = cleanImage(image);
      const src = cleanSourceUrl(sourceUrl);
      if (!['public', 'followers'].includes(visibility)) throw new Error('Ungueltige Sichtbarkeit.');
      if (!['post', 'news', 'frage', 'poll'].includes(kind)) throw new Error('Ungueltige Beitragsart.');
      // Umfrage: braucht 2–6 nicht-leere Optionen; die Frage steht im Text.
      let poll = null;
      if (kind === 'poll') {
        const opts = (Array.isArray(pollOptions) ? pollOptions : []).map(o => String(o ?? '').trim()).filter(Boolean).slice(0, 6);
        if (!text) throw new AppError('poll_question_missing', 'Umfrage: bitte eine Frage eingeben.');
        if (opts.length < 2) throw new AppError('poll_options_missing', 'Umfrage: mindestens zwei Antwortmöglichkeiten.');
        poll = opts.map((tx, i) => ({ id: 'o' + (i + 1), text: tx.slice(0, 80) }));
      } else if (!text && !img) {
        throw new AppError('post_empty', 'Beitrag darf nicht leer sein (Text oder Bild).');
      }
      if (text.length > MAX_BODY) throw new AppError('post_too_long', `Beitrag zu lang (max ${MAX_BODY}).`);
      if (refType && !['shortage', 'price', 'news', 'rabatt'].includes(refType)) throw new Error('Ungueltiger Referenztyp.');
      // Beitrag erbt das Land des Autors (Sichtbarkeits-Scope je Land).
      const country = normalizeCountry(social.getProfileByUserId(actorUserId)?.country);
      const post = social.createPost({ authorUserId: actorUserId, body: text, visibility, refType, refId, kind, image: img, sourceUrl: src, country, pollOptions: poll });
      notifyMentions(text, actorUserId, 'post', post.id);
      return post;
    },
    // Beitrag im eigenen Feed teilen (Repost). Optionaler Kommentar. Reposts werden
    // auf das Original „geflacht" (kein Repost-eines-Reposts), damit die Kette flach bleibt.
    repost(actorUserId, postId, { comment = '', visibility = 'public' } = {}) {
      requireUser(actorUserId);
      const orig = social.getPost(postId);
      if (!orig || orig.deleted_at) throw new AppError('post_not_found', 'Beitrag nicht gefunden.');
      if (!visibleTo(orig, actorUserId)) throw new AppError('post_not_found', 'Beitrag nicht gefunden.');
      const targetId = orig.kind === 'repost' && orig.repost_of ? orig.repost_of : orig.id;
      const target = social.getPost(targetId);
      if (!target || target.deleted_at) throw new AppError('post_not_found', 'Beitrag nicht gefunden.');
      // Umschalter: bereits geteilt -> Repost zurücknehmen (un-share).
      const existing = social.findUserRepost(actorUserId, targetId);
      if (existing) { social.softDeletePost(existing.id); return { reposted: false, post: null }; }
      const text = String(comment ?? '').trim();
      if (text.length > MAX_BODY) throw new AppError('post_too_long', `Beitrag zu lang (max ${MAX_BODY}).`);
      if (!['public', 'followers'].includes(visibility)) throw new Error('Ungueltige Sichtbarkeit.');
      const country = normalizeCountry(social.getProfileByUserId(actorUserId)?.country);
      const post = social.createPost({ authorUserId: actorUserId, body: text, visibility, kind: 'repost', country, repostOf: targetId });
      // Original-Autor:in benachrichtigen (nie sich selbst).
      notify(target.author_user_id, 'repost', actorUserId, 'post', targetId);
      if (text) notifyMentions(text, actorUserId, 'post', post.id);
      return { reposted: true, post };
    },
    // Umfrage-Stimme abgeben/ändern/zurückziehen (optionId=null zieht zurück).
    votePoll(actorUserId, postId, optionId) {
      requireUser(actorUserId);
      const p = social.getPost(postId);
      if (!p || p.deleted_at) throw new Error('Beitrag nicht gefunden.');
      if (p.kind !== 'poll' || !Array.isArray(p.poll_options)) throw new AppError('poll_not_a_poll', 'Dieser Beitrag ist keine Umfrage.');
      if (optionId != null && !p.poll_options.some(o => o.id === optionId)) throw new AppError('poll_bad_option', 'Unbekannte Antwortmöglichkeit.');
      const hadVote = social.pollTally(postId, actorUserId).my != null; // eigene Stimme vorher?
      social.setPollVote(postId, actorUserId, optionId);
      // Autor:in nur bei einer NEUEN Stimme benachrichtigen (nicht bei Wechsel/Rückzug) — hält es spamfrei.
      if (optionId != null && !hadVote) notify(p.author_user_id, 'poll_vote', actorUserId, 'post', postId);
      return { ok: true, poll: social.pollTally(postId, actorUserId) };
    },
    deletePost(actorUserId, postId) {
      const p = social.getPost(postId);
      if (!p) throw new Error('Beitrag nicht gefunden.');
      if (p.author_user_id !== actorUserId) throw new ForbiddenError('Nur der Autor darf loeschen.');
      return social.softDeletePost(postId);
    },
    editPost(actorUserId, postId, body) {
      const p = social.getPost(postId);
      if (!p || p.deleted_at) throw new Error('Beitrag nicht gefunden.');
      if (p.author_user_id !== actorUserId) throw new ForbiddenError('Nur der Autor darf bearbeiten.');
      const text = String(body ?? '').trim();
      if (!text) throw new AppError('post_empty', 'Beitrag darf nicht leer sein.');
      if (text.length > MAX_BODY) throw new AppError('post_too_long', `Beitrag zu lang (max ${MAX_BODY}).`);
      return decorate(social.updatePostBody(postId, text), actorUserId);
    },
    getPost(viewerUserId, postId) {
      const p = social.getPost(postId);
      if (!p || !visibleTo(p, viewerUserId)) return null;
      return decorate(p, viewerUserId);
    },

    // Beste Antwort einer Frage markieren/aufheben — nur der/die Fragesteller:in.
    // commentId muss ein Kommentar dieser Frage sein; erneut derselbe => Markierung aufheben.
    acceptAnswer(actorUserId, postId, commentId) {
      requireUser(actorUserId);
      const p = social.getPost(postId);
      if (!p || p.deleted_at) throw new Error('Beitrag nicht gefunden.');
      if (p.kind !== 'frage') throw new Error('Nur Fragen können eine beste Antwort haben.');
      if (p.author_user_id !== actorUserId) throw new ForbiddenError('Nur der/die Fragesteller:in darf die beste Antwort wählen.');
      let next = null;
      if (p.accepted_comment_id !== commentId) {
        const c = social.getComment(commentId);
        if (!c || c.deleted_at || c.post_id !== postId) throw new Error('Ungueltige Antwort.');
        next = commentId;
        if (c.author_user_id !== actorUserId) notify(c.author_user_id, 'answer_accepted', actorUserId, 'post', postId);
      }
      return decorate(social.setAcceptedAnswer(postId, next), actorUserId);
    },

    // ── Kommentare (Thread) ──
    comment(actorUserId, postId, { body, parentCommentId = null, image = null }) {
      requireUser(actorUserId);
      const p = social.getPost(postId);
      if (!p || !visibleTo(p, actorUserId)) throw new ForbiddenError('Beitrag nicht sichtbar.');
      if (parentCommentId) {
        const parent = social.getComment(parentCommentId);
        if (!parent || parent.post_id !== postId) throw new Error('Ungueltiger Eltern-Kommentar.');
      }
      const text = String(body ?? '').trim();
      const img = cleanImage(image);
      if (!text && !img) throw new AppError('comment_empty', 'Kommentar darf nicht leer sein (Text oder Bild).');
      const comment = social.createComment({ postId, parentCommentId, authorUserId: actorUserId, body: text, image: img });
      notify(p.author_user_id, 'comment', actorUserId, 'post', postId); // Beitrags-Autor
      if (parentCommentId) {
        const parent = social.getComment(parentCommentId);
        if (parent) notify(parent.author_user_id, 'comment', actorUserId, 'comment', parentCommentId);
      }
      notifyMentions(text, actorUserId, 'post', postId);
      return comment;
    },
    listComments(viewerUserId, postId) {
      const p = social.getPost(postId);
      if (!p || !visibleTo(p, viewerUserId)) throw new ForbiddenError('Beitrag nicht sichtbar.');
      const muted = new Set(social.listMuted(viewerUserId));
      return social.listComments(postId).filter(c => !muted.has(c.author_user_id)).map(c => {
        const prof = social.getProfileByUserId(c.author_user_id);
        const reacts = social.listReactions('comment', c.id);
        const counts = {};
        for (const t of REACTION_TYPES) counts[t] = reacts.filter(r => r.type === t).length;
        const mine = viewerUserId ? reacts.find(r => r.user_id === viewerUserId) : null;
        return { ...c, author: prof ? { handle: prof.handle, display_name: prof.display_name, avatar_url: prof.avatar_url || null, verified: prof.verified, is_editorial: prof.is_editorial, account_type: prof.account_type } : null, reaction_counts: counts, my_reaction: mine ? mine.type : null };
      });
    },
    editComment(actorUserId, commentId, body) {
      const c = social.getComment(commentId);
      if (!c || c.deleted_at) throw new Error('Kommentar nicht gefunden.');
      if (c.author_user_id !== actorUserId) throw new ForbiddenError('Nur der Autor darf bearbeiten.');
      const text = String(body ?? '').trim();
      if (!text) throw new AppError('comment_empty', 'Kommentar darf nicht leer sein (Text oder Bild).');
      if (text.length > MAX_BODY) throw new AppError('comment_too_long', `Kommentar zu lang (max ${MAX_BODY}).`);
      return social.updateCommentBody(commentId, text);
    },
    deleteComment(actorUserId, commentId) {
      const c = social.getComment(commentId);
      if (!c || c.deleted_at) throw new Error('Kommentar nicht gefunden.');
      if (c.author_user_id !== actorUserId) throw new ForbiddenError('Nur der Autor darf loeschen.');
      return social.softDeleteComment(commentId);
    },

    // ── Reaktionen (typisiert, kein reines Like) ──
    react(actorUserId, targetType, targetId, type) {
      requireUser(actorUserId);
      if (!REACTION_TYPES.includes(type)) throw new Error('Ungueltige Reaktionsart.');
      if (targetType === 'post') {
        const p = social.getPost(targetId);
        if (!p || !visibleTo(p, actorUserId)) throw new ForbiddenError('Ziel nicht sichtbar.');
      } else if (targetType === 'comment') {
        const c = social.getComment(targetId);
        if (!c) throw new Error('Kommentar nicht gefunden.');
        const p = social.getPost(c.post_id);
        if (!p || !visibleTo(p, actorUserId)) throw new ForbiddenError('Ziel nicht sichtbar.');
      } else throw new Error('Ungueltiger Zieltyp.');
      // Umschalten: dieselbe Reaktion erneut = entfernen (gibt null zurück).
      const existing = social.listReactions(targetType, targetId).find(r => r.user_id === actorUserId);
      if (existing && existing.type === type) {
        social.removeReaction({ userId: actorUserId, targetType, targetId });
        return null;
      }
      const reaction = social.setReaction({ userId: actorUserId, targetType, targetId, type });
      // Autor des Ziels benachrichtigen
      const target = targetType === 'post' ? social.getPost(targetId) : social.getComment(targetId);
      if (target) notify(target.author_user_id, 'reaction', actorUserId, targetType, targetId);
      return reaction;
    },
    unreact(actorUserId, targetType, targetId) {
      social.removeReaction({ userId: actorUserId, targetType, targetId });
    },

    // ── Follows (gerichtet, ohne Zustimmung) ──
    follow(actorUserId, followeeUserId) {
      requireUser(actorUserId); requireUser(followeeUserId);
      if (actorUserId === followeeUserId) throw new Error('Selbst-Follow nicht moeglich.');
      social.follow(actorUserId, followeeUserId);
      notify(followeeUserId, 'follow', actorUserId, 'user', actorUserId);
      return { follower: actorUserId, followee: followeeUserId };
    },
    unfollow(actorUserId, followeeUserId) { social.unfollow(actorUserId, followeeUserId); },
    following(userId) { return social.listFollowing(userId); },
    followers(userId) { return social.listFollowers(userId); },

    // ── Stummschalten: Beiträge einer Person aus den eigenen Feeds ausblenden ──
    mute(actorUserId, targetHandleOrId) {
      requireUser(actorUserId);
      const prof = social.getProfileByHandle(targetHandleOrId) || social.getProfileByUserId(targetHandleOrId);
      if (!prof) throw new AppError('profile_not_found', 'Profil nicht gefunden.', 404);
      if (prof.user_id === actorUserId) throw new AppError('mute_self', 'Selbst-Stummschalten nicht möglich.', 400);
      social.mute(actorUserId, prof.user_id);
      return { muted: true, handle: prof.handle };
    },
    unmute(actorUserId, targetHandleOrId) {
      requireUser(actorUserId);
      const prof = social.getProfileByHandle(targetHandleOrId) || social.getProfileByUserId(targetHandleOrId);
      if (!prof) throw new AppError('profile_not_found', 'Profil nicht gefunden.', 404);
      social.unmute(actorUserId, prof.user_id);
      return { muted: false, handle: prof.handle };
    },
    isMuted(actorUserId, targetUserId) { return social.isMuted(actorUserId, targetUserId); },
    // Stummgeschaltete als Profil-Kurzform (für die Verwaltung).
    listMuted(actorUserId) {
      requireUser(actorUserId);
      return social.listMuted(actorUserId).map(id => social.getProfileByUserId(id)).filter(Boolean)
        .map(p => ({ handle: p.handle, display_name: p.display_name, verified: p.verified, title: p.title }));
    },
    // Follower- bzw. Folge-Liste eines Profils als Profil-Kurzform (für die UI).
    // which: 'followers' (wer folgt) | 'following' (wem gefolgt wird).
    followList(viewerUserId, handleOrUserId, which) {
      requireUser(viewerUserId);
      const prof = social.getProfileByHandle(handleOrUserId) || social.getProfileByUserId(handleOrUserId);
      if (!prof) return null;
      const ids = which === 'followers' ? social.listFollowers(prof.user_id) : social.listFollowing(prof.user_id);
      const people = ids.map(id => social.getProfileByUserId(id)).filter(Boolean).map(p => ({
        handle: p.handle, display_name: p.display_name, verified: p.verified, is_editorial: p.is_editorial,
        title: p.title, specializations: p.specializations || [],
        is_following: social.isFollowing(viewerUserId, p.user_id), is_self: viewerUserId === p.user_id,
      }));
      return { handle: prof.handle, display_name: prof.display_name, which, people };
    },

    // ── Feeds ──
    // Home: Beiträge von gefolgten Personen + eigene, sichtbarkeitsgefiltert.
    homeFeed(viewerUserId) {
      requireUser(viewerUserId);
      const authors = new Set(social.listFollowing(viewerUserId));
      authors.add(viewerUserId);
      const muted = new Set(social.listMuted(viewerUserId));
      return social.listAllPosts()
        .filter(p => authors.has(p.author_user_id) && !muted.has(p.author_user_id) && visibleTo(p, viewerUserId))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(p => decorate(p, viewerUserId));
    },
    // News-Ansicht: Beiträge der Art 'news' (kuratiert von der Redaktion ODER von
    // Nutzern geteilt) — dasselbe Feed-System, nur gefiltert.
    newsFeed(viewerUserId, { country = null } = {}) {
      requireUser(viewerUserId);
      const c = country ? normalizeCountry(country) : null;
      const muted = new Set(social.listMuted(viewerUserId));
      return social.listAllPosts()
        .filter(p => p.kind === 'news' && !muted.has(p.author_user_id) && visibleTo(p, viewerUserId) && (!c || (p.country || 'AT') === c))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(p => decorate(p, viewerUserId));
    },

    // Beiträge, die ein externes Objekt referenzieren (z.B. einen Engpass),
    // sichtbarkeitsgefiltert + dekoriert. Basis fuer "X Apotheker haben dazu gepostet".
    postsAbout(viewerUserId, refType, refId) {
      requireUser(viewerUserId);
      return social.listPostsByRef(refType, refId)
        .filter(p => visibleTo(p, viewerUserId))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(p => decorate(p, viewerUserId));
    },

    // Entdecken: alle oeffentlichen Beiträge (netzwerkweite Reichweite).
    // sort: 'neu' (Standard, neueste zuerst) oder 'top' (meiste Reaktionen zuerst).
    // filter: 'questions' => nur Fachfragen, offene (unbeantwortete) zuerst.
    publicFeed(viewerUserId, { sort = 'neu', filter = 'all', country = null } = {}) {
      requireUser(viewerUserId);
      const c = country ? normalizeCountry(country) : null;
      const muted = new Set(social.listMuted(viewerUserId));
      let posts = social.listAllPosts().filter(p => p.visibility === 'public' && !muted.has(p.author_user_id) && (!c || (p.country || 'AT') === c)).map(p => decorate(p, viewerUserId));
      if (filter === 'questions') posts = posts.filter(p => p.is_question);
      const total = (p) => Object.values(p.reaction_counts || {}).reduce((s, n) => s + n, 0);
      const byRecency = (a, b) => b.created_at.localeCompare(a.created_at);
      const byTop = (a, b) => total(b) - total(a) || byRecency(a, b);
      const cmp = sort === 'top' ? byTop : byRecency;
      // Bei "questions": offene (unbeantwortete) Fragen zuerst, innerhalb nach cmp.
      if (filter === 'questions') posts.sort((a, b) => (Number(a.answered) - Number(b.answered)) || cmp(a, b));
      else posts.sort(cmp);
      return posts;
    },

    // ── Benachrichtigungen ──
    // Öffentliche Benachrichtigung (z.B. vom Austausch-Modul für Matching genutzt).
    pushNotification({ userId, type, actorUserId = null, refType = null, refId = null, label = null }) {
      if (!userId || userId === actorUserId) return null;
      return social.createNotification({ userId, type, actorUserId, refType, refId, label });
    },
    notifications(userId) {
      requireUser(userId);
      return social.listNotifications(userId).map(n => {
        const actor = n.actor_user_id ? social.getProfileByUserId(n.actor_user_id) : null;
        // Sprung-Ziel: bei Kommentar-Referenz den zugehörigen Beitrag auflösen.
        let post_id = null;
        if (n.ref_type === 'post') post_id = n.ref_id;
        else if (n.ref_type === 'comment') { const c = social.getComment(n.ref_id); post_id = c ? c.post_id : null; }
        return { ...n, actor: actor ? { handle: actor.handle, display_name: actor.display_name } : null, post_id };
      });
    },
    unreadCount(userId) { requireUser(userId); return social.unreadNotificationCount(userId); },
    markNotificationRead(userId, id) {
      const list = social.listNotifications(userId);
      if (!list.some(n => n.id === id)) throw new ForbiddenError('Fremde Benachrichtigung.');
      social.markNotificationRead(id);
    },
    markAllNotificationsRead(userId) { requireUser(userId); social.markAllNotificationsRead(userId); },

    // ── Direktnachrichten (1:1, privat, getrennt vom Feed) ──
    startDm(actorUserId, otherUserId) {
      requireUser(actorUserId); requireUser(otherUserId);
      if (actorUserId === otherUserId) throw new Error('Kein DM mit sich selbst.');
      return social.findDmThread(actorUserId, otherUserId) || social.createDmThread(actorUserId, otherUserId);
    },
    sendDm(actorUserId, threadId, body) {
      const t = social.getDmThread(threadId);
      if (!t) throw new Error('Thread nicht gefunden.');
      if (t.user_a_id !== actorUserId && t.user_b_id !== actorUserId) throw new ForbiddenError('Nicht Teil dieser Konversation.');
      const text = String(body ?? '').trim();
      if (!text) throw new AppError('message_empty', 'Leere Nachricht.');
      const msg = social.createDmMessage({ threadId, senderUserId: actorUserId, body: text });
      const recipient = t.user_a_id === actorUserId ? t.user_b_id : t.user_a_id;
      notify(recipient, 'dm', actorUserId, 'thread', threadId);
      return msg;
    },
    listDm(viewerUserId, threadId) {
      const t = social.getDmThread(threadId);
      if (!t) throw new Error('Thread nicht gefunden.');
      if (t.user_a_id !== viewerUserId && t.user_b_id !== viewerUserId) throw new ForbiddenError('Nicht Teil dieser Konversation.');
      return social.listDmMessages(threadId);
    },
    // Kurzprofil des Gesprächspartners in einem Thread.
    dmOther(viewerUserId, thread) {
      const otherId = thread.user_a_id === viewerUserId ? thread.user_b_id : thread.user_a_id;
      const prof = social.getProfileByUserId(otherId);
      return prof ? { handle: prof.handle, display_name: prof.display_name, verified: prof.verified, is_editorial: prof.is_editorial } : null;
    },
    // Posteingang: alle Konversationen mit letzter Nachricht + ungelesen-Zähler,
    // neueste zuerst.
    dmInbox(viewerUserId) {
      requireUser(viewerUserId);
      return social.listDmThreadsForUser(viewerUserId).map(t => {
        const msgs = social.listDmMessages(t.id);
        const last = msgs[msgs.length - 1] || null;
        const unread = msgs.filter(m => m.sender_user_id !== viewerUserId && !m.read_at).length;
        return { thread_id: t.id, other: this.dmOther(viewerUserId, t), last_message: last, unread, created_at: t.created_at };
      })
      .filter(x => x.last_message) // leere Threads (noch keine Nachricht) ausblenden
      .sort((a, b) => (b.last_message.created_at).localeCompare(a.last_message.created_at));
    },
    // Konversation öffnen: Nachrichten + Partner, markiert Eingang als gelesen.
    dmConversation(viewerUserId, threadId) {
      const t = social.getDmThread(threadId);
      if (!t) throw new Error('Thread nicht gefunden.');
      if (t.user_a_id !== viewerUserId && t.user_b_id !== viewerUserId) throw new ForbiddenError('Nicht Teil dieser Konversation.');
      social.markDmThreadRead(threadId, viewerUserId);
      return { thread_id: threadId, other: this.dmOther(viewerUserId, t), messages: social.listDmMessages(threadId) };
    },
    // Gesamtzahl ungelesener DM-Nachrichten (für ein Badge in der Kopfzeile).
    dmUnreadTotal(viewerUserId) {
      requireUser(viewerUserId);
      return social.listDmThreadsForUser(viewerUserId).reduce((sum, t) =>
        sum + social.listDmMessages(t.id).filter(m => m.sender_user_id !== viewerUserId && !m.read_at).length, 0);
    },

    // ── Melden / Moderation ──
    // Jede angemeldete Person kann melden.
    report(actorUserId, targetType, targetId, reason) {
      requireUser(actorUserId);
      if (!['post', 'comment', 'profile'].includes(targetType)) throw new Error('Ungueltiger Zieltyp.');
      return social.createReport({ reporterUserId: actorUserId, targetType, targetId, reason });
    },
    // Nur Moderatoren: Reports einsehen und aufloesen.
    listReports(moderatorUserId, status = null) {
      if (!isModerator(moderatorUserId)) throw new ForbiddenError('Nur Moderation.');
      return social.listReports(status);
    },
    resolveReport(moderatorUserId, reportId, { remove = false } = {}) {
      if (!isModerator(moderatorUserId)) throw new ForbiddenError('Nur Moderation.');
      const r = social.getReport(reportId);
      if (!r) throw new Error('Meldung nicht gefunden.');
      if (remove && r.target_type === 'post') social.softDeletePost(r.target_id);
      if (remove && r.target_type === 'comment') social.softDeleteComment(r.target_id);
      return social.updateReport(reportId, { status: remove ? 'entfernt' : 'geprueft' });
    },
    isModerator(userId) { return isModerator(userId); },
    // Moderations-Queue: Meldungen angereichert mit Beitrags-/Melder-Infos.
    moderationQueue(moderatorUserId, status = 'offen') {
      if (!isModerator(moderatorUserId)) throw new ForbiddenError('Nur Moderation.');
      return social.listReports(status).map(r => {
        const reporter = social.getProfileByUserId(r.reporter_user_id);
        const out = { ...r, reporter_handle: reporter ? reporter.handle : null };
        if (r.target_type === 'post') {
          const post = social.getPost(r.target_id);
          if (post) {
            const author = social.getProfileByUserId(post.author_user_id);
            out.post = { body: post.body, deleted: !!post.deleted_at, author_handle: author ? author.handle : null };
          }
        } else if (r.target_type === 'comment') {
          const c = social.getComment(r.target_id);
          if (c) {
            const author = social.getProfileByUserId(c.author_user_id);
            out.post = { body: c.body, deleted: !!c.deleted_at, author_handle: author ? author.handle : null, is_comment: true };
          }
        }
        return out;
      });
    },

    // ── Lesezeichen / Merken ──
    toggleBookmark(userId, postId) {
      requireUser(userId);
      const p = social.getPost(postId);
      if (!p || !visibleTo(p, userId)) throw new ForbiddenError('Beitrag nicht sichtbar.');
      if (social.isBookmarked(userId, postId)) { social.removeBookmark(userId, postId); return { bookmarked: false }; }
      social.addBookmark(userId, postId); return { bookmarked: true };
    },
    bookmarkIds(userId) { requireUser(userId); return social.listBookmarkPostIds(userId).filter(id => { const p = social.getPost(id); return p && visibleTo(p, userId); }); },
    listBookmarks(userId) {
      requireUser(userId);
      return social.listBookmarkPostIds(userId)
        .map(id => social.getPost(id))
        .filter(p => p && visibleTo(p, userId))
        .map(p => decorate(p, userId));
    },

    // ── Einkaufsliste (Bestell-Merkzettel): Artikel-Snapshots je Nutzer:in sammeln,
    // später als CSV/Ausdruck an den Großhandel geben. Preise sind Momentaufnahmen. ──
    addToCart(userId, item = {}) {
      requireUser(userId);
      const bez = String(item.bezeichnung ?? '').trim();
      if (!bez) throw new AppError('cart_name_required', 'Bezeichnung erforderlich.');
      const num = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v))) ? null : Number(v);
      let menge = Math.round(num(item.menge) || 1);
      if (!(menge >= 1)) menge = 1;
      if (menge > 100000) menge = 100000;
      const row = {
        user_id: userId,
        bezeichnung: bez.slice(0, 160),
        wirkstoff: item.wirkstoff ? String(item.wirkstoff).trim().slice(0, 160) : null,
        supplier: item.supplier ? String(item.supplier).trim().slice(0, 160) : null,
        aktionspreis: num(item.aktionspreis),
        listenpreis: num(item.listenpreis), // für die Ersparnis-Anzeige (Listen- vs. Aktionspreis)
        rabatt_pct: num(item.rabattPct),
        gueltig_bis: item.gueltigBis ? String(item.gueltigBis).trim().slice(0, 40) : null,
        source_kind: ['rabatt', 'price', 'shortage', 'exchange', 'manual'].includes(item.sourceKind) ? item.sourceKind : 'manual',
        menge,
        note: item.note ? String(item.note).trim().slice(0, 200) : null,
      };
      // Duplikate zusammenführen: dasselbe Angebot (Präparat + Wirkstoff + Lieferant +
      // Aktionspreis + Herkunft) erhöht die Menge einer vorhandenen Position statt eine
      // zweite Zeile anzulegen — sonst füllt Doppelklick die Liste mit Dubletten.
      const keyOf = (r) => [
        String(r.bezeichnung || '').trim().toLowerCase(),
        String(r.wirkstoff || '').trim().toLowerCase(),
        String(r.supplier || '').trim().toLowerCase(),
        r.aktionspreis == null ? '' : Number(r.aktionspreis),
        r.source_kind || 'manual',
      ].join('|');
      const key = keyOf(row);
      const existing = social.listCartItems(userId).find((r) => keyOf(r) === key);
      if (existing) {
        let m = Math.round((Number(existing.menge) || 0) + menge);
        if (m > 100000) m = 100000;
        const patch = { menge: m };
        // Fehlenden Listenpreis nachtragen, wenn die neue (identische) Position ihn mitbringt
        // — sonst bliebe die Ersparnis-Anzeige für die zusammengeführte Position leer.
        if (existing.listenpreis == null && row.listenpreis != null) patch.listenpreis = row.listenpreis;
        return social.updateCartItem(existing.id, patch);
      }
      return social.addCartItem(row);
    },
    cart(userId) {
      requireUser(userId);
      const items = social.listCartItems(userId);
      const total = items.reduce((s, i) => s + (Number(i.aktionspreis) || 0) * (Number(i.menge) || 0), 0);
      // Gesamtersparnis: nur wo ein Listenpreis über dem Aktionspreis vorliegt (Rabatt-Positionen).
      const savings = items.reduce((s, i) => {
        if (i.listenpreis == null || i.aktionspreis == null) return s; // ohne beide Preise keine Ersparnis
        const lp = Number(i.listenpreis), ap = Number(i.aktionspreis), m = Number(i.menge) || 0;
        return lp > ap ? s + (lp - ap) * m : s;
      }, 0);
      return { items, count: items.length, total_positions: items.reduce((s, i) => s + (Number(i.menge) || 0), 0), total_price: Math.round(total * 100) / 100, total_savings: Math.round(savings * 100) / 100 };
    },
    updateCartItem(userId, id, patch = {}) {
      requireUser(userId);
      const it = social.getCartItem(id);
      if (!it || it.user_id !== userId) throw new AppError('cart_item_not_found', 'Position nicht gefunden.');
      const clean = {};
      if (patch.menge !== undefined) {
        let m = Math.round(Number(patch.menge));
        if (!(m >= 1)) m = 1; if (m > 100000) m = 100000;
        clean.menge = m;
      }
      if (patch.note !== undefined) clean.note = patch.note ? String(patch.note).trim().slice(0, 200) : null;
      return social.updateCartItem(id, clean);
    },
    removeCartItem(userId, id) {
      requireUser(userId);
      const it = social.getCartItem(id);
      if (!it || it.user_id !== userId) throw new AppError('cart_item_not_found', 'Position nicht gefunden.');
      social.removeCartItem(id);
      return { ok: true };
    },
    clearCart(userId) { requireUser(userId); social.clearCart(userId); return { ok: true }; },

    // ── Bestell-Historie: Einkaufsliste als „bestellt" abschließen (Snapshot) und leeren ──
    checkoutCart(userId, { reference } = {}) {
      requireUser(userId);
      const summary = this.cart(userId);
      if (!summary.items.length) throw new AppError('cart_empty', 'Einkaufsliste ist leer.');
      // Positionen als eigenständigen Snapshot ablegen (ohne Cart-IDs/User-ID).
      const items = summary.items.map(i => ({
        bezeichnung: i.bezeichnung, wirkstoff: i.wirkstoff || null, supplier: i.supplier || null,
        aktionspreis: i.aktionspreis ?? null, listenpreis: i.listenpreis ?? null,
        rabatt_pct: i.rabatt_pct ?? null, gueltig_bis: i.gueltig_bis || null,
        source_kind: i.source_kind || 'manual', menge: i.menge, note: i.note || null,
      }));
      const order = social.addOrder({
        user_id: userId,
        reference: reference ? String(reference).trim().slice(0, 120) : null,
        items, positions: items.length,
        total_pieces: summary.total_positions, total_price: summary.total_price, total_savings: summary.total_savings,
      });
      social.clearCart(userId);
      return order;
    },
    listOrders(userId) { requireUser(userId); return social.listOrders(userId); },
    // Eine vergangene Bestellung erneut in die (aktuelle) Einkaufsliste übernehmen.
    reorder(userId, orderId) {
      requireUser(userId);
      const order = social.getOrder(orderId);
      if (!order || order.user_id !== userId) throw new AppError('order_not_found', 'Bestellung nicht gefunden.');
      for (const i of order.items || []) {
        this.addToCart(userId, {
          bezeichnung: i.bezeichnung, wirkstoff: i.wirkstoff, supplier: i.supplier,
          aktionspreis: i.aktionspreis, listenpreis: i.listenpreis, rabattPct: i.rabatt_pct,
          gueltigBis: i.gueltig_bis, sourceKind: i.source_kind, menge: i.menge, note: i.note,
        });
      }
      return this.cart(userId);
    },
    deleteOrder(userId, orderId) {
      requireUser(userId);
      const order = social.getOrder(orderId);
      if (!order || order.user_id !== userId) throw new AppError('order_not_found', 'Bestellung nicht gefunden.');
      social.removeOrder(orderId);
      return { ok: true };
    },

    // ── DSGVO: Datenexport (Recht auf Datenübertragbarkeit) ──
    exportData(userId) {
      requireUser(userId);
      const dms = social.listDmThreadsForUser(userId).map(t => {
        const other = social.getProfileByUserId(t.user_a_id === userId ? t.user_b_id : t.user_a_id);
        return { with: other ? other.handle : null, messages: social.listDmMessages(t.id) };
      });
      return {
        exported_at: new Date().toISOString(),
        profile: social.getProfileByUserId(userId),
        posts: social.listPostsByAuthor(userId),
        comments: social.listCommentsByAuthor(userId),
        bookmarks_post_ids: social.listBookmarkPostIds(userId),
        direct_messages: dms,
        verification: social.getVerification(userId),
      };
    },

    // ── Verifizierung (Apotheken-Nachweis) ──
    // Nutzer beantragt Verifizierung (z.B. mit Konzessionsnummer/Apotheke im Hinweis).
    requestVerification(actorUserId, { note } = {}) {
      requireUser(actorUserId);
      const prof = social.getProfileByUserId(actorUserId);
      if (!prof) throw new Error('Profil nicht gefunden.');
      if (prof.verified) throw new Error('Profil ist bereits verifiziert.');
      return social.upsertVerification({ userId: actorUserId, note: String(note ?? '').trim().slice(0, 300) || null });
    },
    // Eigenen Verifizierungsstatus lesen (für die UI).
    myVerification(userId) {
      requireUser(userId);
      const prof = social.getProfileByUserId(userId);
      if (prof && prof.verified) return { status: 'verifiziert' };
      const v = social.getVerification(userId);
      return v ? { status: v.status, note: v.note, created_at: v.created_at } : { status: 'keine' };
    },
    // Nur Moderation: offene Verifizierungs-Anträge mit Profilinfo.
    verificationQueue(moderatorUserId) {
      if (!isModerator(moderatorUserId)) throw new ForbiddenError('Nur Moderation.');
      return social.listVerifications('offen').map(v => {
        const prof = social.getProfileByUserId(v.user_id);
        return { ...v, handle: prof ? prof.handle : null, display_name: prof ? prof.display_name : null };
      });
    },
    // Nur Moderation: Antrag genehmigen (setzt verified) oder ablehnen.
    resolveVerification(moderatorUserId, userId, approve) {
      if (!isModerator(moderatorUserId)) throw new ForbiddenError('Nur Moderation.');
      if (!social.getVerification(userId)) throw new Error('Kein Antrag vorhanden.');
      if (approve) social.setProfileVerified(userId, true);
      const status = approve ? 'verifiziert' : 'abgelehnt';
      social.updateVerification(userId, { status, resolved_at: new Date().toISOString() });
      if (approve) this.pushNotification({ userId, type: 'verified', actorUserId: moderatorUserId });
      return { user_id: userId, status };
    },

    // ── DSGVO: endgueltiges Loeschen (Autor oder Moderation) ──
    // Soft-Delete verbirgt nur; hier wird der Inhalt tatsaechlich entfernt.
    hardDeletePost(actorUserId, postId) {
      const p = social.getPost(postId);
      if (!p) throw new Error('Beitrag nicht gefunden.');
      if (p.author_user_id !== actorUserId && !isModerator(actorUserId)) {
        throw new ForbiddenError('Nur Autor oder Moderation.');
      }
      // Im In-Memory-Store: als Soft-Delete markieren (Hard-Delete-Semantik kommt
      // mit dem Postgres-Repo; hier reicht die Nicht-Sichtbarkeit fuers Verhalten).
      return social.softDeletePost(postId);
    },
  };
}
