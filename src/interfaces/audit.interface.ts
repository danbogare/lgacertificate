import { Types } from "mongoose";
import { AuditAction, AuditTargetType, IAuditLog } from "../models/auditLog.model";

// Where an admin action came from, taken from the HTTP request
export interface IAuditContext {
  ip?: string;
  userAgent?: string;
}

export interface IAuditEntry {
  admin: Types.ObjectId | string;
  action: AuditAction;
  target?: { type: AuditTargetType; id: unknown };
  details?: Record<string, unknown>;
}

export interface IAuditLogQuery {
  adminId?: string;
  action?: string;
  targetId?: string;
  startDate?: string;
  endDate?: string;
  page?: string;
  limit?: string;
}

export interface IPaginatedAuditLogs {
  total: number;
  page: number;
  limit: number;
  data: IAuditLog[];
}
