import { Request } from "express";
import { IAuditContext } from "../interfaces/audit.interface";

export const getAuditContext = (req: Request): IAuditContext => ({
  ip: req.ip,
  userAgent: req.get("user-agent"),
});

const SENSITIVE_HEADERS = new Set(["authorization", "x-api-key", "cookie"]);

// Hides credentials before headers are stored in request dumps
export const redactHeaders = (headers: object = {}): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      SENSITIVE_HEADERS.has(name.toLowerCase()) ? "[REDACTED]" : value,
    ])
  );
