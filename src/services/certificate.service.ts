import mongoose, { ClientSession } from "mongoose";
import { IApplication, ApplicationStatus } from "../models/application.model";
import { ICertificate } from "../models/certificate.model";
import { IUser } from "../models/user.model";
import { AdminRole, IAdmin } from "../models/admin.model";
import { TransactionType } from "../models/transaction.model";
import { ICertificateRepository } from "../repositories/certificate.repository";
import { ICounterRepository } from "../repositories/counter.repository";
import { IApplicationRepository } from "../repositories/application.repository";
import { IUserRepository } from "../repositories/user.repository";
import { IPaymentService } from "./payment.service";
import { ICryptoService } from "./crypto.service";
import { IMailService } from "./mail.service";
import { IAuditService } from "./audit.service";
import { IAuditContext } from "../interfaces/audit.interface";
import { AuditAction, AuditTargetType } from "../models/auditLog.model";
import { IPaymentRedirectQuery, PaymentVerificationResult } from "../interfaces/payment.interface";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from "../errors/error";
import { getLgaCode, getStateCode } from "../utils/lga-codes";
import { isIssuingOfficial, isSuperAdmin, officialLgaFilter, reviewerFieldsFor } from "../utils/admin-scope";
import { runInTransaction } from "../utils/transaction";
import { splitFullNames } from "../utils/format";

export interface ICertificateServiceConfig {
  verificationAmount: number;
  apiUrl: string;
  frontendUrl: string;
}

export interface IIssuedCertificate {
  certificateRef: string;
  certificateHash: string;
}

export interface ICertificateViewer {
  user?: IUser;
  admin?: IAdmin;
}

export interface ICertificateService {
  issueCertificate(application: IApplication, session?: ClientSession): Promise<IIssuedCertificate>;
  requestVerificationCode(user: IUser, applicationId: string, email: string): Promise<{ txRef: string; paymentLink: string }>;
  partnerRequestVerificationCode(
    user: IUser,
    applicationId: string,
    email: string
  ): Promise<{ certificateId: unknown; paymentData: unknown }>;
  verifyVerificationPayment(query: IPaymentRedirectQuery): Promise<PaymentVerificationResult>;
  confirmVerificationCode(code: string): Promise<{ ref: string; certificate: ICertificate }>;
  getUserCertificates(user: IUser): Promise<unknown[]>;
  getCertificateByApplicationId(user: IUser, id: string): Promise<unknown>;
  nullifyVerificationCode(ref: string): Promise<void>;
  isCertificateHashValid(hash: string): Promise<boolean>;
  revokeCertificate(admin: IAdmin, id: string, revocationReason: string | undefined, context: IAuditContext): Promise<void>;
  getCertificatesForAdmin(admin: IAdmin): Promise<unknown[]>;
  getCertificateById(id: string, viewer: ICertificateViewer): Promise<unknown>;
  applyVerificationPayment(certificate: ICertificate): void;
}

export class CertificateService implements ICertificateService {
  constructor(
    private readonly certificateRepository: ICertificateRepository,
    private readonly counterRepository: ICounterRepository,
    private readonly applicationRepository: IApplicationRepository,
    private readonly userRepository: IUserRepository,
    private readonly paymentService: IPaymentService,
    private readonly cryptoService: ICryptoService,
    private readonly mailService: IMailService,
    private readonly auditService: IAuditService,
    private readonly config: ICertificateServiceConfig
  ) {}

  // Numbers certificates per LGA, e.g. OG/OWL/CO/000000001
  public async issueCertificate(application: IApplication, session?: ClientSession): Promise<IIssuedCertificate> {
    const stateCode = getStateCode(application.stateOfOrigin);
    const lgaCode = getLgaCode(application.stateOfOrigin, application.lga);
    const sequence = await this.counterRepository.nextCertificateSequence(stateCode, lgaCode, session);
    const certificateRef = `${stateCode}/${lgaCode}/CO/${String(sequence).padStart(9, "0")}`;

    const certificateHash = this.cryptoService.generateCertificateHash({
      certificateRef,
      applicationId: String(application._id),
      userId: application.user.toString(),
    });

    await this.certificateRepository.create(
      { certificateRef, certificateHash, application: application._id as any, user: application.user },
      session
    );

    return { certificateRef, certificateHash };
  }

