import { Request, Response } from "express";
import { IAuditService } from "../services/audit.service";
import { IAdmin } from "../models/admin.model";
import { IAuditLogQuery } from "../interfaces/audit.interface";
import { successResponse } from "../utils/response";

export interface IAuditController {
  getAuditLogs: (req: Request, res: Response) => Promise<void>;
}

export class AuditController implements IAuditController {
  constructor(private readonly auditService: IAuditService) {}

  public getAuditLogs = async (req: Request, res: Response): Promise<void> => {
    const logs = await this.auditService.getLogs(req.admin as IAdmin, req.query as IAuditLogQuery);

    successResponse(res, "audit logs retrieved successfully", logs);
  };
}
