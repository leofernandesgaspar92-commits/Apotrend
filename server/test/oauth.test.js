import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';
import crypto from 'node:crypto';
import { createOAuthService, buildProvidersFromEnv, FACEBOOK_GRAPH_VERSION } from '../src/services/oauth.js';

// Fake-Provider: liefert ein festes externes Profil (kein echtes Netz nötig).
function fakeProvider(profile) {
  return { exchange: async (_code, _redirect) => profile };
}

function setup(providers) {
  const repo = createMemoryRepo();
  const orgAuth = createOrgAuthService(repo);
  const socialRepo = createSocialRepo();
  const social = createSocialService(socialRepo, repo);
  const oauth = createOAuthService({ repo, social, providers });
  return { repo, orgAuth, social, socialRepo, oauth };
}

test('OAuth: neues Konto anlegen (Profil + Handle + Identität verknüpft)', async () => {
  const { oauth, repo, social } = setup({ google: fakeProvider({ providerUserId: 'g-1', email: 'neu@ex.com', name: 'Neu Nutzer' }) });
  const r = await oauth.loginOrRegister('google', 'code', 'https://app/cb', { country: 'DE' });
  assert.equal(r.created, true);
  const u = repo.getUserById(r.userId);
  assert.equal(u.email, 'neu@ex.com');
  const prof = social.getProfile(r.userId);
  assert.ok(prof && prof.handle, 'Profil mit Handle angelegt');
  assert.equal(prof.country, 'DE');
  assert.equal(repo.findUserIdByIdentity('google', 'g-1'), r.userId, 'Identität verknüpft');
});

test('OAuth: zweite Anmeldung mit gleicher Identität -> dasselbe Konto, kein neues', async () => {
  const { oauth } = setup({ google: fakeProvider({ providerUserId: 'g-2', email: 'a@ex.com', name: 'A' }) });
  const r1 = await oauth.loginOrRegister('google', 'c1');
  const r2 = await oauth.loginOrRegister('google', 'c2');
  assert.equal(r1.userId, r2.userId);
  assert.equal(r2.created, false);
});

test('OAuth: E-Mail trifft bestehendes Passwort-Konto -> verknüpfen statt neu anlegen', async () => {
  const { orgAuth, social, oauth } = setup({ google: fakeProvider({ providerUserId: 'g-3', email: 'anna@a.at', name: 'Anna' }) });
  const reg = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'Apo' }, owner: { name: 'Anna', email: 'anna@a.at', password: 'geheim123' } });
  social.createProfile(reg.user.id, { handle: 'anna', displayName: 'Anna' });
  const r = await oauth.loginOrRegister('google', 'code');
  assert.equal(r.userId, reg.user.id, 'an bestehendes Konto gekoppelt');
  assert.equal(r.created, false);
  assert.deepEqual(oauth.linkedIdentities(reg.user.id), [{ provider: 'google' }]);
});

test('OAuth: unbekannter/nicht konfigurierter Provider -> oauth_not_configured', async () => {
  const { oauth } = setup({});
  assert.equal(oauth.configuredProviders().length, 0);
  await assert.rejects(() => oauth.loginOrRegister('google', 'code'), e => e.code === 'oauth_not_configured');
});

test('OAuth: Adapter ohne providerUserId -> oauth_failed', async () => {
  const { oauth } = setup({ google: fakeProvider({ email: 'x@y.com' }) });
  await assert.rejects(() => oauth.loginOrRegister('google', 'code'), e => e.code === 'oauth_failed');
});

test('OAuth: unlink entfernt die Verknüpfung', async () => {
  const { oauth, repo } = setup({ google: fakeProvider({ providerUserId: 'g-9', email: 'z@z.com', name: 'Z' }) });
  const r = await oauth.loginOrRegister('google', 'code');
  assert.equal(oauth.linkedIdentities(r.userId).length, 1);
  const u = oauth.unlink(r.userId, 'google');
  assert.equal(u.removed, 1);
  assert.equal(repo.findUserIdByIdentity('google', 'g-9'), null);
});

