import { Request } from "express";
import { IAuditContext } from "../interfaces/audit.interface";

export const getAuditContext = (req: Request): IAuditContext => ({
  ip: req.ip,
  userAgent: req.get("user-agent"),
});
