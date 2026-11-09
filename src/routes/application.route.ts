import { Router } from "express";
import { IApplicationController } from "../controllers/application.controller";
import { IAuthMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import { asyncHandler } from "../middlewares/async-handler.middleware";
import { uploadApplicationFiles } from "../middlewares/upload.middleware";
import { createApplicationSchema } from "../validators/application.validator";

// Mounted at /api/v1/application
export class ApplicationRouter {
  private readonly router = Router();

  constructor(
    private readonly applicationController: IApplicationController,
    private readonly authMiddleware: IAuthMiddleware
  ) {
    this.initializeRoutes();
  }

  public getRouter(): Router {
    return this.router;
  }

  private initializeRoutes(): void {
    const requireUser = asyncHandler(this.authMiddleware.requireUser);

    this.router.post(
      "/",
      requireUser,
      uploadApplicationFiles,
      validate(createApplicationSchema),
      asyncHandler(this.applicationController.createApplication)
    );
    this.router.post(
      "/partner",
      requireUser,
      uploadApplicationFiles,
      validate(createApplicationSchema),
      asyncHandler(this.applicationController.createPartnerApplication)
    );
    this.router.get("/", requireUser, asyncHandler(this.applicationController.getUserApplications));
    this.router.get("/:id", requireUser, asyncHandler(this.applicationController.getUserApplication));

    // Pay again for an existing application that is still pending_payment
    this.router.post("/:id/payment", requireUser, asyncHandler(this.applicationController.retryApplicationPayment));
    this.router.post(
      "/partner/:id/payment",
      requireUser,
      asyncHandler(this.applicationController.retryPartnerApplicationPayment)
    );

    // Flutterwave redirect target, so no auth
    this.router.get("/payment/verify", asyncHandler(this.applicationController.verifyPayment));
  }
}
