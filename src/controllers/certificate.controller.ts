import { Request, Response } from "express";
import { ICertificateService } from "../services/certificate.service";
import { IUser } from "../models/user.model";
import { IAdmin } from "../models/admin.model";
import { IPaymentRedirectQuery } from "../interfaces/payment.interface";
import { successResponse } from "../utils/response";
import { getAuditContext } from "../utils/request";

export interface ICertificateController {
  requestVerificationCode: (req: Request, res: Response) => Promise<void>;
  partnerRequestVerificationCode: (req: Request, res: Response) => Promise<void>;
  verifyVerificationPayment: (req: Request, res: Response) => Promise<void>;
  confirmVerificationCode: (req: Request, res: Response) => Promise<void>;
  verifyCertificateHash: (req: Request, res: Response) => Promise<void>;
  getCertificateByApplicationId: (req: Request, res: Response) => Promise<void>;
  getCertificateById: (req: Request, res: Response) => Promise<void>;
  getCertificatesByAdmin: (req: Request, res: Response) => Promise<void>;
  getCertificates: (req: Request, res: Response) => Promise<void>;
  nullifyVerificationCode: (req: Request, res: Response) => Promise<void>;
  revokeCertificate: (req: Request, res: Response) => Promise<void>;
}

export class CertificateController implements ICertificateController {
  constructor(private readonly certificateService: ICertificateService) {}

  public requestVerificationCode = async (req: Request, res: Response): Promise<void> => {
    const result = await this.certificateService.requestVerificationCode(
      req.user as IUser,
      req.params.id as string,
      req.body.email
    );

    successResponse(res, "redirect to payment link", result);
  };

  public partnerRequestVerificationCode = async (req: Request, res: Response): Promise<void> => {
    const result = await this.certificateService.partnerRequestVerificationCode(
      req.user as IUser,
      req.params.id as string,
      req.body.email
    );

    successResponse(res, "Dynamic partner account created successfully.", result);
  };

  // Flutterwave redirects the payer here after checkout
  public verifyVerificationPayment = async (req: Request, res: Response): Promise<void> => {
    const result = await this.certificateService.verifyVerificationPayment(req.query as IPaymentRedirectQuery);

    if (result.alreadyVerified) {
      successResponse(res, "transaction successful", { transaction: result.transaction });
      return;
    }

    res.redirect(result.redirectUrl);
  };

  public confirmVerificationCode = async (req: Request, res: Response): Promise<void> => {
    const result = await this.certificateService.confirmVerificationCode(String(req.query.code || ""));

    successResponse(res, "Certificate verified", result);
  };

  public verifyCertificateHash = async (req: Request, res: Response): Promise<void> => {
    const isValid = await this.certificateService.isCertificateHashValid(req.params.hash as string);

    if (!isValid) {
      successResponse(res, "Certificate not found or invalid", { certificateValid: false });
      return;
    }

    successResponse(res, "Certificate verified", { certificateValid: true });
  };

  public getCertificateByApplicationId = async (req: Request, res: Response): Promise<void> => {
    const certificate = await this.certificateService.getCertificateByApplicationId(
      req.user as IUser,
      req.params.applicationId as string
    );

    successResponse(res, "Certificates retrieved successfully", { certificate });
  };

  public getCertificateById = async (req: Request, res: Response): Promise<void> => {
    const certificate = await this.certificateService.getCertificateById(req.params.id as string, {
      admin: req.admin,
    });

    successResponse(res, "Certificate retrieved successfully", { certificate });
  };

  public getCertificatesByAdmin = async (req: Request, res: Response): Promise<void> => {
    const certificates = await this.certificateService.getCertificatesForAdmin(req.admin as IAdmin);

    successResponse(res, "Certificates retrieved successfully", { certificates });
  };

  public getCertificates = async (req: Request, res: Response): Promise<void> => {
    const certificates = await this.certificateService.getUserCertificates(req.user as IUser);

    successResponse(res, "Certificates retrieved successfully", { certificates });
  };

  public nullifyVerificationCode = async (req: Request, res: Response): Promise<void> => {
    await this.certificateService.nullifyVerificationCode(String(req.query.ref || ""));

    successResponse(res, "Verification Code nullified successfully", {});
  };

  public revokeCertificate = async (req: Request, res: Response): Promise<void> => {
    await this.certificateService.revokeCertificate(
      req.admin as IAdmin,
      req.params.id as string,
      req.body.revocationReason,
      getAuditContext(req)
    );

    successResponse(res, "Certificate revoked", { certificateValid: false, isRevoked: true });
  };
}
