import mongoose, { ClientSession, FilterQuery } from "mongoose";
import { ApplicationStatus, IApplication } from "../models/application.model";
import { IUser } from "../models/user.model";
import { IAdmin } from "../models/admin.model";
import { TransactionType } from "../models/transaction.model";
import { IApplicationRepository } from "../repositories/application.repository";
import { IUserRepository } from "../repositories/user.repository";
import { ICertificateService } from "./certificate.service";
import {
  IFlutterwaveCheckoutResult,
  IPartnerCheckoutResult,
  IPartnerPayer,
  IPaymentService,
} from "./payment.service";
import { ICloudinaryService } from "./storage.service";
import { IMailService } from "./mail.service";
import { IAuditService } from "./audit.service";
import { IAuditContext } from "../interfaces/audit.interface";
import { AuditAction, AuditTargetType } from "../models/auditLog.model";
import {
  IApplicationFilters,
  IApplicationListQuery,
  IApplicationSummary,
  IApplicationUploads,
  ICreateApplicationPayload,
} from "../interfaces/application.interface";
import { IPaymentRedirectQuery, PaymentVerificationResult } from "../interfaces/payment.interface";
import { BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError } from "../errors/error";
import { HOME_STATE, getLgas, isValidLga, isValidState } from "../utils/states";
import { getLgaCode } from "../utils/lga-codes";
import { isIssuingOfficial, isSuperAdmin, lgaApplicationsFilter, officialLgaFilter } from "../utils/admin-scope";
import { formatDateTimeForFilename, isValidDateFormat, isValidEmail, splitFullNames } from "../utils/format";
import { runInTransaction } from "../utils/transaction";

export interface IApplicationServiceConfig {
  applicationAmount: number;
  apiUrl: string;
  frontendUrl: string;
}

export interface IPaginatedApplications {
  total: number;
  page: number;
  limit: number;
  data: IApplication[];
}

export type ApplicationReviewResult =
  | { approved: true; certificateHash: string; application: IApplication }
  | { approved: false; application: IApplication };

export interface IApplicationService {
  createApplication(
    user: IUser,
    payload: ICreateApplicationPayload,
    uploads: IApplicationUploads
  ): Promise<{ txRef: string; paymentLink: string }>;
  createPartnerApplication(
    user: IUser,
    payload: ICreateApplicationPayload,
    uploads: IApplicationUploads
  ): Promise<{ applicationId: unknown; paymentData: unknown }>;
  retryApplicationPayment(user: IUser, applicationId: string): Promise<{ txRef: string; paymentLink: string }>;
  retryPartnerApplicationPayment(
    user: IUser,
    applicationId: string
  ): Promise<{ applicationId: unknown; paymentData: unknown }>;
  verifyPayment(query: IPaymentRedirectQuery): Promise<PaymentVerificationResult>;
  getUserApplications(user: IUser): Promise<IApplication[]>;
  getApplicationsByStatus(admin: IAdmin, status: ApplicationStatus): Promise<IApplication[]>;
  reviewApplication(
    admin: IAdmin,
    applicationId: string,
    approve: boolean,
    rejectionReason: string | undefined,
    context: IAuditContext
  ): Promise<ApplicationReviewResult>;
  getApplicationSummary(admin: IAdmin, lga?: string, state?: string): Promise<IApplicationSummary>;
  getFilteredApplications(
    admin: IAdmin,
    query: IApplicationListQuery,
    context: IAuditContext
  ): Promise<IApplication[] | IPaginatedApplications>;
  sendApplicationReport(
    admin: IAdmin,
    filters: IApplicationFilters & { email?: unknown },
    context: IAuditContext
  ): Promise<void>;
  markAsPaid(application: IApplication): boolean;
}

const OGUN_ORIGIN_FIELDS = [
  "fatherNames",
  "motherNames",
  "nativeTown",
  "nativePoliticalWard",
  "nativePollingUnit",
  "village",
  "communityHead",
  "communityHeadContact",
] as const;

const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/jpg"];

