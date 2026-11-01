import statesData from "../data/states.json";

const statesByName = statesData as Record<string, string[]>;

// Officials and signatories are only onboarded for Ogun LGAs
export const HOME_STATE = "Ogun";

export const getStates = (): string[] => Object.keys(statesByName);

export const getLgas = (state: string): string[] | undefined => statesByName[state];

export const isValidState = (state: string): boolean => Object.hasOwn(statesByName, state);

export const isValidLga = (state: string, lga: string): boolean => getLgas(state)?.includes(lga) ?? false;
