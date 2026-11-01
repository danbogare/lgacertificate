import { getLgas, getStates } from "../utils/states";

export interface ILocationService {
  getStates(): string[];
  getLgas(state: string): string[] | undefined;
}

export class LocationService implements ILocationService {
  public getStates(): string[] {
    return getStates();
  }

  public getLgas(state: string): string[] | undefined {
    return getLgas(state);
  }
}
