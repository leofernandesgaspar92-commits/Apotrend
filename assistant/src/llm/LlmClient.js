// LLM-Schicht — provider-agnostisch (D-006).
// HARTE REGEL: nur EU-resident Anbieter (DSGVO + EU AI Act). Vendor-Wahl beim Pilot.
// Das LLM FORMULIERT nur bereits gegroundete Fakten — es erfindet nichts; Quellen bleiben Pflicht.
export class LlmClient {
  constructor({ name = 'abstract', euResident = false } = {}) {
    this.name = name;
    this.euResident = euResident;
  }

  assertEuResident() {
    if (!this.euResident) {
      throw new Error(`LLM "${this.name}" ist nicht als EU-resident markiert (D-006: nur EU-Residency erlaubt).`);
    }
  }

  /** @param {{system:string, prompt:string}} _req → Promise<string> */
  async complete(_req) {
    throw new Error('LlmClient.complete() nicht implementiert');
  }
}
