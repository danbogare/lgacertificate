import { IAdmin } from "../models/admin.model";
import { IAdminRepository } from "../repositories/admin.repository";
import { ICryptoService } from "./crypto.service";
import { IMailService } from "./mail.service";
import { IAuditService } from "./audit.service";
import { ICreateAdminPayload } from "../interfaces/admin.interface";
import { IAuditContext } from "../interfaces/audit.interface";
import { AuditAction, AuditTargetType } from "../models/auditLog.model";
import {
  BadRequestError,
  InvalidCredentialError,
  InvalidOTPError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
} from "../errors/error";
import { isOtpExpired, isWithinResendCooldown, otpExpiryDate } from "../utils/otp";
import { HOME_STATE, isValidLga } from "../utils/states";
import { isSuperAdmin } from "../utils/admin-scope";

export interface IAdminLoginResult {
  token: string;
  admin: Record<string, unknown>;
}

export interface IAdminService {
  createAdmin(superAdmin: IAdmin, payload: ICreateAdminPayload, context: IAuditContext): Promise<IAdmin>;
  login(email: string, password: string, context: IAuditContext): Promise<IAdminLoginResult>;
  forgotPassword(email: string, context: IAuditContext): Promise<IAdmin>;
  resendOTP(email: string, context: IAuditContext): Promise<IAdmin>;
  resetPassword(email: string, otp: string, password: string, context: IAuditContext): Promise<void>;
  changePassword(admin: IAdmin, oldPassword: string, newPassword: string, context: IAuditContext): Promise<IAdmin>;
}

export class AdminService implements IAdminService {
  constructor(
    private readonly adminRepository: IAdminRepository,
    private readonly cryptoService: ICryptoService,
    private readonly mailService: IMailService,
    private readonly auditService: IAuditService
  ) {}

  // Only the super admin can onboard officials, and only for Ogun LGAs
  public async createAdmin(superAdmin: IAdmin, payload: ICreateAdminPayload, context: IAuditContext): Promise<IAdmin> {
    if (!isSuperAdmin(superAdmin)) throw new UnauthorizedError();

    if (!isValidLga(HOME_STATE, payload.lga)) throw new BadRequestError("Invalid LGA for the selected state");

    const existingAdmin = await this.adminRepository.findByEmail(payload.email);
    if (existingAdmin) throw new BadRequestError("Official already registered");

    const password = this.cryptoService.generateRandomPassword();

    const admin = await this.adminRepository.create({
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      position: payload.position,
      staffID: payload.staffID,
      stateOfOrigin: HOME_STATE,
      lga: payload.lga,
      phone: payload.phone,
      password: await this.cryptoService.hash(password),
    });

    this.mailService.sendAdminInviteEmail(payload.email, `${payload.firstName} ${payload.lastName}`, password);

    await this.auditService.record(
      {
        admin: superAdmin._id as any,
        action: AuditAction.ADMIN_CREATED,
        target: { type: AuditTargetType.ADMIN, id: admin._id },
        details: { email: payload.email, lga: payload.lga, position: payload.position },
      },
      context
    );

    return admin;
  }

  public async login(email: string, password: string, context: IAuditContext): Promise<IAdminLoginResult> {
    const admin = await this.adminRepository.findByEmail(email);
    if (!admin) throw new InvalidCredentialError();

    const isMatch = await this.cryptoService.compareHash(password, admin.password);
    if (!isMatch) {
      await this.auditService.record({ admin: admin._id as any, action: AuditAction.LOGIN_FAILED }, context);
      throw new InvalidCredentialError();
    }

    const token = this.cryptoService.generateToken({
      id: String(admin._id),
      email: admin.email,
      state: admin.stateOfOrigin,
      lga: admin.lga,
    });

    const { password: _password, resetPasswordExpire, resetPasswordOTP, ...adminObj } = admin.toObject();

    await this.auditService.record({ admin: admin._id as any, action: AuditAction.LOGIN }, context);

    return { token, admin: adminObj };
  }

  public async forgotPassword(email: string, context: IAuditContext): Promise<IAdmin> {
    const admin = await this.adminRepository.findByEmail(email);
    if (!admin) throw new NotFoundError("invalid Credentials");

    await this.sendPasswordResetOtp(admin);
    await this.auditService.record({ admin: admin._id as any, action: AuditAction.PASSWORD_RESET_REQUESTED }, context);
    return admin;
  }

  public async resendOTP(email: string, context: IAuditContext): Promise<IAdmin> {
    const admin = await this.adminRepository.findByEmail(email);
    if (!admin) throw new NotFoundError("User not found");

    await this.sendPasswordResetOtp(admin);
    await this.auditService.record({ admin: admin._id as any, action: AuditAction.PASSWORD_RESET_OTP_RESENT }, context);
    return admin;
  }

  public async resetPassword(email: string, otp: string, password: string, context: IAuditContext): Promise<void> {
    const admin = await this.adminRepository.findByEmail(email);
    if (!admin) throw new NotFoundError("Invalid credentials");

    if (!admin.resetPasswordOTP || isOtpExpired(admin.resetPasswordExpire)) throw new InvalidOTPError();

    const isOTPMatch = await this.cryptoService.compareHash(otp, admin.resetPasswordOTP);

    // A wrong guess burns the OTP so officials' accounts can't be brute-forced
    admin.resetPasswordOTP = undefined;
    admin.resetPasswordExpire = undefined;

    if (!isOTPMatch) {
      await this.adminRepository.save(admin);
      await this.auditService.record({ admin: admin._id as any, action: AuditAction.PASSWORD_RESET_FAILED }, context);
      throw new InvalidOTPError();
    }

    admin.password = await this.cryptoService.hash(password);
    await this.adminRepository.save(admin);
    await this.auditService.record({ admin: admin._id as any, action: AuditAction.PASSWORD_RESET }, context);
  }

  public async changePassword(
    admin: IAdmin,
    oldPassword: string,
    newPassword: string,
    context: IAuditContext
  ): Promise<IAdmin> {
    const isMatch = await this.cryptoService.compareHash(oldPassword, admin.password);
    if (!isMatch) throw new BadRequestError("Old password does not match");

    admin.password = await this.cryptoService.hash(newPassword);
    admin.mustResetPassword = false;
    const saved = await this.adminRepository.save(admin);

    await this.auditService.record({ admin: admin._id as any, action: AuditAction.PASSWORD_CHANGED }, context);
    return saved;
  }

  private async sendPasswordResetOtp(admin: IAdmin): Promise<void> {
    if (isWithinResendCooldown(admin.resetPasswordExpire)) throw new TooManyRequestsError();

    const otp = this.cryptoService.generateOTP();
    admin.resetPasswordOTP = await this.cryptoService.hash(otp);
    admin.resetPasswordExpire = otpExpiryDate();
    await this.adminRepository.save(admin);

    this.mailService.sendForgotPasswordEmail(admin.email, otp, admin.firstName);
  }
}
