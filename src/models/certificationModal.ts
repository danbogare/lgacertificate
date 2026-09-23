import mongoose, { Schema, Document, Types } from "mongoose";

export interface ICertificate extends Document {
  certificateRef: string;
  certificateHash: string;
  verificationCode?: string | null | undefined;
  emailOfVerification?: string | null | undefined;
  isVerificationCodeGenerated?: boolean;
  isVerificationPaymentPending?: boolean;
  pendingPaymentLink: string | null;
  user: Types.ObjectId; // reference to User model
  application: Types.ObjectId; // reference to Application model
}

const certificateSchema = new Schema<ICertificate>(
  {
    certificateRef: { type: String, required: true },
    certificateHash: { type: String, required: true },
    verificationCode: { type: String },
    emailOfVerification: { type: String },
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

const Certificate = mongoose.model<ICertificate>("Certificate", certificateSchema);
export default Certificate;