interface IValidatedApplication {
  passportFile: Express.Multer.File;
  docFile?: Express.Multer.File;
  dateOfBirth: Date;
  isResidentOfOgun: boolean;
}

export class ApplicationService implements IApplicationService {
  constructor(
    private readonly applicationRepository: IApplicationRepository,
    private readonly userRepository: IUserRepository,
    private readonly certificateService: ICertificateService,
    private readonly paymentService: IPaymentService,
    private readonly storageService: ICloudinaryService,
    private readonly mailService: IMailService,
    private readonly auditService: IAuditService,
    private readonly config: IApplicationServiceConfig
  ) {}

  public async createApplication(user: IUser, payload: ICreateApplicationPayload, uploads: IApplicationUploads) {
    const validated = await this.validateNewApplication(payload, uploads);
    const files = await this.uploadApplicationFiles(validated);

    const checkout = await this.startFlutterwaveCheckout(user, payload.fullNames);

    await runInTransaction(async (session) => {
      const application = await this.applicationRepository.create(
        { ...this.buildApplication(user, payload, validated, files), pendingPaymentLink: checkout.paymentLink },
        session
      );
      await this.recordFlutterwaveTransaction(user, application, checkout, session);
    });

    return { txRef: checkout.transactionRef, paymentLink: checkout.paymentLink };
  }

  // Same as createApplication, but paid by bank transfer to a partner-issued account
  public async createPartnerApplication(user: IUser, payload: ICreateApplicationPayload, uploads: IApplicationUploads) {
    const payer = this.getPartnerPayer(payload.fullNames);
    const validated = await this.validateNewApplication(payload, uploads);
    const files = await this.uploadApplicationFiles(validated);

    const checkout = await this.paymentService.startPartnerCheckout(payer, this.config.applicationAmount);

    const application = await runInTransaction(async (session) => {
      const application = await this.applicationRepository.create(
        { ...this.buildApplication(user, payload, validated, files), pendingPaymentLink: null },
        session
      );
      await this.recordPartnerTransaction(user, application, checkout, session);
      return application;
    });

    return { applicationId: application._id, paymentData: checkout.paymentData };
  }

  // Lets the applicant pay again for an application whose earlier payment was abandoned or expired
  public async retryApplicationPayment(user: IUser, applicationId: string) {
    const application = await this.findUnpaidApplication(user, applicationId);
    const checkout = await this.startFlutterwaveCheckout(user, application.fullNames);

    await runInTransaction(async (session) => {
      application.pendingPaymentLink = checkout.paymentLink;
      await this.applicationRepository.save(application, session);
      await this.recordFlutterwaveTransaction(user, application, checkout, session);
    });

    return { txRef: checkout.transactionRef, paymentLink: checkout.paymentLink };
  }

  public async retryPartnerApplicationPayment(user: IUser, applicationId: string) {
    const application = await this.findUnpaidApplication(user, applicationId);
    const payer = this.getPartnerPayer(application.fullNames);

    const checkout = await this.paymentService.startPartnerCheckout(payer, this.config.applicationAmount);

    await runInTransaction(async (session) => {
      application.pendingPaymentLink = null;
      await this.applicationRepository.save(application, session);
      await this.recordPartnerTransaction(user, application, checkout, session);
    });

    return { applicationId: application._id, paymentData: checkout.paymentData };
  }

  public async verifyPayment(query: IPaymentRedirectQuery): Promise<PaymentVerificationResult> {
    const verification = await this.paymentService.verifyFlutterwavePayment(query);
    if (verification.alreadyVerified) {
      return { alreadyVerified: true, transaction: verification.transaction };
    }

    const application = await runInTransaction(async (session) => {
      await this.paymentService.markTransactionSuccessful(verification, session);

      const application = await this.applicationRepository.findById(verification.transaction.application);
      if (!application) throw new NotFoundError("application not found");

      this.markAsPaid(application);
      return await this.applicationRepository.save(application, session);
    });

    const user = await this.userRepository.findById(application.user);
    if (!user) throw new BadRequestError("user not found");

    this.mailService.sendApplicationAwaitingApprovalEmail(
      user.email,
      `${user.firstName} ${user.lastName}`,
      String(application._id)
    );

    return {
      alreadyVerified: false,
      redirectUrl: `${this.config.frontendUrl}/successful?ref=${verification.transaction.transactionRef}`,
    };
  }

