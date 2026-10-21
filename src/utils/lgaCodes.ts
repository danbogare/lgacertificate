// Keys MUST match the exact strings in your states JSON (e.g. "Egbado South", not "Yewa South").
// Codes other than OWL and YSL are proposals: get them confirmed by the client.
import statesData from "../services/states.json"; // <-- use the same path your controller uses
import { STATE_CODES } from "./stateCodes";

export const LGA_CODES: Record<string, Record<string, string>> = {
  Ogun: {
    "Abeokuta North": "ANL", "Abeokuta South": "ASL", "Ado-Odo/Ota": "AOL",
    "Egbado North": "YNL", "Egbado South": "YSL", "Ewekoro": "EWL",
    "Ifo": "IFL", "Ijebu East": "IEL", "Ijebu North": "INL",
    "Ijebu North East": "JNE", "Ijebu Ode": "IOL", "Ikenne": "IKL",
    "Imeko Afon": "IAL", "Ipokia": "IPL", "Obafemi Owode": "OWL",
    "Odeda": "ODL", "Odogbolu": "OGL", "Ogun Waterside": "OWT",
    "Remo North": "RNL", "Shagamu": "SHL",
  },
  Kwara: {
    "Asa": "ASL", "Baruten": "BAL", "Edu": "EDL", "Ekiti": "EKL",
    "Ifelodun": "IFL", "Ilorin East": "IEL", "Ilorin South": "ISL",
    "Ilorin West": "IWL", "Irepodun": "IRL", "Isin": "ISN",
    "Kaiama": "KAL", "Moro": "MOL", "Offa": "OFL", "Oke Ero": "OEL",
    "Oyun": "OYL", "Pategi": "PAL",
  },
  // add a state here when it onboards
};

// Boot-time validation
for (const [state, map] of Object.entries(LGA_CODES)) {
  if (!STATE_CODES[state]) throw new Error(`No state code for ${state}`);
  const codes = Object.values(map);
  if (new Set(codes).size !== codes.length) {
    throw new Error(`Duplicate LGA codes in ${state}`);
  }
  const missing = (statesData as Record<string, string[]>)[state].filter((l) => !map[l]);
  if (missing.length) throw new Error(`${state} missing LGA codes: ${missing.join(", ")}`);
}

export const getStateCode = (state: string): string => {
  const code = STATE_CODES[state];
  if (!code) throw new Error(`No state code for: ${state}`);
  return code;
};

export const getLgaCode = (state: string, lga: string): string => {
  const code = LGA_CODES[state]?.[lga];
  if (!code) throw new Error(`No LGA code configured for ${lga}, ${state}`);
  return code;
};