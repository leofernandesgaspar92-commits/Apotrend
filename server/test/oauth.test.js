import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRepo } from '../src/repo/memoryRepo.js';
import { createSocialRepo } from '../src/repo/socialRepo.js';
import { createOrgAuthService } from '../src/services/orgAuth.js';
import { createSocialService } from '../src/services/social.js';
import { createOAuthService, buildProvidersFromEnv } from '../src/services/oauth.js';

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
    if (url.includes('userinfo')) return { json: async () => ({ sub: 'sub-1', email: 'g@ex.com', name: 'G User' }) };
    return { json: async () => ({}) };
  };
  const p = buildProvidersFromEnv({ OAUTH_GOOGLE_CLIENT_ID: 'id', OAUTH_GOOGLE_CLIENT_SECRET: 'sec' }, fetchMock);
  const ext = await p.google.exchange('the-code', 'https://app/cb');
  assert.deepEqual(ext, { providerUserId: 'sub-1', email: 'g@ex.com', name: 'G User' });
  assert.equal(calls.length, 2, 'Token- + Userinfo-Endpoint aufgerufen');
});