  public async getUserApplications(user: IUser): Promise<IApplication[]> {
    return await this.applicationRepository.findByUser(user._id);
  }

  public async getApplicationsByStatus(admin: IAdmin, status: ApplicationStatus): Promise<IApplication[]> {
    const filter: FilterQuery<IApplication> = isSuperAdmin(admin)
      ? { status }
      : { status, ...officialLgaFilter(admin) };

    return await this.applicationRepository.find(filter, {
      populateUser: status === ApplicationStatus.APPROVED,
    });
  }

  public async reviewApplication(
    admin: IAdmin,
    applicationId: string,
    approve: boolean,
    rejectionReason: string | undefined,
    context: IAuditContext
  ): Promise<ApplicationReviewResult> {
    const application = await this.applicationRepository.findById(applicationId);
    if (!application) throw new NotFoundError("application not found");

    if (!isIssuingOfficial(admin, application)) {
      throw new BadRequestError(
        "request revoked: officials can only approve applications relating to their respective LGA"
      );
    }

    if (application.status === ApplicationStatus.APPROVED) throw new BadRequestError("application already approved");
    if (application.status === ApplicationStatus.REJECTED) throw new BadRequestError("application already rejected");
    if (application.status === ApplicationStatus.PENDING_PAYMENT) {
      throw new BadRequestError("application payment not yet completed");
    }

    const user = await this.userRepository.findById(application.user);
    if (!user) throw new BadRequestError("user not found");

    const applicantName = `${user.firstName} ${user.lastName}`;

    if (approve) {
      try {
        getLgaCode(application.stateOfOrigin, application.lga);
      } catch {
        throw new BadRequestError("Certificate numbering is not configured for this LGA");
      }

      // Counter, certificate and application update commit together or not at all
      const { certificateRef, certificateHash } = await runInTransaction(async (session) => {
        application.status = ApplicationStatus.APPROVED;
        application.pendingApprovalRejectionDate = new Date();
        application.approvedBy = admin._id as any;

        const certificate = await this.certificateService.issueCertificate(application, session);
        await this.applicationRepository.save(application, session);
        return certificate;
      });

      this.mailService.sendApplicationApprovedEmail(user.email, applicantName, String(application._id));

      await this.auditService.record(
        {
          admin: admin._id as any,
          action: AuditAction.APPLICATION_APPROVED,
          target: { type: AuditTargetType.APPLICATION, id: application._id },
          details: { certificateRef, applicantName },
        },
        context
      );

      return { approved: true, certificateHash, application };
    }

    if (!rejectionReason) throw new BadRequestError("rejection reason is required");

    application.status = ApplicationStatus.REJECTED;
    application.pendingApprovalRejectionDate = new Date();
    application.rejectedBy = admin._id as any;
    await this.applicationRepository.save(application);

    this.mailService.sendApplicationRejectedEmail(user.email, applicantName, String(application._id), rejectionReason);

    await this.auditService.record(
      {
        admin: admin._id as any,
        action: AuditAction.APPLICATION_REJECTED,
        target: { type: AuditTargetType.APPLICATION, id: application._id },
        details: { rejectionReason, applicantName },
      },
      context
    );

    return { approved: false, application };
  }

  // Officials always see their own LGA; the super admin can narrow down to any state/LGA
  public async getApplicationSummary(admin: IAdmin, lga?: string, state?: string): Promise<IApplicationSummary> {
    const selectedState = state || admin.stateOfOrigin;
    const match: FilterQuery<IApplication> = {};

    if (lga) {
      if (!isSuperAdmin(admin)) throw new UnauthorizedError();
      if (!getLgas(selectedState)) throw new BadRequestError("Invalid state");
      if (!isValidLga(selectedState, lga)) throw new BadRequestError(`Invalid LGA for ${selectedState} State`);

      match.stateOfOrigin = selectedState;
      match.lga = lga;
    }

    if (!isSuperAdmin(admin)) {
      match.stateOfOrigin = admin.stateOfOrigin;
      match.lga = admin.lga;
    }

    return await this.applicationRepository.getSummary(match);
  }

