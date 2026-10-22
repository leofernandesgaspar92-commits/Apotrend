// Keine Knöpfe zu ruhenden Bereichen (data/features.js). Bis 10/2026 standen
// „Sources" und „I need this" auf JEDER Engpass-Karte, „Post an offer" und
// „As task" auf der Wirkstoff-Seite — Tauschbörse und Aufgaben ruhen, jeder
// Klick endete auf „Nicht gefunden". Der Browser-Audit tippt die Knöpfe an;
// dieser Test hält die Bedingungen im Code fest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEATURES } from '../src/data/features.js';

const app = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'app.js'), 'utf8');

test('Tauschbörse: Knöpfe nur, wenn der Bereich läuft UND das Land es erlaubt', () => {
  assert.match(app, /const tauschAn = \(\) => featureAn\('tauschboerse'\) && !featBlocked\('stock_exchange'\);/);
  assert.match(app, /\$\{tauschAn\(\)\?`<button class="ghost" data-exchange/, 'Engpass-Karte: Sources');
  assert.match(app, /&&tauschAn\(\)\)\?`<button class="ghost" data-seek/, 'Engpass-Karte: I need this');
  assert.match(app, /const canExchange = me && me\.account_type !== 'private' && tauschAn\(\);/, 'Wirkstoff-Seite');
  // Nirgends mehr nur die Länderprüfung als Bedingung für einen Tausch-Knopf.
  const nurLand = app.split('\n').filter((z) => /featBlocked\('stock_exchange'\)/.test(z) && !/const tauschAn/.test(z));
  assert.deepEqual(nurLand, [], 'Tausch-Knopf nur mit Länderprüfung');
});

test('Aufgaben, Forum, Patienten-Infokarten: Einstiege hängen am Bereich', () => {
  assert.match(app, /\$\{featureAn\('zusammenarbeit'\) \? `<button class="ghost small" data-wktask/);
  assert.match(app, /querySelector\('\[data-wktask\]'\)\?\.addEventListener/);
  assert.match(app, /featureAn\('social'\) \? `<button class="ghost small" data-forum>/);
  assert.match(app, /featureAn\('patienteninfo'\) \? `<button class="ghost small" data-pinfo>/);
});

test('Profil und Beiträge: Folgen, Stummschalten, Nachricht, Termine, Team, Hashtags nur bei laufendem Bereich', () => {
  assert.match(app, /\$\{featureAn\('termine'\)\?` <button class="ghost small" data-appts>/, 'Meine Videosprechstunden');
  assert.match(app, /\$\{featureAn\('direktnachrichten'\)\?`<button class="ghost small" data-dm>/, 'Nachricht');
  assert.match(app, /\$\{featureAn\('social'\)\?`<button class="\$\{d\.is_following\?'ghost ':''\}small" data-togglefollow>/, 'Folgen (Profil)');
  assert.match(app, /\$\{featureAn\('social'\)\?` <button class="ghost small" data-togglemute>/, 'Stummschalten');
  assert.match(app, /d\.profile&&d\.profile\.premium&&featureAn\('termine'\)\?` <button class="small" data-bookvc>/, 'Videosprechstunde buchen');
  assert.match(app, /if \(featureAn\('zusammenarbeit'\)\) \{\n      const tcard = el\(/, 'Team-Karte im eigenen Profil');
  assert.match(app, /\$\{mine\|\|!featureAn\('social'\)\?'':`<button class="\$\{a\.is_following/, 'Folgen (Beitragskarte)');
  assert.match(app, /featureAn\('social'\) \? `\$\{pre\}<span class="hashtag clickable" data-hashtag=/, 'Hashtag nur mit Bereich anklickbar');
});

test('Die geprüften Bereiche ruhen tatsächlich (sonst wäre der Test wertlos)', () => {
  const zustand = Object.fromEntries(FEATURES.map((f) => [f.id, f.zustand]));
  for (const id of ['tauschboerse', 'zusammenarbeit', 'social', 'patienteninfo']) assert.equal(zustand[id], 'ruht', id + ' ruht standardmäßig');
});
