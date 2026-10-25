// Store-Texte (android/store-listing.md) gegen die Play-Grenzen — alle fünf Sprachen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pruefe, grenzeFuer, GRENZEN } from '../tools/check-store-listing.mjs';

const md = readFileSync(new URL('../../android/store-listing.md', import.meta.url), 'utf8');

test('Jede Sprache bekommt ihre eigene Grenze — auch Französisch und Arabisch', () => {
  for (const b of ['Title', 'Titel', 'Título', 'Titre', 'العنوان']) assert.equal(grenzeFuer(b).max, GRENZEN.titel, b);
  for (const b of ['Short description', 'Kurzbeschreibung', 'Descrição breve', 'Description courte', 'الوصف المختصر']) assert.equal(grenzeFuer(b).max, GRENZEN.kurz, b);
  for (const b of ['Full description', 'Vollständige Beschreibung', 'Descrição completa', 'Description complète', 'الوصف الكامل']) assert.equal(grenzeFuer(b).max, GRENZEN.voll, b);
  assert.equal(grenzeFuer('Título curto'), null, 'unbekannte Überschrift wird gemeldet, nicht still mit 4000 geprüft');
});

test('Die Datei: Englisch zuerst, fünf Sprachen × drei Felder, alles innerhalb der Grenzen', () => {
  const r = pruefe(md);
  assert.deepEqual(r.befunde, []);
  assert.equal(r.bloecke, 15);
  const sprachen = [...md.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  assert.match(sprachen[0], /^English/, 'Standardsprache Englisch (Zielmarkt Afrika)');
  for (const s of ['Français', 'Português', 'العربية', 'Deutsch']) assert.ok(sprachen.some((x) => x.startsWith(s)), s);
});

test('Zu langer französischer Titel fällt auf', () => {
  const kaputt = md.replace('ApoPulse – Réseau pharmacies', 'ApoPulse – Le réseau des pharmacies').replace('(28 caractères)', '(35 caractères)');
  assert.ok(pruefe(kaputt).befunde.some((b) => b.includes('Titre') && b.includes('erlaubt sind 30')));
});

test('Store-Text verspricht keinen Kauf (Play-Regel: kein Verweis auf andere Bezahlwege)', () => {
  const texte = [...md.matchAll(/^```\n([\s\S]*?)\n```/gm)].map((m) => m[1]).join('\n');
  assert.doesNotMatch(texte, /krypto|crypto|bitcoin|usdt|rechnung|invoice|facture|fatura|subscribe on|abonnez|assine/i);
});
