import { Router } from "express";
import { IAdminController } from "../controllers/admin.controller";
import { IApplicationController } from "../controllers/application.controller";
import { IAuditController } from "../controllers/audit.controller";
import { IAuthMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import { asyncHandler } from "../middlewares/async-handler.middleware";
import { loginSchema, resetPasswordSchema } from "../validators/auth.validator";
import { changePasswordSchema, createAdminSchema, rejectionReasonSchema } from "../validators/admin.validator";
import { emailSchema, resendOtpSchema } from "../validators/common.validator";

// Mounted at /api/v1/admin
export class AdminRouter {
  private readonly router = Router();

  constructor(
    private readonly adminController: IAdminController,
    private readonly applicationController: IApplicationController,
    private readonly auditController: IAuditController,
    private readonly authMiddleware: IAuthMiddleware
  ) {
    this.initializeRoutes();
  }

  public getRouter(): Router {
    return this.router;
  }

  private initializeRoutes(): void {
    const requireAdmin = asyncHandler(this.authMiddleware.requireAdmin);

    // Super admin onboards officials
    this.router.post("/signup", requireAdmin, validate(createAdminSchema), asyncHandler(this.adminController.signup));

    this.router.post("/login", validate(loginSchema), asyncHandler(this.adminController.login));
    this.router.post(
      "/change-password",
      requireAdmin,
      validate(changePasswordSchema),
      asyncHandler(this.adminController.changePassword)
    );
    this.router.post("/forgot-password", validate(emailSchema), asyncHandler(this.adminController.forgotPassword));
    this.router.post("/reset-password", validate(resetPasswordSchema), asyncHandler(this.adminController.resetPassword));
    this.router.post("/resend-otp", validate(resendOtpSchema), asyncHandler(this.adminController.resendOTP));

    this.router.post(
      "/application/:id",
      requireAdmin,
      validate(rejectionReasonSchema),
      asyncHandler(this.applicationController.reviewApplication)
    );
    this.router.get("/applications", requireAdmin, asyncHandler(this.applicationController.getFilteredApplications));
    this.router.get(
      "/applications/pending",
      requireAdmin,
      asyncHandler(this.applicationController.getPendingApplications)
    );
    this.router.get(
      "/applications/approved",
      requireAdmin,
      asyncHandler(this.applicationController.getApprovedApplications)
    );
    this.router.get(
      "/applications/rejected",
      requireAdmin,
      asyncHandler(this.applicationController.getRejectedApplications)
    );
    this.router.get(
      "/summary/application",
      requireAdmin,
      asyncHandler(this.applicationController.getApplicationSummary)
    );
    this.router.post(
      "/download/application",
      requireAdmin,
      asyncHandler(this.applicationController.downloadApplicationReport)
    );

    // Super admin only
    this.router.get("/audit-logs", requireAdmin, asyncHandler(this.auditController.getAuditLogs));
  }
}
