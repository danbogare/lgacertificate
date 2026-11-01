export interface ICreateApplicationPayload {
  fullNames: string;
  fatherNames?: string;
  motherNames?: string;
  nativeTown?: string;
  nativePoliticalWard?: string;
  nativePollingUnit?: string;
  village?: string;
  communityHead?: string;
  communityHeadContact?: string;
  currentAddress: string;
  lga: string;
  nin?: string;
  stateOfOrigin: string;
  isResidentOfOgun?: boolean | string;
  lgaOfResident?: string;
  dateOfBirth: string;
}

export interface IApplicationUploads {
  passport?: Express.Multer.File;
  docFromCommunityHead?: Express.Multer.File;
}

export interface IApplicationFilters {
  status?: string;
  startDate?: string;
  endDate?: string;
  // Only the super admin can pick an LGA; state defaults to Ogun
  lga?: string;
  state?: string;
}

export interface IApplicationListQuery extends IApplicationFilters {
  name?: string;
  email?: string;
  page?: string;
  limit?: string;
}

export interface IApplicationSummary {
  totalApplications: number;
  totalApproved: number;
  totalRejected: number;
  totalPending: number;
  todayCount: number;
  todayApproved: number;
  todayRejected: number;
  todayPending: number;
}
