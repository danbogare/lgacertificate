import { ICounterRepository } from "../repositories/counter.repository";
import { LGA_CODES } from "../utils/lga-codes";
import { STATE_CODES } from "../utils/state-codes";

// Optional: certificate counters are also created on first approval, so this only pre-creates them
export async function seedCertificateCounters(counterRepository: ICounterRepository): Promise<void> {
  for (const [state, lgaCodes] of Object.entries(LGA_CODES)) {
    for (const lgaCode of Object.values(lgaCodes)) {
      await counterRepository.ensureCertificateCounter(STATE_CODES[state] as string, lgaCode);
    }
  }
}
