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

// Details shown for the official who approved, rejected or revoked a record. The super admin sees the
// full staff record, other officials also see the role, and applicants only see name, position and LGA.
const REVIEWER_FIELDS_FOR_SUPER_ADMIN = "firstName lastName email phone position staffID role lga stateOfOrigin";
const REVIEWER_FIELDS_FOR_OFFICIAL = "firstName lastName position lga role";
const REVIEWER_FIELDS_FOR_APPLICANT = "firstName lastName position lga";

export const reviewerFieldsFor = (admin?: IAdmin): string => {
  if (!admin) return REVIEWER_FIELDS_FOR_APPLICANT;
  return isSuperAdmin(admin) ? REVIEWER_FIELDS_FOR_SUPER_ADMIN : REVIEWER_FIELDS_FOR_OFFICIAL;
};
