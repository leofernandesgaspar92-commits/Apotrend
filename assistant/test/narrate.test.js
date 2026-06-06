// Tests für die Narrations-/LLM-Schicht (D-006): Default deterministisch + EU-Residency-Regel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderBriefing, narrateBriefing } from '../src/narrate.js';
import { EuProviderStub } from '../src/llm/euProviderStub.js';
import { LlmClient } from '../src/llm/LlmClient.js';

const recs = [{ typ: 'rueckruf', schweregrad: 'kritisch', titel: 'T', details: 'D', quellen: ['signals:X'] }];
const meta = { apotheke_name: 'A', stand: 'S' };

test('narrateBriefing ohne LLM = deterministisches renderBriefing', async () => {
  assert.equal(await narrateBriefing(recs, meta), renderBriefing(recs, meta));
});

test('EuProviderStub ist EU-resident, aber (noch) nicht konfiguriert', async () => {
  const llm = new EuProviderStub({ name: 'pilot' });
  assert.equal(llm.euResident, true);
  await assert.rejects(() => llm.complete({ system: '', prompt: '' }), /konfiguriert/);
});

test('Nicht-EU-resident LLM wird abgelehnt (harte Regel)', () => {
  const bad = new LlmClient({ name: 'us-direct', euResident: false });
  assert.throws(() => bad.assertEuResident(), /nur EU-Residency/);
});
