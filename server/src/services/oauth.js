// Social-Login (OAuth) — provider-AGNOSTISCHER Kern. Die eigentliche Provider-
// Kommunikation (Code -> Profil) steckt hinter einem Adapter, der NUR registriert
// wird, wenn Zugangsdaten (Client-ID/Secret) als Umgebungsvariablen vorliegen.
// Ohne konfigurierten Provider ist der Flow inaktiv (leere Provider-Liste), aber
// der Verknüpfungs-Kern ist vollständig testbar (mit einem Fake-Adapter).
//
// Adapter-Vertrag:  async exchange(code, redirectUri) -> { providerUserId, email?, name?, emailVerified? }
//   emailVerified:false = der Anbieter bestätigt die Adresse nicht (Facebook). Dann wird
//   NIE über die E-Mail an ein bestehendes Konto gekoppelt und die Adresse nicht für ein
//   neues Konto belegt — sonst könnte, wer eine fremde Adresse unbestätigt bei einem
//   Anbieter einträgt, das ApoPulse-Konto dahinter übernehmen.
import crypto from 'node:crypto';
import { hashPassword } from '../domain/password.js';

// Aus einem Anzeigenamen einen gültigen, freien Handle ableiten (3–30, a-z0-9_).
function uniqueHandle(social, name) {
  let base = String(name || 'nutzer').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
  if (base.length < 3) base = 'user_' + base;
  let handle = base;
  for (let i = 0; i < 50 && social.getProfile(handle); i++) {
    handle = (base + '_' + crypto.randomBytes(2).toString('hex')).slice(0, 30);
  }
  return handle;
}

export function createOAuthService({ repo, social, providers = {} }) {
  return {
    // Namen der aktuell konfigurierten Provider (leer, wenn keine Zugangsdaten gesetzt).
    configuredProviders() { return Object.keys(providers); },
    isConfigured(provider) { return !!providers[provider]; },

    // Externe Identität -> Konto: verknüpfen (falls bekannt), sonst an bestehende
    // E-Mail koppeln, sonst neues Konto anlegen. Liefert { userId, created }.
    async loginOrRegister(provider, code, redirectUri, { country, locale } = {}) {
      const adapter = providers[provider];
      if (!adapter) { const e = new Error('Anmelde-Anbieter ist nicht konfiguriert.'); e.code = 'oauth_not_configured'; e.status = 400; throw e; }
      const ext = await adapter.exchange(code, redirectUri);
      if (!ext || !ext.providerUserId) { const e = new Error('Anmeldung über den Anbieter fehlgeschlagen.'); e.code = 'oauth_failed'; e.status = 400; throw e; }

      // 1) Identität bereits verknüpft -> direkt anmelden.
      let userId = repo.findUserIdByIdentity(provider, ext.providerUserId);
      if (userId && repo.getUserById(userId)) return { userId, created: false };

      // 2) E-Mail trifft ein bestehendes Konto -> Identität an dieses koppeln — nur mit
      //    vom Anbieter bestätigter Adresse. Unbestätigt: lieber mit Passwort anmelden lassen.
      const bestaetigt = !!ext.email && ext.emailVerified !== false;
      if (ext.email) {
        const existing = repo.getUserByEmail(ext.email);
        if (existing && bestaetigt) { repo.linkIdentity(provider, ext.providerUserId, existing.id); return { userId: existing.id, created: false }; }
        if (existing) { const e = new Error('Mit dieser E-Mail gibt es schon ein Konto. Bitte mit E-Mail und Passwort anmelden.'); e.code = 'oauth_email_exists'; e.status = 409; throw e; }
      }

      // 3) Neues Konto anlegen (zufälliges Passwort — Login läuft über den Anbieter
      //    oder später über „Passwort vergessen"/Wiederherstellungscodes).
      const name = ext.name || (ext.email ? ext.email.split('@')[0] : 'Nutzer');
      const email = bestaetigt ? ext.email : `${provider}_${ext.providerUserId}@oauth.local`;
      const user = repo.createUser({ email, name, passwordHash: hashPassword(crypto.randomBytes(24).toString('hex')) });
      social.createProfile(user.id, { handle: uniqueHandle(social, name), displayName: name, country, locale });
      repo.linkIdentity(provider, ext.providerUserId, user.id);
      return { userId: user.id, created: true };
    },

    // Authorize-URL des Providers (Weiterleitungsziel für den „Anmelden mit …"-Button).
    // Wirft, wenn der Provider nicht konfiguriert ist.
    authorizeUrl(provider, redirectUri, state) {
      const adapter = providers[provider];
      if (!adapter || typeof adapter.authorizeUrl !== 'function') { const e = new Error('Anmelde-Anbieter ist nicht konfiguriert.'); e.code = 'oauth_not_configured'; e.status = 400; throw e; }
      return adapter.authorizeUrl(redirectUri, state);
    },

    // Verknüpfte Anbieter eines Kontos (für die Konto-Einstellungen).
    linkedIdentities(userId) { return repo.listIdentities(userId).map(i => ({ provider: i.provider })); },
    unlink(userId, provider) {
      const ids = repo.listIdentities(userId).filter(i => i.provider === provider);
      for (const i of ids) repo.unlinkIdentity(i.provider, i.provider_user_id);
      return { ok: true, removed: ids.length };
    },
  };
}

