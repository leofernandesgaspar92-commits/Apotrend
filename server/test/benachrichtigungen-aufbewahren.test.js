// Benachrichtigungen wachsen nicht unbegrenzt, und das Abrufen hängt nicht von der Gesamtzahl ab.
// Bis 10/2026: nie gelöscht, jede Abfrage durchsuchte die Benachrichtigungen ALLER Konten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSocialRepo, MAX_BENACHRICHTIGUNGEN, BENACHRICHTIGUNG_TAGE } from '../src/repo/socialRepo.js';

const neu = (repo, userId, label) => repo.createNotification({ userId, type: 'watch_alert', actorUserId: 'x', refType: 'shortage', refId: 's', label });

test('Je Konto höchstens MAX_BENACHRICHTIGUNGEN — zuerst fallen gelesene, dann die ältesten', () => {
  const repo = createSocialRepo();
  const erste = neu(repo, 'ama', 'wichtig-ungelesen');
  for (let i = 0; i < 50; i++) neu(repo, 'ama', 'alt ' + i);
  repo.markAllNotificationsRead('ama');
  // erste wieder ungelesen machen: Sie soll die gelesenen überleben.
  repo.__load({ ...repo.__dump(), notifications: repo.__dump().notifications.map(([k, v]) => [k, v.id === erste.id ? { ...v, read: false } : v]) });
  for (let i = 0; i < MAX_BENACHRICHTIGUNGEN - 1; i++) neu(repo, 'ama', 'neu ' + i); // 1 + 199 = 200, die 50 gelesenen fallen
  const liste = repo.listNotifications('ama');
  assert.equal(liste.length, MAX_BENACHRICHTIGUNGEN);
  assert.ok(liste.some((n) => n.id === erste.id), 'ungelesene vor gelesenen gelöscht');
  assert.ok(!liste.some((n) => /^alt /.test(n.label)), 'gelesene nicht zuerst gelöscht');
  // Noch mehr: dann fallen auch ungelesene, die ältesten zuerst.
  for (let i = 0; i < 5; i++) neu(repo, 'ama', 'neuer ' + i);
  const l2 = repo.listNotifications('ama');
  assert.equal(l2.length, MAX_BENACHRICHTIGUNGEN);
  assert.ok(!l2.some((n) => n.id === erste.id));
  assert.equal(l2[0].label, 'neuer 4', 'neueste zuerst');
  // Andere Konten unberührt.
  neu(repo, 'kofi', 'k1');
  assert.equal(repo.listNotifications('kofi').length, 1);
  assert.equal(repo.unreadNotificationCount('kofi'), 1);
});

test('Gelesene älter als BENACHRICHTIGUNG_TAGE fallen weg, ungelesene bleiben; Laden baut alles neu auf', () => {
  const repo = createSocialRepo();
  neu(repo, 'ama', 'a'); neu(repo, 'ama', 'b'); neu(repo, 'kofi', 'c');
  repo.markNotificationRead(repo.listNotifications('ama').find((n) => n.label === 'a').id);
  const alt = new Date(Date.now() - (BENACHRICHTIGUNG_TAGE + 1) * 86400000).toISOString();
  const snap = repo.__dump();
  snap.notifications = snap.notifications.map(([k, v]) => [k, { ...v, created_at: alt }]);
  const b = createSocialRepo();
  b.__load(JSON.parse(JSON.stringify(snap)));
  assert.deepEqual(b.listNotifications('ama').map((n) => n.label), ['b'], 'alte gelesene geblieben oder ungelesene gelöscht');
  assert.equal(b.listNotifications('kofi').length, 1);
  assert.equal(b.unreadNotificationCount('ama'), 1);
  assert.equal(b.clearReadNotifications('ama'), 0);
  b.markAllNotificationsRead('ama');
  assert.equal(b.clearReadNotifications('ama'), 1);
  assert.equal(b.listNotifications('ama').length, 0);
  assert.equal(b.__dump().notifications.length, 1, 'gelöschte im Speicherabbild geblieben');
});

test('Abruf je Konto hängt nicht von den Benachrichtigungen anderer ab', () => {
  const repo = createSocialRepo();
  for (let u = 0; u < 2000; u++) for (let i = 0; i < 50; i++) neu(repo, 'u' + u, 'n');
  neu(repo, 'ama', 'meine');
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 200; i++) { repo.listNotifications('ama'); repo.unreadNotificationCount('ama'); }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  // Vorher: 200 × Durchlauf über 100 000 Einträge ≈ Sekunden. Jetzt: nur die eigenen.
  assert.ok(ms < 150, `200 Abrufe dauerten ${ms.toFixed(0)} ms`);
  assert.equal(repo.listNotifications('ama').length, 1);
});
