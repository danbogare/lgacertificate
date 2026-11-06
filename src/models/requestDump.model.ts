import mongoose, { Schema, Document } from "mongoose";

// Dumps are only kept long enough to investigate provider issues
const RETENTION_SECONDS = 30 * 24 * 60 * 60;

export enum RequestProvider {
  FLUTTERWAVE = "flutterwave",
  PARTNER = "partner",
}

export enum RequestDirection {
  OUTBOUND = "outbound",
  INBOUND = "inbound",
}

export interface IRequestDump extends Document {
  requestId: string;
  provider: RequestProvider;
  direction: RequestDirection;
  method: string;
  url: string;
  requestHeaders?: Record<string, unknown>;
  requestBody?: unknown;
  responseStatus?: number;
  responseBody?: unknown;
  // Retry number from the HTTP client, 0 for the first try
  attempt: number;
  durationMs?: number;
  errorMessage?: string;
  // Business reference such as a tx_ref, so dumps can be traced back to a transaction
  reference?: string;
  createdAt: Date;
  updatedAt: Date;
}

const requestDumpSchema = new Schema<IRequestDump>(
  {
    requestId: { type: String, required: true },
    provider: { type: String, enum: Object.values(RequestProvider), required: true },
    direction: { type: String, enum: Object.values(RequestDirection), required: true },
    method: { type: String, required: true, uppercase: true },
    url: { type: String, required: true },
    // Secrets like x-api-key must be redacted before saving
    requestHeaders: { type: Schema.Types.Mixed },
    requestBody: { type: Schema.Types.Mixed },
    responseStatus: { type: Number },
    responseBody: { type: Schema.Types.Mixed },
    attempt: { type: Number, default: 0 },
    durationMs: { type: Number },
    errorMessage: { type: String },
    reference: { type: String },
  },
  // Mixed fields keep empty objects instead of dropping them
  { timestamps: true, minimize: false }
);

requestDumpSchema.index({ requestId: 1, attempt: 1 }, { unique: true });
requestDumpSchema.index({ provider: 1, createdAt: -1 });
requestDumpSchema.index({ reference: 1, createdAt: -1 });
// MongoDB's TTL monitor deletes each dump once it is older than the retention period
requestDumpSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_SECONDS });

export const RequestDump = mongoose.model<IRequestDump>("RequestDump", requestDumpSchema);
