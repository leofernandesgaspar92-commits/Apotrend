// Platzhalter für den konkreten EU-resident LLM-Anbieter.
// Vendor wird beim Pilot gewählt (D-006): Mistral (EU-nativ) | Claude@AWS-Bedrock-Frankfurt |
// OpenAI-EU | Open-Weights self-hosted. Hier nur die Schnittstelle + die EU-Pflicht.
import { LlmClient } from './LlmClient.js';

export class EuProviderStub extends LlmClient {
  constructor(config = {}) {
    super({ name: config.name ?? 'eu-provider', euResident: true });
    this.config = config; // { endpoint, region: 'eu-central-1', apiKeyRef, ... }
  }

  async complete(_req) {
    this.assertEuResident();
    throw new Error(
      'Kein EU-LLM-Anbieter konfiguriert (D-006: Vendor wird beim Pilot gewählt). ' +
      'Default ohne Anbieter: deterministisches renderBriefing().'
    );
  }
}