  // A name search returns every match unpaginated; otherwise results are paginated
  // and, when an email is given, also sent there as a CSV report
  public async getFilteredApplications(
    admin: IAdmin,
    query: IApplicationListQuery,
    context: IAuditContext
  ): Promise<IApplication[] | IPaginatedApplications> {
    const { name, email, page = 1, limit = 10 } = query;

    if (name) {
      const filter: FilterQuery<IApplication> = {
        ...this.scopeFilter(admin, query),
        fullNames: { $regex: name, $options: "i" },
      };
      const applications = await this.applicationRepository.find(filter, { populateUser: true });
      if (!applications.length) throw new NotFoundError("Not Found");
      return applications;
    }

    const filter = this.buildReportFilter(admin, query);
    const skip = (Number(page) - 1) * Number(limit);

    const [applications, total] = await Promise.all([
      this.applicationRepository.find(filter, { populateUser: true, skip, limit: Number(limit) }),
      this.applicationRepository.count(filter),
    ]);

    if (email) {
      this.mailService.sendApplicationReportEmail(
        email,
        applications,
        `application_${formatDateTimeForFilename(new Date())}.csv`
      );
      await this.recordReportExport(admin, email, query, applications.length, context);
    }

    return { total, page: Number(page), limit: Number(limit), data: applications };
  }

  public async sendApplicationReport(
    admin: IAdmin,
    filters: IApplicationFilters & { email?: unknown },
    context: IAuditContext
  ): Promise<void> {
    const { email } = filters;
    if (!email) throw new BadRequestError("Email is required");
    if (typeof email !== "string" || !isValidEmail(email)) throw new BadRequestError("Invalid email address");

    const filter = this.buildReportFilter(admin, filters);
    const applications = await this.applicationRepository.find(filter, { populateUser: true });

    this.mailService.sendApplicationReportEmail(
      email,
      applications,
      `report_${formatDateTimeForFilename(new Date())}.csv`
    );
    await this.recordReportExport(admin, email, filters, applications.length, context);
  }

  // Reports carry applicants' personal data out of the system, so record who sent what where
  private async recordReportExport(
    admin: IAdmin,
    recipient: string,
    filters: IApplicationFilters,
    applicationCount: number,
    context: IAuditContext
  ): Promise<void> {
    const { status, startDate, endDate, lga, state } = filters;
    await this.auditService.record(
      {
        admin: admin._id as any,
        action: AuditAction.REPORT_EXPORTED,
        details: { recipient, status, startDate, endDate, lga: lga ?? admin.lga, state, applicationCount },
      },
      context
    );
  }

  // Payment received: the application moves to the officials' review queue. Returns false when it was
  // already paid, so a second payment (e.g. an old account paid late) never reopens a reviewed application.
  public markAsPaid(application: IApplication): boolean {
    if (application.status !== ApplicationStatus.PENDING_PAYMENT) return false;

    application.status = ApplicationStatus.PENDING;
    application.pendingApprovalRejectionDate = new Date();
    application.pendingPaymentLink = null;
    return true;
  }

  private async findUnpaidApplication(user: IUser, applicationId: string): Promise<IApplication> {
    if (!mongoose.isValidObjectId(applicationId)) throw new BadRequestError("Invalid application id");

    const application = await this.applicationRepository.findById(applicationId);
    if (!application || application.user.toString() !== String(user._id)) {
      throw new NotFoundError("application not found");
    }
    if (application.status !== ApplicationStatus.PENDING_PAYMENT) {
      throw new BadRequestError("application has already been paid for");
    }
    return application;
  }

  // The partner names the dynamic account after the payer, so both names are required
  private getPartnerPayer(fullNames?: string | null): IPartnerPayer {
    const payer = splitFullNames(fullNames);
    if (!payer.firstName || !payer.lastName) throw new BadRequestError("Invalid full names");
    return payer;
  }

