import mongoose, { Schema, Document, Types } from "mongoose";

export enum AuditAction {
  LOGIN = "login",
  LOGIN_FAILED = "login_failed",
  PASSWORD_RESET_REQUESTED = "password_reset_requested",
  PASSWORD_RESET_OTP_RESENT = "password_reset_otp_resent",
  PASSWORD_RESET = "password_reset",
  PASSWORD_RESET_FAILED = "password_reset_failed",
  PASSWORD_CHANGED = "password_changed",
  ADMIN_CREATED = "admin_created",
  APPLICATION_APPROVED = "application_approved",
  APPLICATION_REJECTED = "application_rejected",
  CERTIFICATE_REVOKED = "certificate_revoked",
  SIGNATORY_CREATED = "signatory_created",
  SIGNATORY_UPDATED = "signatory_updated",
  SIGNATORY_DELETED = "signatory_deleted",
  REPORT_EXPORTED = "report_exported",
}

export enum AuditTargetType {
  ADMIN = "Admin",
  APPLICATION = "Application",
  CERTIFICATE = "Certificate",
  SIGNATORY = "Signatory",
}

export interface IAuditLog extends Document {
  admin: Types.ObjectId;
  action: AuditAction;
  targetType?: AuditTargetType;
  targetId?: Types.ObjectId;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    admin: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    action: { type: String, enum: Object.values(AuditAction), required: true },
    targetType: { type: String, enum: Object.values(AuditTargetType) },
    targetId: { type: Schema.Types.ObjectId, refPath: "targetType" },
    details: { type: Schema.Types.Mixed },
    ip: { type: String },
    userAgent: { type: String },
  },
  // Entries are never edited, so only the creation time is kept
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ admin: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ targetId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", auditLogSchema);
