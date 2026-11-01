import { FilterQuery } from "mongoose";
import { AdminRole, IAdmin } from "../models/admin.model";
import { IApplication } from "../models/application.model";

type ApplicationLocation = Pick<IApplication, "stateOfOrigin" | "lga" | "lgaOfResident">;

export const isSuperAdmin = (admin: IAdmin): boolean => admin.role === AdminRole.SUPER_ADMIN;

// State + LGA together identify the issuer (LGA names repeat across states); residents belong to their LGA of residence
export const isIssuingOfficial = (admin: IAdmin, application: ApplicationLocation): boolean =>
  (admin.stateOfOrigin === application.stateOfOrigin && admin.lga === application.lga) ||
  admin.lga === application.lgaOfResident;

// Applications an LGA is responsible for: indigenes of that state + LGA, and residents of that LGA
export const lgaApplicationsFilter = (state: string, lga?: string): FilterQuery<IApplication> => ({
  $or: [{ stateOfOrigin: state, lga }, { lgaOfResident: lga }],
});

// Limits application queries to the official's LGA
export const officialLgaFilter = (admin: IAdmin): FilterQuery<IApplication> =>
  lgaApplicationsFilter(admin.stateOfOrigin, admin.lga);
