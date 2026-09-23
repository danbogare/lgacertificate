import mongoose, { Schema, Document, Types } from "mongoose";

export enum ApplicationStatus {
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PENDING = 'pending',
  PENDING_PAYMENT = 'pending_payment',
}

export interface IApplication extends Document {
  fullNames: string;
  dateOfBirth: Date;
  nin?: string;
  fatherNames?: string;
  motherNames?: string;
  nativeTown?: string;
  nativePoliticalWard?: string;
  village?: string;
  communityHead?: string;
  communityHeadContact?: string;
  passport: string;
  passportPublicId?: string;
  docFromCommunityHead?: string | null;
  docFromCommunityHeadPublicId?: string | null;
  currentAddress: string;
  stateOfOrigin: string;
  lga: string;
  isResidentOfOgun?: boolean;
  lgaOfResident?: string | null;
  status: ApplicationStatus;
  pendingPaymentLink?: string | null;
  pendingApprovalRejectionDate?: Date | null
  user: Types.ObjectId; // reference to User model
  createdAt?: Date;
  updatedAt?: Date;
}

const applicationSchema = new Schema<IApplication>(
  {
    fullNames: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    nin: { type: String },
    fatherNames: { type: String },
    motherNames: { type: String },
    nativeTown: { type: String },
    nativePoliticalWard: { type: String },
    village: { type: String },
    communityHead: { type: String },
    communityHeadContact: { type: String },
    passport: { type: String, required: true },
    passportPublicId: { type: String, required: true },
    docFromCommunityHead: { type: String },
    docFromCommunityHeadPublicId: { type: String },
    currentAddress: { type: String, required: true },
    lga: { type: String, required: true },
    stateOfOrigin: { type: String, required: true },
    isResidentOfOgun: { type: Boolean },
    lgaOfResident: { type: String },
    status: { type: String, enum: Object.values(ApplicationStatus), required: true },
    pendingPaymentLink: { type: String },
    pendingApprovalRejectionDate: { type: Date, default: null },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const Application = mongoose.model<IApplication>("Application", applicationSchema);
export default Application;
