import mongoose, { Schema, Document, Types } from "mongoose";
import { TransactionType } from "./transactionModel";

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
  paymentRef: string;

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
      unique: true,
      required: true,
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

const PartnerTransaction = mongoose.model<IPartnerTransaction>("PartnerTransaction", partnerTransactionSchema);

export default PartnerTransaction;