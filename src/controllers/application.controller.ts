import { Request, Response } from "express";
import { IApplicationService } from "../services/application.service";
import { ApplicationStatus } from "../models/application.model";
import { IUser } from "../models/user.model";
import { IAdmin } from "../models/admin.model";
import { IApplicationListQuery } from "../interfaces/application.interface";
import { IPaymentRedirectQuery } from "../interfaces/payment.interface";
import { pickUploadedFiles } from "../middlewares/upload.middleware";
import { successResponse } from "../utils/response";
import { getAuditContext } from "../utils/request";

export interface IApplicationController {
  createApplication: (req: Request, res: Response) => Promise<void>;
  createPartnerApplication: (req: Request, res: Response) => Promise<void>;
  retryApplicationPayment: (req: Request, res: Response) => Promise<void>;
  retryPartnerApplicationPayment: (req: Request, res: Response) => Promise<void>;
  verifyPayment: (req: Request, res: Response) => Promise<void>;
  getUserApplications: (req: Request, res: Response) => Promise<void>;
  getPendingApplications: (req: Request, res: Response) => Promise<void>;
  getApprovedApplications: (req: Request, res: Response) => Promise<void>;
  getRejectedApplications: (req: Request, res: Response) => Promise<void>;
  reviewApplication: (req: Request, res: Response) => Promise<void>;
  getApplicationSummary: (req: Request, res: Response) => Promise<void>;
  getFilteredApplications: (req: Request, res: Response) => Promise<void>;
  downloadApplicationReport: (req: Request, res: Response) => Promise<void>;
}

const APPLICATION_UPLOAD_FIELDS = ["passport", "docFromCommunityHead"] as const;

export class ApplicationController implements IApplicationController {
  constructor(private readonly applicationService: IApplicationService) {}

  public createApplication = async (req: Request, res: Response): Promise<void> => {
    const uploads = pickUploadedFiles(req.files, APPLICATION_UPLOAD_FIELDS);

    const result = await this.applicationService.createApplication(req.user as IUser, req.body, uploads);

    successResponse(res, "redirect to payment link", result);
  };

  public createPartnerApplication = async (req: Request, res: Response): Promise<void> => {
    const uploads = pickUploadedFiles(req.files, APPLICATION_UPLOAD_FIELDS);

    const result = await this.applicationService.createPartnerApplication(req.user as IUser, req.body, uploads);

    successResponse(res, "Dynamic partner account created successfully.", result);
  };

  public retryApplicationPayment = async (req: Request, res: Response): Promise<void> => {
    const result = await this.applicationService.retryApplicationPayment(req.user as IUser, req.params.id as string);

    successResponse(res, "redirect to payment link", result);
  };

  public retryPartnerApplicationPayment = async (req: Request, res: Response): Promise<void> => {
    const result = await this.applicationService.retryPartnerApplicationPayment(
      req.user as IUser,
      req.params.id as string
    );

    successResponse(res, "Dynamic partner account created successfully.", result);
  };

  // Flutterwave redirects the applicant here after checkout
  public verifyPayment = async (req: Request, res: Response): Promise<void> => {
    const result = await this.applicationService.verifyPayment(req.query as IPaymentRedirectQuery);

    if (result.alreadyVerified) {
      successResponse(res, "transaction successful", { transaction: result.transaction });
      return;
    }

    res.redirect(result.redirectUrl);
  };

  public getUserApplications = async (req: Request, res: Response): Promise<void> => {
    const applications = await this.applicationService.getUserApplications(req.user as IUser);

    successResponse(res, "applications retrieved successfully", { applications });
  };

  public getPendingApplications = async (req: Request, res: Response): Promise<void> => {
    const applications = await this.applicationService.getApplicationsByStatus(
      req.admin as IAdmin,
      ApplicationStatus.PENDING
    );

    successResponse(res, "pending application retrieved successfully", { applications });
  };

  public getApprovedApplications = async (req: Request, res: Response): Promise<void> => {
    const applications = await this.applicationService.getApplicationsByStatus(
      req.admin as IAdmin,
      ApplicationStatus.APPROVED
    );

    successResponse(res, "approved application retrieved successfully", { applications });
  };

  public getRejectedApplications = async (req: Request, res: Response): Promise<void> => {
    const applications = await this.applicationService.getApplicationsByStatus(
      req.admin as IAdmin,
      ApplicationStatus.REJECTED
    );

    successResponse(res, "rejected application retrieved successfully", { applications });
  };

  // ?approve=true approves; anything else rejects and requires a rejectionReason
  public reviewApplication = async (req: Request, res: Response): Promise<void> => {
    const result = await this.applicationService.reviewApplication(
      req.admin as IAdmin,
      req.params.id as string,
      req.query.approve === "true",
      req.body.rejectionReason,
      getAuditContext(req)
    );

    if (result.approved) {
      successResponse(res, "application approved successfully", {
        certificateHash: result.certificateHash,
        application: result.application,
      });
      return;
    }

    successResponse(res, "application rejected successfully", { application: result.application });
  };

  public getApplicationSummary = async (req: Request, res: Response): Promise<void> => {
    const summary = await this.applicationService.getApplicationSummary(
      req.admin as IAdmin,
      req.query.lga as string | undefined,
      req.query.state as string | undefined
    );

    successResponse(res, "summary retrieved successfully", { summary });
  };

  public getFilteredApplications = async (req: Request, res: Response): Promise<void> => {
    const result = await this.applicationService.getFilteredApplications(
      req.admin as IAdmin,
      req.query as IApplicationListQuery,
      getAuditContext(req)
    );

    if (Array.isArray(result)) {
      successResponse(res, "filtered application(s) retrieved successfully", result);
      return;
    }

    successResponse(res, "filtered applications retrieved successfully", result);
  };

  public downloadApplicationReport = async (req: Request, res: Response): Promise<void> => {
    const { status, startDate, endDate, email, lga, state } = req.body;

    await this.applicationService.sendApplicationReport(
      req.admin as IAdmin,
      { status, startDate, endDate, email, lga, state },
      getAuditContext(req)
    );

    successResponse(res, "applications sent to email for download", {});
  };
}