  public async requestVerificationCode(user: IUser, applicationId: string, email: string) {
    const certificate = await this.findCertificateAwaitingCode(user, applicationId);

    const { transactionRef, amount, paymentLink } = await this.paymentService.startFlutterwaveCheckout({
      amount: this.config.verificationAmount,
      redirectUrl: `${this.config.apiUrl}/api/v1/certificate/payment/verify`,
      title: "LGA Certificate Verification Payment",
      customer: { email: user.email, name: `${user.firstName} ${user.lastName}`, phone: user.phone },
    });

    await runInTransaction(async (session) => {
      certificate.isVerificationPaymentPending = true;
      certificate.pendingPaymentLink = paymentLink;
      certificate.emailOfVerification = email;
      await this.certificateRepository.save(certificate, session);

      await this.paymentService.recordTransaction(
        {
          transactionRef,
          amount: amount.toString(),
          transactionType: TransactionType.CERTIFICATE,
          user: user._id as any,
          certificate: certificate._id as any,
        },
        session
      );
    });

    return { txRef: transactionRef, paymentLink };
  }

  public async partnerRequestVerificationCode(user: IUser, applicationId: string, email: string) {
    const certificate = await this.findCertificateAwaitingCode(user, applicationId);

    const application = await this.applicationRepository.findById(applicationId);
    if (!application) throw new NotFoundError("No application found for user");

    const payer = splitFullNames(application.fullNames);
    if (!payer.firstName || !payer.lastName) throw new BadRequestError("Invalid full names on application");

    const { accountNumber, accountName, amount, paymentData } = await this.paymentService.startPartnerCheckout(
      payer,
      this.config.verificationAmount
    );

    await runInTransaction(async (session) => {
      certificate.isVerificationPaymentPending = true;
      certificate.pendingPaymentLink = null;
      certificate.emailOfVerification = email;
      await this.certificateRepository.save(certificate, session);

      await this.paymentService.recordPartnerTransaction(
        {
          payerId: user._id as any,
          paymentRef: accountNumber,
          accountName,
          amount: amount.toString(),
          transactionType: TransactionType.CERTIFICATE,
          certificateId: certificate._id as any,
        },
        session
      );
    });

    return { certificateId: certificate._id, paymentData };
  }

  public async verifyVerificationPayment(query: IPaymentRedirectQuery): Promise<PaymentVerificationResult> {
    const verification = await this.paymentService.verifyFlutterwavePayment(query);
    if (verification.alreadyVerified) {
      return { alreadyVerified: true, transaction: verification.transaction };
    }

    const certificate = await runInTransaction(async (session) => {
      await this.paymentService.markTransactionSuccessful(verification, session);

      const certificate = await this.certificateRepository.findById(verification.transaction.certificate);
      if (!certificate) throw new NotFoundError("certificate not found");

      this.applyVerificationPayment(certificate);
      return await this.certificateRepository.save(certificate, session);
    });

    const user = await this.userRepository.findById(certificate.user);
    if (!user) throw new NotFoundError("User not found");

    this.mailService.sendCertificateVerificationEmail(
      certificate.emailOfVerification as string,
      `${user.firstName} ${user.lastName}`,
      certificate.verificationCode as string
    );

    return {
      alreadyVerified: false,
      redirectUrl: `${this.config.frontendUrl}/successful?ref=${verification.transaction.transactionRef}`,
    };
  }

  // Codes look like OG/OWL/CO/000000001-AB12CD3, so split on the last hyphen
  public async confirmVerificationCode(code: string) {
    const fullRef = code.trim();
    if (!fullRef) throw new BadRequestError("Invalid Request");

    const separatorIndex = fullRef.lastIndexOf("-");
    if (separatorIndex === -1) throw new BadRequestError("Invalid Reference Format");

    const certificateRef = fullRef.slice(0, separatorIndex);
    const verificationCode = fullRef.slice(separatorIndex + 1);
    if (!certificateRef || !verificationCode) throw new BadRequestError("Invalid Reference Format");

    const certificate = await this.certificateRepository.findByRefWithDetails(certificateRef);
    if (!certificate) throw new BadRequestError("Certificate not found");

    const stored = certificate.verificationCode;
    if (!stored) throw new BadRequestError("Certificate not verified");

    if (verificationCode !== stored.slice(stored.lastIndexOf("-") + 1)) {
      throw new BadRequestError("Certificate not verified");
    }

    return { ref: certificateRef, certificate };
  }

  public async getUserCertificates(user: IUser): Promise<unknown[]> {
    return await this.certificateRepository.findByUser(user._id, reviewerFieldsFor());
  }

  public async getCertificateByApplicationId(user: IUser, applicationId: string): Promise<unknown> {
    if (!mongoose.Types.ObjectId.isValid(applicationId)) throw new BadRequestError("Invalid application id");

    const certificate = await this.certificateRepository.findByApplicationForUser(
      applicationId,
      user._id,
      reviewerFieldsFor()
    );
    if (certificate) return certificate;

    // GET /certificate/:id shares this path, so the id may also be a certificate id
    return await this.getCertificateById(applicationId, { user });
  }

