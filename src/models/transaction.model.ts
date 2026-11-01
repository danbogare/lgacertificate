import mongoose, { Schema, Document, Types } from "mongoose";

export enum TransactionStatus {
  SUCCESSFUL = 'successful',
  PENDING = 'pending',
  FAILED = 'failed',
}

export enum TransactionType {
  APPLICATION = 'application',
  CERTIFICATE = 'certificate',
}

export interface ITransaction extends Document {
  transactionRef: string;
  amount: string;
  transactionId?: number;
  providerRef?: string;
  status?: string;
  transactionType: string;
  user: Types.ObjectId; // reference to User model
  application?: Types.ObjectId; // reference to Application model
  certificate?: Types.ObjectId; // reference to Application model
}

const transactionSchema = new Schema<ITransaction>(
  {
    transactionRef: { type: String, required: true },
    amount: { type: String, required: true },
    transactionId: { type: Number },
    providerRef: { type: String },
    status: { type: String, enum: Object.values(TransactionStatus), default: TransactionStatus.PENDING },
    transactionType: { type: String, enum: Object.values(TransactionType), required: true },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    application: {
      type: Schema.Types.ObjectId,
      ref: "Application",
    },
    certificate: {
      type: Schema.Types.ObjectId,
      ref: "Certificate",
    },
  },
  { timestamps: true }
);

export const Transaction = mongoose.model<ITransaction>("Transaction", transactionSchema);
