// PUT AT: src/utils/seedCertificateCounters.ts  (NEW FILE)
// Call once at startup, after the DB connection is open:
//   await seedCertificateCounters();
import Counter from "../models/counterModel";
import { LGA_CODES } from "./lgaCodes";
import { STATE_CODES } from "./stateCodes";

export const seedCertificateCounters = async () => {
  for (const [state, map] of Object.entries(LGA_CODES)) {
    for (const lgaCode of Object.values(map)) {
      await Counter.updateOne(
        { _id: `${STATE_CODES[state]}-${lgaCode}-CO` },
        { $setOnInsert: { seq: 0 } },
        { upsert: true }
      );
    }
  }
};