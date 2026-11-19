import { Router } from "express";
import { IAuthController } from "../controllers/auth.controller";
import { IAuthMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import { asyncHandler } from "../middlewares/async-handler.middleware";
import { loginSchema, resetPasswordSchema, signupSchema, verifyEmailSchema } from "../validators/auth.validator";
import { emailSchema } from "../validators/common.validator";
import { createRateLimiter } from "../middlewares/rate-limit.middleware";

const authRateLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 30, message: "Too many authentication requests. Please try again in 15 minutes." });

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
    this.router.post("/signup", authRateLimiter, validate(signupSchema), asyncHandler(this.authController.signup));
    this.router.post("/email/verify", authRateLimiter, validate(verifyEmailSchema), asyncHandler(this.authController.verifyUserEmail));
    this.router.post(
      "/email/request-verification",
      authRateLimiter,
      asyncHandler(this.authMiddleware.requireUser),
      asyncHandler(this.authController.requestEmailVerification)
    );
    this.router.post("/login", authRateLimiter, validate(loginSchema), asyncHandler(this.authController.login));
    this.router.post("/forgot-password", authRateLimiter, validate(emailSchema), asyncHandler(this.authController.forgotPassword));
    this.router.post("/reset-password", authRateLimiter, validate(resetPasswordSchema), asyncHandler(this.authController.resetPassword));
    this.router.post("/resend-otp", authRateLimiter, validate(emailSchema), asyncHandler(this.authController.resendOTP));
  }
}
