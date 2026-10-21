import mongoose, { Schema, Document, Types } from "mongoose";

export interface ICertificate extends Document {
  certificateRef: string;
  certificateHash: string;
  verificationCode?: string | null | undefined;
  emailOfVerification?: string | null | undefined;
  isVerificationCodeGenerated?: boolean;
  isVerificationPaymentPending?: boolean;
  pendingPaymentLink?: string | null;
  isRevoked: boolean;
  revocationReason?: string | null;
  revokedBy?: Types.ObjectId | null; // reference to User model
  revokedAt?: Date | null;
  user: Types.ObjectId; // reference to User model
  application: Types.ObjectId; // reference to Application model
}

const certificateSchema = new Schema<ICertificate>(
  {
    certificateRef: { type: String, unique: true, required: true },
    certificateHash: { type: String, required: true },
    verificationCode: { type: String },
    emailOfVerification: { type: String },
    isRevoked: { type: Boolean, default: false },
    revocationReason: { type: String },
    revokedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
    revokedAt: { type: Date },
    isVerificationCodeGenerated: { type: Boolean, default: false },
    isVerificationPaymentPending: { type: Boolean, default: false },
    pendingPaymentLink: { type: String },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    application: {
      type: Schema.Types.ObjectId,
      ref: "Application",
      required: true,
    },
  },
  { timestamps: true }
);

// Used by the $in lookup in getCertificatesByAdmin and getCertificateByApplicationId
certificateSchema.index({ application: 1 });

// getCertificates (user's own list, sorted newest first)
certificateSchema.index({ user: 1, createdAt: -1 });

// getCertificatesByAdmin (admin's filtered list, sorted newest first)
certificateSchema.index({ revokedBy: 1, revokedAt: -1 });

const Certificate = mongoose.model<ICertificate>("Certificate", certificateSchema);
export default Certificate;