  public async nullifyVerificationCode(ref: string): Promise<void> {
    const certificateRef = ref.trim();
    if (!certificateRef) throw new BadRequestError("Invalid Request");

    const certificate = await this.certificateRepository.findByRef(certificateRef);
    if (!certificate) throw new NotFoundError("Certificate not found");

    certificate.verificationCode = null;
    certificate.emailOfVerification = null;
    certificate.isVerificationCodeGenerated = false;
    await this.certificateRepository.save(certificate);
  }

  // Recomputes the hash so a certificate whose details were tampered with fails verification
  public async isCertificateHashValid(hash: string): Promise<boolean> {
    const certificate = await this.certificateRepository.findByHashWithDetails(hash);
    if (!certificate) throw new NotFoundError("Certificate not found or invalid");

    const expected = this.cryptoService.generateCertificateHash({
      certificateRef: certificate.certificateRef,
      applicationId: (certificate.application as any)._id.toString(),
      userId: (certificate.user as any)._id.toString(),
    });

    return expected === hash;
  }

  public async revokeCertificate(
    admin: IAdmin,
    id: string,
    revocationReason: string | undefined,
    context: IAuditContext
  ): Promise<void> {
    if (!admin.lga) throw new ForbiddenError("Official LGA not set");
    if (!mongoose.isValidObjectId(id)) throw new BadRequestError("Invalid certificate id");

    const certificate = await this.certificateRepository.findByIdWithApplication(id);
    if (!certificate) throw new NotFoundError("Certificate not found or invalid");
    if (!certificate.application) throw new NotFoundError("Certificate has no associated application");
    if (certificate.isRevoked) throw new ConflictError("Certificate already revoked");

    if (!isIssuingOfficial(admin, certificate.application)) {
      throw new ForbiddenError("Officials can only revoke certificates relating to their LGA");
    }

    certificate.isRevoked = true;
    certificate.revocationReason = revocationReason;
    certificate.revokedBy = admin._id as any;
    certificate.revokedAt = new Date();
    certificate.verificationCode = null;
    await this.certificateRepository.save(certificate as unknown as ICertificate);

    await this.auditService.record(
      {
        admin: admin._id as any,
        action: AuditAction.CERTIFICATE_REVOKED,
        target: { type: AuditTargetType.CERTIFICATE, id: certificate._id },
        details: { certificateRef: certificate.certificateRef, revocationReason },
      },
      context
    );
  }

  public async getCertificatesForAdmin(admin: IAdmin): Promise<unknown[]> {
    let filter: Record<string, unknown> = { status: ApplicationStatus.APPROVED };

    if (!isSuperAdmin(admin)) {
      if (!admin.lga) throw new ForbiddenError("Official LGA not set");
      filter = { ...filter, ...officialLgaFilter(admin) };
    }

    const applicationIds = await this.applicationRepository.findIds(filter);
    return await this.certificateRepository.findByApplications(applicationIds, reviewerFieldsFor(admin));
  }

  // Owners, the super admin and officials of the issuing LGA can view a certificate
  public async getCertificateById(id: string, viewer: ICertificateViewer): Promise<unknown> {
    const viewerAccount = viewer.admin ?? viewer.user;
    if (!viewerAccount) throw new UnauthorizedError();

    if (!mongoose.isValidObjectId(id)) throw new BadRequestError("Invalid certificate id");

    const certificate = await this.certificateRepository.findByIdForView(id, reviewerFieldsFor(viewer.admin));
    if (!certificate) throw new NotFoundError("Certificate not found");

    const application = certificate.application as IApplication | null;
    const isOwner = certificate.user.toString() === String(viewerAccount._id);
    const isSuper = !!viewer.admin && isSuperAdmin(viewer.admin);
    const isLgaAdmin =
      !!viewer.admin &&
      viewer.admin.role === AdminRole.ADMIN &&
      !!viewer.admin.lga &&
      !!application &&
      isIssuingOfficial(viewer.admin, application);

    if (!isOwner && !isSuper && !isLgaAdmin) throw new ForbiddenError();

    return certificate;
  }

  private async findCertificateAwaitingCode(user: IUser, applicationId: string): Promise<ICertificate> {
    const certificate = await this.certificateRepository.findByUserAndApplication(user._id, applicationId);
    if (!certificate) throw new NotFoundError("No certificate found for user");
    if (certificate.isVerificationCodeGenerated) throw new BadRequestError("Verification code already generated");
    return certificate;
  }

  // A paid verification request gets a code of the form <certificateRef>-<7 random chars>
  public applyVerificationPayment(certificate: ICertificate): void {
    certificate.isVerificationPaymentPending = false;
    certificate.isVerificationCodeGenerated = true;
    certificate.verificationCode = `${certificate.certificateRef}-${this.cryptoService.generateRandomString(7)}`;
    certificate.pendingPaymentLink = null;
  }
}
