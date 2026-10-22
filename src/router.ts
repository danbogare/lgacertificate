import express, { Router } from "express";
import { schemas, validate } from "./middlewares/validator";
import AuthController from "./controllers/authController";
import ApplicationController from "./controllers/applicationController";
import { adminAuthMiddleware, authMiddleware } from "./middlewares/authMiddleware";
import AdminController from "./controllers/adminController";
import CertificateController from "./controllers/certificateController";
import UtilController from "./controllers/utilController";
import SignatoryController from "./controllers/signatoryController";
import upload from "./utils/multer";
import { webhookSignatureGuard } from "./middlewares/webhookMiddleware";
import { rawBodySaver } from "./middlewares/raw-body.middleware";
import WebhookController from "./controllers/webhookController";
import PartnerController from "./controllers/partnerController";

const router = Router();

// Auth Routers
router.post("/auth/signup", validate(schemas.createUserSchema), AuthController.signup);
router.post("/auth/email/verify", validate(schemas.verifyUserEmailSchema), AuthController.verifyUserEmail);
router.post("/auth/email/request-verification", authMiddleware, AuthController.requestEmailVerification);
router.post("/auth/login", validate(schemas.loginUserSchema), AuthController.login);
router.post("/auth/forgot-password", validate(schemas.forgotPasswordSchema), AuthController.forgotPassword);
router.post("/auth/reset-password", validate(schemas.resetPasswordSchema), AuthController.resetPassword);
router.post("/auth/resend-otp", validate(schemas.forgotPasswordSchema), AuthController.resendOTP);

// Application Routers
router.post("/application", 
    authMiddleware, 
    upload.fields([
        { name: "passport", maxCount: 1 },
        { name: "docFromCommunityHead", maxCount: 1 },
    ]), 
    validate(schemas.createApplicationSchema),
    ApplicationController.createApplication
);

router.post("/application/partner", 
    authMiddleware, 
    upload.fields([
        { name: "passport", maxCount: 1 },
        { name: "docFromCommunityHead", maxCount: 1 },
    ]), 
    validate(schemas.createApplicationSchema),
    ApplicationController.createPartnerApplication
);
router.get("/application", authMiddleware, ApplicationController.getUserApplications);
router.get("/application/payment/verify", ApplicationController.verifyPayment);

// Super Admin Routers
router.post("/admin/signup", adminAuthMiddleware, validate(schemas.createAdminSchema), AdminController.signup);

// Admin Routers
router.post("/admin/login", validate(schemas.loginUserSchema), AdminController.login);
router.post("/admin/change-password", adminAuthMiddleware, validate(schemas.changePasswordSchema), AdminController.changePassword);
router.post("/admin/forgot-password", validate(schemas.forgotPasswordSchema), AdminController.forgotPassword);
router.post("/admin/reset-password", validate(schemas.resetPasswordSchema), AdminController.resetPassword);
router.post("/admin/resend-otp", validate(schemas.resetPasswordSchema), AdminController.resendOTP);
router.post("/admin/application/:id", adminAuthMiddleware, validate(schemas.rejectionReasonSchema), ApplicationController.approveApplicationsByAdmin);
router.get("/admin/applications", adminAuthMiddleware, ApplicationController.getFilteredApplications);
router.get("/admin/applications/pending", adminAuthMiddleware, ApplicationController.getPendingApplications);
router.get("/admin/applications/approved", adminAuthMiddleware, ApplicationController.getApprovedApplications);
router.get("/admin/applications/rejected", adminAuthMiddleware, ApplicationController.getRejectedApplications);
router.get("/admin/summary/application", adminAuthMiddleware, ApplicationController.getApplicationSummary);
router.post("/admin/download/application", adminAuthMiddleware, ApplicationController.downloadApplicationReport);

// Certificate Routers
router.post("/certificate/request-verification/:id", authMiddleware, validate(schemas.forgotPasswordSchema), CertificateController.requestVerificationCode);
router.post("/certificate/partner/request-verification/:id", authMiddleware, validate(schemas.forgotPasswordSchema), CertificateController.partnerRequestVerificationCode);
router.get("/certificate/payment/verify", CertificateController.verifyCertificateVerificationCodePayment);
router.get("/certificate/verify", CertificateController.confirmVerificationCode);
router.get("/certificate/verify-hash/:hash", CertificateController.verifyCertificateHash);
router.get("/certificate/:applicationId", authMiddleware, CertificateController.getCertificateByApplicationId);
router.get("/certificate/:id", authMiddleware, CertificateController.getCertificateById);
router.get("/certificate/admin/:id", adminAuthMiddleware, CertificateController.getCertificateById);
router.get("/certificates/admin", adminAuthMiddleware, CertificateController.getCertificatesByAdmin);
router.get("/certificates", authMiddleware, CertificateController.getCertificates);
router.delete("/certificate/nullify-verification", CertificateController.nullifyVerificationCode);
router.put("/certificate/revoke/:id", adminAuthMiddleware, validate(schemas.revocationReasonSchema), CertificateController.revokeCertificate);

// Util Routers
// GET states and LGAs
router.get("/states", UtilController.getAllStates);
router.get("/lgas", UtilController.getLGA);

// Signatory Routers
router.get("/signatory/:lga", SignatoryController.getSignatory);
router.post("/signatory", 
    adminAuthMiddleware, 
    upload.fields([
        { name: "chairmanSignature", maxCount: 1 },
        { name: "secretarySignature", maxCount: 1 },
    ]),
    validate(schemas.createSignatorySchema), 
    SignatoryController.createSignatory
);
router.put("/signatory", 
    adminAuthMiddleware, 
    upload.fields([
        { name: "chairmanSignature", maxCount: 1 },
        { name: "secretarySignature", maxCount: 1 },
    ]),
    validate(schemas.createSignatorySchema), 
    SignatoryController.updateSignatory);
router.delete("/signatory/:lga", adminAuthMiddleware, SignatoryController.deleteSignatory);

// webhook Routers
router.post(
    '/partner/webhook',
    express.json({ verify: rawBodySaver }),
    webhookSignatureGuard,
    WebhookController.handlePartnerEvent
);

// confirmation of partner transaction
router.post(
    '/partner/transaction/:sourceId',
    authMiddleware,
    PartnerController.getPartnerTransaction
);



export default router;