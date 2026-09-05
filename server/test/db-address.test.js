// Interne oder öffentliche Datenbank-Adresse? (repo/dbAddress.js)
//
// Anlass: Die Datenbank-Seite bei Render bietet „Internal" und „External
// Database URL" direkt untereinander an. Sie unterscheiden sich um einen Punkt
// im Hostnamen — und darum, ob die Daten das Rechenzentrum verlassen. Die
// externe Adresse funktioniert klaglos; genau deshalb fällt der Fehler sonst
// niemandem auf.

import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyDbUrl, dbAddressWarning } from '../src/repo/dbAddress.js';

test('die interne Render-Adresse gilt als intern', () => {
  const c = classifyDbUrl('postgresql://u:p@dpg-dadsrfe7bikc73faor8g-a/apopulse_db');
  assert.equal(c.kind, 'intern');
  assert.equal(dbAddressWarning('postgresql://u:p@dpg-dadsrfe7bikc73faor8g-a/apopulse_db'), null);
});

test('die externe Render-Adresse wird erkannt und benannt', () => {
  const url = 'postgresql://u:p@dpg-dadsrfe7bikc73faor8g-a.frankfurt-postgres.render.com/apopulse_db';
  const c = classifyDbUrl(url);
  assert.equal(c.kind, 'extern');
  assert.equal(c.host, 'dpg-dadsrfe7bikc73faor8g-a.frankfurt-postgres.render.com');
  const w = dbAddressWarning(url);
  assert.match(w, /ÖFFENTLICHE Adresse/);
  assert.match(w, /Internal Database URL/);
});

test('die Warnung verrät NIEMALS Benutzername oder Passwort', () => {
  // Die Zugangsdaten stehen in derselben URL. Eine Warnung, die sie ins
  // Protokoll schreibt, richtet mehr Schaden an als der Zustand, vor dem sie
  // warnt — Render-Protokolle sind für jeden im Team lesbar.
  const w = dbAddressWarning('postgresql://geheim_user:Sup3rGeheim@x.frankfurt-postgres.render.com/db');
  assert.doesNotMatch(w, /Sup3rGeheim/);
  assert.doesNotMatch(w, /geheim_user/);
});

test('localhost und Container-Namen gelten als intern', () => {
  assert.equal(classifyDbUrl('postgresql://u:p@localhost:5432/db').kind, 'intern');
  assert.equal(classifyDbUrl('postgresql://u:p@127.0.0.1:5432/db').kind, 'intern');
  assert.equal(classifyDbUrl('postgresql://u:p@postgres:5432/db').kind, 'intern');
});

test('eine fremde öffentliche Adresse wird ebenfalls gemeldet', () => {
  const c = classifyDbUrl('postgresql://u:p@db.example.com:5432/db');
  assert.equal(c.kind, 'extern');
  assert.match(dbAddressWarning('postgresql://u:p@db.example.com:5432/db'), /internen Netz/);
});

test('unauswertbare Angaben lösen KEINE Warnung aus', () => {
  // Eine Warnung auf Verdacht ist schlimmer als keine: Sie stumpft ab, und
  // beim nächsten Mal liest sie niemand mehr.
  for (const x of ['', null, undefined, 'kein-url', '://kaputt']) {
    assert.equal(classifyDbUrl(x).kind, 'unbekannt');
    assert.equal(dbAddressWarning(x), null);
  }
});
