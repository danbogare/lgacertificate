import { Router } from "express";
import { ICertificateController } from "../controllers/certificate.controller";
import { IAuthMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import { asyncHandler } from "../middlewares/async-handler.middleware";
import { emailSchema } from "../validators/common.validator";
import { revocationReasonSchema } from "../validators/certificate.validator";

// Mounted at /api/v1 because the routes span both /certificate and /certificates
export class CertificateRouter {
  private readonly router = Router();

  constructor(
    private readonly certificateController: ICertificateController,
    private readonly authMiddleware: IAuthMiddleware
  ) {
    this.initializeRoutes();
  }

  public getRouter(): Router {
    return this.router;
  }

  private initializeRoutes(): void {
    const requireUser = asyncHandler(this.authMiddleware.requireUser);
    const requireAdmin = asyncHandler(this.authMiddleware.requireAdmin);

    this.router.post(
      "/certificate/request-verification/:id",
      requireUser,
      validate(emailSchema),
      asyncHandler(this.certificateController.requestVerificationCode)
    );
    this.router.post(
      "/certificate/partner/request-verification/:id",
      requireUser,
      validate(emailSchema),
      asyncHandler(this.certificateController.partnerRequestVerificationCode)
    );

    // Public: payment redirect and third-party verification
    this.router.get("/certificate/payment/verify", asyncHandler(this.certificateController.verifyVerificationPayment));
    this.router.get("/certificate/verify", asyncHandler(this.certificateController.confirmVerificationCode));
    this.router.get("/certificate/verify-hash/:hash", asyncHandler(this.certificateController.verifyCertificateHash));

    // Applicants can pass either an application id or a certificate id
    this.router.get(
      "/certificate/:applicationId",
      requireUser,
      asyncHandler(this.certificateController.getCertificateByApplicationId)
    );
    this.router.get("/certificate/admin/:id", requireAdmin, asyncHandler(this.certificateController.getCertificateById));
    this.router.get("/certificates/admin", requireAdmin, asyncHandler(this.certificateController.getCertificatesByAdmin));
    this.router.get("/certificates", requireUser, asyncHandler(this.certificateController.getCertificates));
    this.router.delete(
      "/certificate/nullify-verification",
      asyncHandler(this.certificateController.nullifyVerificationCode)
    );
    this.router.put(
      "/certificate/revoke/:id",
      requireAdmin,
      validate(revocationReasonSchema),
      asyncHandler(this.certificateController.revokeCertificate)
    );
  }
}
