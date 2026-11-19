import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { errorResponse } from "../utils/response";

// Only the partner's known outbound IPs may deliver payment notifications.
// Combined with the HMAC signature this prevents forged webhooks from any other host.
export function partnerIpWhitelist(_req: Request, res: Response, next: NextFunction): void {
  const allowed = env.partner.webhookIps;
  if (!allowed.length) {
    next();
    return;
  }

  const clientIp = _req.ip ?? _req.socket.remoteAddress ?? "";
  // Strip IPv6 mapped IPv4 prefix, e.g. ::ffff:1.2.3.4 -> 1.2.3.4
  const normalizedIp = clientIp.replace(/^::ffff:/, "");

  if (!allowed.includes(normalizedIp)) {
    errorResponse(res, 403, "Webhook source IP is not whitelisted");
    return;
  }

  next();
}