test('Identitäten überstehen dump/load und werden bei Konto-Löschung entfernt', async () => {
  const { oauth, repo } = setup({ google: fakeProvider({ providerUserId: 'g-p', email: 'p@p.com', name: 'P' }) });
  const r = await oauth.loginOrRegister('google', 'code');
  const snap = repo.__dump();
  const fresh = createMemoryRepo();
  fresh.__load(snap);
  assert.equal(fresh.findUserIdByIdentity('google', 'g-p'), r.userId, 'nach load noch verknüpft');
  fresh.deleteUser(r.userId);
  assert.equal(fresh.findUserIdByIdentity('google', 'g-p'), null, 'nach Löschung weg');
});

test('buildProvidersFromEnv: nur mit vollständigen Zugangsdaten aktiv', () => {
  assert.deepEqual(Object.keys(buildProvidersFromEnv({})), [], 'ohne ENV keine Provider');
  const p = buildProvidersFromEnv({ OAUTH_GOOGLE_CLIENT_ID: 'id', OAUTH_GOOGLE_CLIENT_SECRET: 'secret' }, async () => ({}));
  assert.deepEqual(Object.keys(p), ['google']);
});

test('Google-Adapter: authorizeUrl enthält client_id, redirect_uri, scope, state', () => {
  const p = buildProvidersFromEnv({ OAUTH_GOOGLE_CLIENT_ID: 'my-id', OAUTH_GOOGLE_CLIENT_SECRET: 'sec' }, async () => ({}));
  const url = p.google.authorizeUrl('https://app/cb', 'st8');
  assert.ok(url.startsWith('https://accounts.google.com/o/oauth2/v2/auth?'));
  const q = new URL(url).searchParams;
  assert.equal(q.get('client_id'), 'my-id');
  assert.equal(q.get('redirect_uri'), 'https://app/cb');
  assert.equal(q.get('response_type'), 'code');
  assert.match(q.get('scope'), /email/);
  assert.equal(q.get('state'), 'st8');
});

test('Google-Adapter: tauscht Code gegen Profil (Netz gemockt)', async () => {
  // fetch mocken: Token-Endpoint -> access_token, Userinfo -> sub/email/name
  const calls = [];
  const fetchMock = async (url, opts) => {
    calls.push(url);
    if (url.includes('/token')) return { json: async () => ({ access_token: 'AT123' }) };
    if (url.includes('userinfo')) return { json: async () => ({ sub: 'sub-1', email: 'g@ex.com', name: 'G User', email_verified: true }) };
    return { json: async () => ({}) };
  };
  const p = buildProvidersFromEnv({ OAUTH_GOOGLE_CLIENT_ID: 'id', OAUTH_GOOGLE_CLIENT_SECRET: 'sec' }, fetchMock);
  const ext = await p.google.exchange('the-code', 'https://app/cb');
  assert.deepEqual(ext, { providerUserId: 'sub-1', email: 'g@ex.com', name: 'G User', emailVerified: true });
  assert.equal(calls.length, 2, 'Token- + Userinfo-Endpoint aufgerufen');
});

// ── Facebook + bestätigte E-Mail (10/2026) ───────────────────────────────────
test('Unbestätigte E-Mail (Facebook): nie an ein bestehendes Konto koppeln, Adresse nicht belegen', async () => {
  const { orgAuth, social, oauth } = setup({ facebook: fakeProvider({ providerUserId: 'fb-1', email: 'anna@a.at', name: 'Angreifer', emailVerified: false }) });
  const reg = orgAuth.registerPharmacyWithOwner({ pharmacy: { name: 'Apo' }, owner: { name: 'Anna', email: 'anna@a.at', password: 'geheim123' } });
  social.createProfile(reg.user.id, { handle: 'anna', displayName: 'Anna' });
  await assert.rejects(() => oauth.loginOrRegister('facebook', 'c'), (e) => e.code === 'oauth_email_exists' && e.status === 409);
  assert.deepEqual(oauth.linkedIdentities(reg.user.id), [], 'keine Übernahme');
  // Neue Adresse, unbestätigt: Konto ja, aber die Adresse bleibt frei für ihre echte Besitzerin.
  const { oauth: o2, repo: r2 } = setup({ facebook: fakeProvider({ providerUserId: 'fb-2', email: 'frei@x.sn', name: 'Awa', emailVerified: false }) });
  const r = await o2.loginOrRegister('facebook', 'c');
  assert.equal(r2.getUserById(r.userId).email, 'facebook_fb-2@oauth.local');
  assert.equal(r2.getUserByEmail('frei@x.sn'), null);
});

