import mongoose, { Schema, Document, Types } from "mongoose";
import { TransactionType } from "./transaction.model";

export enum PaymentType {
  CAPTURE = "CAPTURE",
  REFUND = "REFUND",
}

export enum PaymentStatus {
  SUCCESS = "SUCCESS",
  PENDING = "PENDING",
  FAILED = "FAILED",
}

export enum PaymentMethod {
  BANK_TRANSFER = "BANK_TRANSFER",
}

export interface IPaymentMetadata {
  publishers?: string;
  transactionDate?: string;

  originatingBankName?: string;
  originatingAccountNumber?: string;
  originatingAccountName?: string;

  status?: string;
  channel?: string;

  sessionId?: string;
  referenceID?: string;

  beneficiaryAccountName?: string;
  beneficiaryAccountNumber?: string;

  previousBalance?: number;
  newBalance?: number;

  eventType?: string;
}

export interface IPartnerTransaction extends Document {
  payerId: Types.ObjectId;
  applicationId?: Types.ObjectId;
  certificateId?: Types.ObjectId;
  // The dynamic account number. The partner may rotate numbers, so it is only unique among pending payments
  paymentRef: string;
  accountName?: string;

  type: PaymentType;
  amount: string;
  currency: string;
  status: PaymentStatus;
  method: PaymentMethod;
  transactionType: TransactionType;

  metadata?: IPaymentMetadata;

  settledAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const paymentMetadataSchema = new Schema<IPaymentMetadata>(
  {
    publishers: { type: String },

    transactionDate: { type: String },

    originatingBankName: { type: String },
    originatingAccountNumber: { type: String },
    originatingAccountName: { type: String },

    status: { type: String },
    channel: { type: String },

    sessionId: { type: String },
    referenceID: { type: String },

    beneficiaryAccountName: { type: String },
    beneficiaryAccountNumber: { type: String },

    previousBalance: { type: Number },
    newBalance: { type: Number },

    eventType: { type: String },
  },
  { _id: false }
);

const partnerTransactionSchema = new Schema<IPartnerTransaction>(
  {
    payerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "Application",
    },
    
    certificateId: {
      type: Schema.Types.ObjectId,
      ref: "Certificate",
    },

    paymentRef: {
      type: String,
      required: true,
    },

    accountName: {
      type: String,
    },

    type: {
      type: String,
      enum: Object.values(PaymentType),
      required: true,
    },

    amount: {
      type: String,
      required: true,
    },

    currency: {
      type: String,
      default: "NGN",
      required: true,
    },

    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
      required: true,
    },

    method: {
      type: String,
      enum: Object.values(PaymentMethod),
      required: true,
    },

    metadata: {
      type: paymentMetadataSchema,
    },

    settledAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Expiry job: pending transactions by age
partnerTransactionSchema.index({ status: 1, createdAt: 1 });

// One open payment per account number; a rotated number can be reused once the earlier payment is settled or expired
partnerTransactionSchema.index(
  { paymentRef: 1 },
  {
    name: "paymentRef_pending_unique",
    unique: true,
    partialFilterExpression: { status: PaymentStatus.PENDING },
  }
);

export const PartnerTransaction = mongoose.model<IPartnerTransaction>("PartnerTransaction", partnerTransactionSchema);

