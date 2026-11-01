import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { errorResponse } from "../utils/response";

export interface IWebhookMiddleware {
  verifyPartnerSignature: (req: Request, res: Response, next: NextFunction) => void;
}

export class WebhookMiddleware implements IWebhookMiddleware {
  constructor(private readonly partnerSecret: string) {}

  // The partner signs the raw request body with HMAC-SHA256 using our shared secret
  public verifyPartnerSignature = (req: Request, res: Response, next: NextFunction): void => {
    const signature = req.headers["x-webhook-signature"] as string | undefined;
    const timestamp = req.headers["x-webhook-timestamp"] as string | undefined;

    if (!signature || !timestamp) {
      errorResponse(res, 401, "Missing webhook signature headers");
      return;
    }

    if (!req.rawBody) {
      errorResponse(res, 400, "Raw body not available for verification");
      return;
    }

    if (!this.partnerSecret) {
      errorResponse(res, 401, "Unauthorized");
      return;
    }

    const expectedSignature = crypto.createHmac("sha256", this.partnerSecret).update(req.rawBody).digest("hex");

    if (!this.timingSafeCompare(signature, expectedSignature)) {
      errorResponse(res, 401, "Invalid webhook signature");
      return;
    }

    next();
  };

  private timingSafeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }
}