test('Facebook-Adapter: nur mit App-ID + Secret; Dialog-Adresse; Tausch mit appsecret_proof (Netz gemockt)', async () => {
  assert.deepEqual(Object.keys(buildProvidersFromEnv({ OAUTH_FACEBOOK_APP_ID: 'x' })), [], 'ohne Secret aus');
  const calls = [];
  const fetchMock = async (url) => {
    calls.push(new URL(url));
    if (url.includes('/oauth/access_token')) return { json: async () => ({ access_token: 'FBTOKEN' }) };
    if (url.includes('/me?')) return { json: async () => ({ id: '1234', name: 'Awa Diop', email: 'awa@x.sn' }) };
    return { json: async () => ({}) };
  };
  const p = buildProvidersFromEnv({ OAUTH_FACEBOOK_APP_ID: 'app-1', OAUTH_FACEBOOK_APP_SECRET: 'fb-geheim' }, fetchMock);
  assert.deepEqual(Object.keys(p), ['facebook']);
  const u = new URL(p.facebook.authorizeUrl('https://app/', 'facebook'));
  assert.equal(u.origin + u.pathname, `https://www.facebook.com/${FACEBOOK_GRAPH_VERSION}/dialog/oauth`);
  assert.equal(u.searchParams.get('client_id'), 'app-1');
  assert.equal(u.searchParams.get('state'), 'facebook');
  assert.match(u.searchParams.get('scope'), /email/);
  assert.equal(u.searchParams.get('client_secret'), null, 'Secret nie im Browser-Link');
  const ext = await p.facebook.exchange('der-code', 'https://app/');
  assert.deepEqual(ext, { providerUserId: '1234', email: 'awa@x.sn', name: 'Awa Diop', emailVerified: false });
  assert.equal(calls[0].hostname, 'graph.facebook.com');
  assert.equal(calls[0].searchParams.get('code'), 'der-code');
  assert.equal(calls[1].searchParams.get('appsecret_proof'), crypto.createHmac('sha256', 'fb-geheim').update('FBTOKEN').digest('hex'));
  assert.equal(calls[1].searchParams.get('client_secret'), null);
  // Kaputte Antwort → null (wird zu oauth_failed), Unsinn als Version → Standard.
  const leer = buildProvidersFromEnv({ OAUTH_FACEBOOK_APP_ID: 'a', OAUTH_FACEBOOK_APP_SECRET: 'b', OAUTH_FACEBOOK_GRAPH_VERSION: '../evil' }, async () => ({ json: async () => ({ error: {} }) }));
  assert.equal(await leer.facebook.exchange('c', 'r'), null);
  assert.ok(leer.facebook.authorizeUrl('r').includes(`/${FACEBOOK_GRAPH_VERSION}/`));
});

test('Google: email_verified fehlt oder false → unbestätigt', async () => {
  const mock = (info) => async (url) => ({ json: async () => (url.includes('/token') ? { access_token: 'A' } : info) });
  const nein = buildProvidersFromEnv({ OAUTH_GOOGLE_CLIENT_ID: 'i', OAUTH_GOOGLE_CLIENT_SECRET: 's' }, mock({ sub: '1', email: 'a@b.c', email_verified: false }));
  assert.equal((await nein.google.exchange('c', 'r')).emailVerified, false);
  const fehlt = buildProvidersFromEnv({ OAUTH_GOOGLE_CLIENT_ID: 'i', OAUTH_GOOGLE_CLIENT_SECRET: 's' }, mock({ sub: '1', email: 'a@b.c' }));
  assert.equal((await fehlt.google.exchange('c', 'r')).emailVerified, false);
});

test('Oberfläche: gescheiterte Anbieter-Anmeldung wird erklärt, nicht verschluckt', async () => {
  const { readFileSync } = await import('node:fs');
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const cb = app.slice(app.indexOf('async function handleOAuthCallback('), app.indexOf('let oauthFehler = null;'));
  assert.match(cb, /catch \(e\) \{[\s\S]*oauthFehler = e\.message;/);
  const auth = app.slice(app.indexOf('function authScreen('), app.indexOf('async function handleOAuthCallback('));
  assert.match(auth, /if \(oauthFehler\) \{ document\.getElementById\('li_err'\)\.textContent = oauthFehler;/);
});
