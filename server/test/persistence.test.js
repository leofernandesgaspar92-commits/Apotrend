import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createPersistence } from '../src/repo/persistence.js';

function tmpFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'apo-persist-')), 'data.json');
}

test('createPersistence: ohne Pfad -> null (reines In-Memory)', () => {
  assert.equal(createPersistence(null), null);
  assert.equal(createPersistence(''), null);
});

test('Persistenz: save/load ist verlustfrei (Round-Trip beliebiger Snapshot)', () => {
  const fp = tmpFile();
  const p = createPersistence(fp);
  const snapshot = {
    foundation: { users: [{ id: 'u1', email: 'a@a.at' }] },
    social: { profiles: [{ user_id: 'u1', handle: 'anna', account_type: 'pharma' }], posts: [] },
    shortages: { items: [{ id: 's1', wirkstoff: 'Ramipril', umlaut: 'Ä Ö Ü ß' }] },
    prices: {}, rabatte: {}, exchange: { entries: [] },
  };
  p.save(snapshot);
  assert.deepEqual(p.load(), snapshot, 'geladener Stand == gespeicherter Stand');
});

test('Persistenz: fehlende/kaputte Datei -> load() gibt null (Frischstart)', () => {
  const fp = tmpFile();
  const p = createPersistence(fp);
  assert.equal(p.load(), null, 'noch nichts gespeichert');
  fs.writeFileSync(fp, '{ kaputt json');
  assert.equal(p.load(), null, 'unparsbarer Inhalt -> null statt Absturz');
});

test('Persistenz: save ist atomar (keine zurückbleibende .tmp-Datei; letzter Stand gewinnt)', () => {
  const fp = tmpFile();
  const p = createPersistence(fp);
  p.save({ n: 1 });
  p.save({ n: 2 });
  assert.equal(p.load().n, 2);
  assert.equal(fs.existsSync(fp + '.tmp'), false, 'keine übrig gebliebene temp-Datei');
});
