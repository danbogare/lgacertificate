import { Router } from "express";
import { IAuthController } from "../controllers/auth.controller";
import { IAuthMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import { asyncHandler } from "../middlewares/async-handler.middleware";
import { loginSchema, resetPasswordSchema, signupSchema, verifyEmailSchema } from "../validators/auth.validator";
import { changePasswordSchema } from "../validators/admin.validator";
import { emailSchema } from "../validators/common.validator";

// Mounted at /api/v1/auth
export class AuthRouter {
  private readonly router = Router();

  constructor(
    private readonly authController: IAuthController,
    private readonly authMiddleware: IAuthMiddleware
  ) {
    this.initializeRoutes();
  }

  public getRouter(): Router {
    return this.router;
  }

  private initializeRoutes(): void {
    this.router.post("/signup", validate(signupSchema), asyncHandler(this.authController.signup));
    this.router.post("/email/verify", validate(verifyEmailSchema), asyncHandler(this.authController.verifyUserEmail));
    this.router.post(
      "/email/request-verification",
      asyncHandler(this.authMiddleware.requireUser),
      asyncHandler(this.authController.requestEmailVerification)
    );
    this.router.post("/login", validate(loginSchema), asyncHandler(this.authController.login));
    this.router.post(
      "/change-password",
      asyncHandler(this.authMiddleware.requireUser),
      validate(changePasswordSchema),
      asyncHandler(this.authController.changePassword)
    );
    this.router.post("/forgot-password", validate(emailSchema), asyncHandler(this.authController.forgotPassword));
    this.router.post("/reset-password", validate(resetPasswordSchema), asyncHandler(this.authController.resetPassword));
    this.router.post("/resend-otp", validate(emailSchema), asyncHandler(this.authController.resendOTP));
  }
}