  private async startFlutterwaveCheckout(user: IUser, fullNames: string): Promise<IFlutterwaveCheckoutResult> {
    return await this.paymentService.startFlutterwaveCheckout({
      amount: this.config.applicationAmount,
      redirectUrl: `${this.config.apiUrl}/api/v1/application/payment/verify`,
      title: "LGA Certificate Application Payment",
      customer: { email: user.email, name: fullNames, phone: user.phone },
    });
  }

  private async recordFlutterwaveTransaction(
    user: IUser,
    application: IApplication,
    checkout: IFlutterwaveCheckoutResult,
    session: ClientSession
  ): Promise<void> {
    await this.paymentService.recordTransaction(
      {
        transactionRef: checkout.transactionRef,
        amount: checkout.amount.toString(),
        transactionType: TransactionType.APPLICATION,
        user: user._id as any,
        application: application._id as any,
      },
      session
    );
  }

  private async recordPartnerTransaction(
    user: IUser,
    application: IApplication,
    checkout: IPartnerCheckoutResult,
    session: ClientSession
  ): Promise<void> {
    await this.paymentService.recordPartnerTransaction(
      {
        payerId: user._id as any,
        paymentRef: checkout.accountNumber,
        accountName: checkout.accountName,
        amount: checkout.amount.toString(),
        transactionType: TransactionType.APPLICATION,
        applicationId: application._id as any,
      },
      session
    );
  }

  // Checks run in the same order applicants have always seen the errors
  private async validateNewApplication(
    payload: ICreateApplicationPayload,
    uploads: IApplicationUploads
  ): Promise<IValidatedApplication> {
    const { passport: passportFile, docFromCommunityHead: docFile } = uploads;
    const { stateOfOrigin, lga, lgaOfResident } = payload;

    if (!passportFile) throw new BadRequestError("Passport is required");
    if (!IMAGE_MIME_TYPES.includes(passportFile.mimetype)) {
      throw new BadRequestError("Passport must be a JPG or PNG image");
    }
    if (docFile && docFile.mimetype !== "application/pdf") {
      throw new BadRequestError("Community head document must be a PDF file");
    }

    if (!payload.dateOfBirth) throw new BadRequestError("Date of birth is required");
    const dateOfBirth = new Date(payload.dateOfBirth);
    if (isNaN(dateOfBirth.getTime())) throw new BadRequestError("Invalid date of birth");
    if (dateOfBirth > new Date()) throw new BadRequestError("Date of birth cannot be in the future");

    if (!isValidState(stateOfOrigin)) throw new BadRequestError("Invalid state of origin");
    if (!isValidLga(stateOfOrigin, lga)) throw new BadRequestError("Invalid LGA for the selected state");

    const isOgunIndigene = stateOfOrigin === HOME_STATE;
    const isResidentOfOgun = payload.isResidentOfOgun === "true" || payload.isResidentOfOgun === true;

    if (!isOgunIndigene && !isResidentOfOgun) {
      throw new BadRequestError("Must be a resident of Ogun State if not from Ogun State");
    }
    if (!isOgunIndigene && !lgaOfResident) {
      throw new BadRequestError("Must enter a LGA of residence of Ogun State if not from Ogun State");
    }
    if (!isOgunIndigene && lgaOfResident && !isValidLga(HOME_STATE, lgaOfResident)) {
      throw new BadRequestError("Invalid LGA of Residence for Ogun state");
    }

    if (isResidentOfOgun) throw new BadRequestError("Certificate of Residency not available yet");

    if (isOgunIndigene) {
      const missing = OGUN_ORIGIN_FIELDS.some((field) => !payload[field]?.toString().trim());
      if (missing) throw new BadRequestError("All fields relating to Ogun State origin are required");
    }

    // One paid application per NIN can await review at a time; unpaid ones don't block a retry
    if (payload.nin && (await this.applicationRepository.findAwaitingReviewByNin(payload.nin))) {
      throw new BadRequestError("Existing application pending");
    }

    return { passportFile, docFile, dateOfBirth, isResidentOfOgun };
  }

