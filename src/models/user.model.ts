import mongoose, { Schema, Document } from "mongoose";

export enum AuthState {
  VERIFIED = 'verified',
  PENDING_VERIFICATION = 'pending',
}

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  middleName: string;
  email: string;
  phone: string;
  password: string;
  state: string;
  verifyEmailOTP?: string | null | undefined;
  resetPasswordOTP?: string | null | undefined;
  resetPasswordExpire?: Date | null | undefined;
  verifyEmailOTPExpire?: Date | null | undefined;
}

const userSchema = new Schema<IUser>({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  middleName: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  state: { type: String, enum: Object.values(AuthState), default: AuthState.PENDING_VERIFICATION },
  verifyEmailOTP: {type: String},
  resetPasswordOTP: {type: String},
  resetPasswordExpire: {type: Date},
  verifyEmailOTPExpire: {type: Date},
}, { timestamps: true });

export const User = mongoose.model<IUser>("User", userSchema);
