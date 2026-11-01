import { FilterQuery, Model } from "mongoose";
import { IAuditLog } from "../models/auditLog.model";

export interface IAuditLogRepository {
  create(data: Partial<IAuditLog>): Promise<IAuditLog>;
  find(filter: FilterQuery<IAuditLog>, skip: number, limit: number): Promise<IAuditLog[]>;
  count(filter: FilterQuery<IAuditLog>): Promise<number>;
}

// Append-only: there is deliberately no update or delete
export class AuditLogRepository implements IAuditLogRepository {
  constructor(private readonly auditLogModel: Model<IAuditLog>) {}

  public async create(data: Partial<IAuditLog>): Promise<IAuditLog> {
    return await this.auditLogModel.create(data);
  }

  public async find(filter: FilterQuery<IAuditLog>, skip: number, limit: number): Promise<IAuditLog[]> {
    return await this.auditLogModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("admin", "firstName lastName email role lga")
      .exec();
  }

  public async count(filter: FilterQuery<IAuditLog>): Promise<number> {
    return await this.auditLogModel.countDocuments(filter).exec();
  }
}
