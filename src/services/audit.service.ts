import mongoose, { FilterQuery } from "mongoose";
import { AuditAction, IAuditLog } from "../models/auditLog.model";
import { IAdmin } from "../models/admin.model";
import { IAuditLogRepository } from "../repositories/auditLog.repository";
import { IAuditContext, IAuditEntry, IAuditLogQuery, IPaginatedAuditLogs } from "../interfaces/audit.interface";
import { BadRequestError, UnauthorizedError } from "../errors/error";
import { isSuperAdmin } from "../utils/admin-scope";
import { isValidDateFormat } from "../utils/format";

const MAX_PAGE_SIZE = 100;

export interface IAuditService {
  record(entry: IAuditEntry, context: IAuditContext): Promise<void>;
  getLogs(viewer: IAdmin, query: IAuditLogQuery): Promise<IPaginatedAuditLogs>;
}

export class AuditService implements IAuditService {
  constructor(private readonly auditLogRepository: IAuditLogRepository) {}

  // Called after the action has succeeded. A failed write is reported but never fails the action itself.
  public async record(entry: IAuditEntry, context: IAuditContext): Promise<void> {
    try {
      await this.auditLogRepository.create({
        admin: entry.admin as any,
        action: entry.action,
        targetType: entry.target?.type,
        targetId: entry.target?.id as any,
        details: entry.details,
        ip: context.ip,
        userAgent: context.userAgent,
      });
    } catch (error) {
      console.error(`Failed to write audit log for "${entry.action}":`, error);
    }
  }

  // Only the super admin can read the trail
  public async getLogs(viewer: IAdmin, query: IAuditLogQuery): Promise<IPaginatedAuditLogs> {
    if (!isSuperAdmin(viewer)) throw new UnauthorizedError();

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.limit) || 20));
    const filter = this.buildFilter(query);

    const [data, total] = await Promise.all([
      this.auditLogRepository.find(filter, (page - 1) * limit, limit),
      this.auditLogRepository.count(filter),
    ]);

    return { total, page, limit, data };
  }

  private buildFilter(query: IAuditLogQuery): FilterQuery<IAuditLog> {
    const { adminId, action, targetId, startDate, endDate } = query;
    const filter: FilterQuery<IAuditLog> = {};

    if (adminId) {
      if (!mongoose.isValidObjectId(adminId)) throw new BadRequestError("Invalid adminId");
      filter.admin = adminId;
    }

    if (targetId) {
      if (!mongoose.isValidObjectId(targetId)) throw new BadRequestError("Invalid targetId");
      filter.targetId = targetId;
    }

    if (action) {
      if (!Object.values(AuditAction).includes(action as AuditAction)) throw new BadRequestError("Invalid action");
      filter.action = action as AuditAction;
    }

    if (startDate || endDate) {
      const range: { $gte?: Date; $lte?: Date } = {};
      if (startDate) {
        if (!isValidDateFormat(startDate)) throw new BadRequestError("Invalid startDate format. Expected YYYY-MM-DD.");
        range.$gte = new Date(`${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        if (!isValidDateFormat(endDate)) throw new BadRequestError("Invalid endDate format. Expected YYYY-MM-DD.");
        range.$lte = new Date(`${endDate}T23:59:59.999Z`);
      }
      filter.createdAt = range;
    }

    return filter;
  }
}
