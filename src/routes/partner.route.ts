import { Router } from "express";
import { IPartnerController } from "../controllers/partner.controller";
import { IAuthMiddleware } from "../middlewares/auth.middleware";
import { IWebhookMiddleware } from "../middlewares/webhook.middleware";
import { asyncHandler } from "../middlewares/async-handler.middleware";

// Mounted at /api/v1/partner
export class PartnerRouter {
  private readonly router = Router();

  constructor(
    private readonly partnerController: IPartnerController,
    private readonly authMiddleware: IAuthMiddleware,
    private readonly webhookMiddleware: IWebhookMiddleware
  ) {
    this.initializeRoutes();
  }

  public getRouter(): Router {
    return this.router;
  }

  private initializeRoutes(): void {
    this.router.post(
      "/webhook",
      this.webhookMiddleware.verifyPartnerSignature,
      asyncHandler(this.partnerController.handleWebhookEvent)
    );
    this.router.post(
      "/transaction/:sourceId",
      asyncHandler(this.authMiddleware.requireUser),
      asyncHandler(this.partnerController.getPartnerTransaction)
    );
  }
}