  private async uploadApplicationFiles({ passportFile, docFile }: IValidatedApplication) {
    const [passport, doc] = await Promise.all([
      this.storageService.upload(passportFile.buffer, "applications", "image"),
      docFile ? this.storageService.upload(docFile.buffer, "applications", "raw") : Promise.resolve(null),
    ]);
    return { passport, doc };
  }

  private buildApplication(
    user: IUser,
    payload: ICreateApplicationPayload,
    validated: IValidatedApplication,
    files: Awaited<ReturnType<ApplicationService["uploadApplicationFiles"]>>
  ): Partial<IApplication> {
    const isOgunIndigene = payload.stateOfOrigin === HOME_STATE;
    const ogunOnly = (value?: string) => (isOgunIndigene ? value : null);

    return {
      fullNames: payload.fullNames,
      dateOfBirth: validated.dateOfBirth,
      fatherNames: ogunOnly(payload.fatherNames),
      motherNames: ogunOnly(payload.motherNames),
      nativeTown: ogunOnly(payload.nativeTown),
      nativePollingUnit: ogunOnly(payload.nativePollingUnit),
      nativePoliticalWard: ogunOnly(payload.nativePoliticalWard),
      village: ogunOnly(payload.village),
      communityHead: ogunOnly(payload.communityHead),
      communityHeadContact: ogunOnly(payload.communityHeadContact),
      currentAddress: payload.currentAddress,
      lga: payload.lga,
      stateOfOrigin: payload.stateOfOrigin,
      nin: payload.nin,
      passport: files.passport.secureUrl,
      passportPublicId: files.passport.publicId,
      docFromCommunityHead: files.doc?.secureUrl || null,
      docFromCommunityHeadPublicId: files.doc?.publicId || null,
      status: ApplicationStatus.PENDING_PAYMENT,
      user: user._id as any,
      isResidentOfOgun: validated.isResidentOfOgun || null,
      lgaOfResident: isOgunIndigene ? null : payload.lgaOfResident,
    };
  }

  // Officials only ever see their own LGA; the super admin sees every LGA or narrows down to one
  private scopeFilter(admin: IAdmin, { lga, state }: IApplicationFilters): FilterQuery<IApplication> {
    if (!isSuperAdmin(admin)) {
      if (lga && lga !== admin.lga) {
        throw new ForbiddenError("Officials can only view applications relating to their LGA");
      }
      return officialLgaFilter(admin);
    }

    if (!lga) return {};

    const selectedState = state || HOME_STATE;
    if (!getLgas(selectedState)) throw new BadRequestError("Invalid state");
    if (!isValidLga(selectedState, lga)) throw new BadRequestError(`Invalid LGA for ${selectedState} State`);

    return lgaApplicationsFilter(selectedState, lga);
  }

  private buildReportFilter(admin: IAdmin, filters: IApplicationFilters): FilterQuery<IApplication> {
    const { status, startDate, endDate } = filters;
    const filter: FilterQuery<IApplication> = this.scopeFilter(admin, filters);

    if (status) {
      if (!Object.values(ApplicationStatus).includes(status as ApplicationStatus)) {
        throw new BadRequestError("Invalid application status");
      }
      filter.status = status as ApplicationStatus;
    }

    if (startDate || endDate) {
      const dateRange: { $gte?: Date; $lte?: Date } = {};

      if (startDate) {
        if (!isValidDateFormat(startDate)) {
          throw new BadRequestError("Invalid startDate format. Expected YYYY-MM-DD.");
        }
        dateRange.$gte = new Date(`${startDate}T00:00:00.000Z`);
      }

      if (endDate) {
        if (!isValidDateFormat(endDate)) {
          throw new BadRequestError("Invalid endDate format. Expected YYYY-MM-DD.");
        }
        dateRange.$lte = new Date(`${endDate}T23:59:59.999Z`);
      }

      filter.pendingApprovalRejectionDate = dateRange;
    }

    return filter;
  }
}