// Adapter-Registry aus Umgebungsvariablen bauen. Nur Provider mit vollständigen
// Zugangsdaten werden aktiviert. Der Google-Adapter ist als Beispiel implementiert;
// die Netz-Kommunikation ist über `fetchImpl` injizierbar (testbar/ohne echtes Netz).
export function buildProvidersFromEnv(env = process.env, fetchImpl = globalThis.fetch) {
  const providers = {};
  if (env.OAUTH_GOOGLE_CLIENT_ID && env.OAUTH_GOOGLE_CLIENT_SECRET) {
    providers.google = createGoogleAdapter({
      clientId: env.OAUTH_GOOGLE_CLIENT_ID,
      clientSecret: env.OAUTH_GOOGLE_CLIENT_SECRET,
      fetchImpl,
    });
  }
  if (env.OAUTH_FACEBOOK_APP_ID && env.OAUTH_FACEBOOK_APP_SECRET) {
    providers.facebook = createFacebookAdapter({
      appId: env.OAUTH_FACEBOOK_APP_ID,
      appSecret: env.OAUTH_FACEBOOK_APP_SECRET,
      version: env.OAUTH_FACEBOOK_GRAPH_VERSION || undefined,
      fetchImpl,
    });
  }
  return providers;
}

// Google-OAuth-Adapter: tauscht den Authorization-Code gegen ein ID-Token/Profil.
// Nur aktiv, wenn Client-ID/Secret gesetzt sind. Reine Built-ins + fetch.
export function createGoogleAdapter({ clientId, clientSecret, fetchImpl = globalThis.fetch }) {
  return {
    name: 'google',
    // Ziel für den „Mit Google anmelden"-Button (OpenID-Connect authorize endpoint).
    authorizeUrl(redirectUri, state) {
      const q = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri || '', response_type: 'code', scope: 'openid email profile', access_type: 'online' });
      if (state) q.set('state', state);
      return 'https://accounts.google.com/o/oauth2/v2/auth?' + q.toString();
    },
    async exchange(code, redirectUri) {
      const body = new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri || '', grant_type: 'authorization_code' });
      const tokenRes = await fetchImpl('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
      const tok = await tokenRes.json();
      if (!tok || !tok.access_token) return null;
      const infoRes = await fetchImpl('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: 'Bearer ' + tok.access_token } });
      const info = await infoRes.json();
      if (!info || !info.sub) return null;
      return { providerUserId: info.sub, email: info.email || null, name: info.name || null, emailVerified: info.email_verified === true || info.email_verified === 'true' };
    },
  };
}

// Facebook-Login (Graph API). In Afrika für viele das bekannteste Konto — ein Tipp statt
// Formular. Nur aktiv mit OAUTH_FACEBOOK_APP_ID/OAUTH_FACEBOOK_APP_SECRET. Facebook sagt
// nicht zuverlässig, ob die E-Mail bestätigt ist → emailVerified:false (siehe oben).
// appsecret_proof: Facebook nimmt das Zugriffstoken dann nur zusammen mit unserem Secret an.
export const FACEBOOK_GRAPH_VERSION = 'v23.0';
export function createFacebookAdapter({ appId, appSecret, version = FACEBOOK_GRAPH_VERSION, fetchImpl = globalThis.fetch }) {
  const v = /^v\d{1,2}\.\d$/.test(String(version)) ? version : FACEBOOK_GRAPH_VERSION;
  return {
    name: 'facebook',
    authorizeUrl(redirectUri, state) {
      const q = new URLSearchParams({ client_id: appId, redirect_uri: redirectUri || '', response_type: 'code', scope: 'public_profile,email' });
      if (state) q.set('state', state);
      return `https://www.facebook.com/${v}/dialog/oauth?` + q.toString();
    },
    async exchange(code, redirectUri) {
      const q = new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: redirectUri || '', code: String(code || '') });
      const tokenRes = await fetchImpl(`https://graph.facebook.com/${v}/oauth/access_token?` + q.toString());
      const tok = await tokenRes.json();
      if (!tok || !tok.access_token) return null;
      const proof = crypto.createHmac('sha256', appSecret).update(tok.access_token).digest('hex');
      const me = new URLSearchParams({ fields: 'id,name,email', access_token: tok.access_token, appsecret_proof: proof });
      const infoRes = await fetchImpl(`https://graph.facebook.com/${v}/me?` + me.toString());
      const info = await infoRes.json();
      if (!info || !info.id) return null;
      return { providerUserId: String(info.id), email: info.email || null, name: info.name || null, emailVerified: false };
    },
  };
}
