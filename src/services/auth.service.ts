import { IUser, AuthState } from "../models/user.model";
import { ApplicationStatus } from "../models/application.model";
import { IUserRepository } from "../repositories/user.repository";
import { IApplicationRepository } from "../repositories/application.repository";
import { ICryptoService } from "./crypto.service";
import { IMailService } from "./mail.service";
import { ISignupPayload } from "../interfaces/auth.interface";
import {
  BadRequestError,
  InvalidCredentialError,
  InvalidOTPError,
  NotFoundError,
  TooManyRequestsError,
} from "../errors/error";
import { isOtpExpired, isWithinResendCooldown, otpExpiryDate } from "../utils/otp";

export interface IUserLoginResult {
  token: string;
  userObj: Record<string, unknown>;
  pendingApplication: boolean;
}

export interface IAuthService {
  signup(payload: ISignupPayload): Promise<IUser>;
  requestEmailVerification(user: IUser): Promise<IUser>;
  verifyEmail(email: string, otp: string): Promise<void>;
  login(email: string, password: string): Promise<IUserLoginResult>;
  forgotPassword(email: string): Promise<IUser>;
  resendOTP(email: string): Promise<IUser>;
  resetPassword(email: string, otp: string, password: string): Promise<void>;
  changePassword(user: IUser, oldPassword: string, newPassword: string): Promise<IUser>;
}

export class AuthService implements IAuthService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly applicationRepository: IApplicationRepository,
    private readonly cryptoService: ICryptoService,
    private readonly mailService: IMailService
  ) {}

  public async signup(payload: ISignupPayload): Promise<IUser> {
    const existingUser = await this.userRepository.findByEmail(payload.email);
    if (existingUser) throw new BadRequestError("Email already registered");

    const otp = this.cryptoService.generateOTP();

    const user = await this.userRepository.create({
      firstName: payload.firstName,
      lastName: payload.lastName,
      middleName: payload.middleName,
      email: payload.email,
      phone: payload.phone,
      password: await this.cryptoService.hash(payload.password),
      verifyEmailOTP: await this.cryptoService.hash(otp),
      verifyEmailOTPExpire: otpExpiryDate(),
    });

    this.mailService.sendEmailVerificationEmail(payload.email, otp, payload.firstName);

    return user;
  }

  public async requestEmailVerification(user: IUser): Promise<IUser> {
    if (user.state === AuthState.VERIFIED) throw new BadRequestError("Email already verified");

    const otp = this.cryptoService.generateOTP();
    user.verifyEmailOTP = await this.cryptoService.hash(otp);
    user.verifyEmailOTPExpire = otpExpiryDate();
    await this.userRepository.save(user);

    this.mailService.sendEmailVerificationEmail(user.email, otp, user.firstName);

    return user;
  }

  public async verifyEmail(email: string, otp: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) throw new NotFoundError("User not found");

    if (user.state === AuthState.VERIFIED) throw new BadRequestError("Email already verified");

    if (!user.verifyEmailOTP || isOtpExpired(user.verifyEmailOTPExpire)) throw new InvalidOTPError();

    const isOTPMatch = await this.cryptoService.compareHash(otp, user.verifyEmailOTP);
    if (!isOTPMatch) throw new InvalidOTPError();

    user.state = AuthState.VERIFIED;
    user.verifyEmailOTP = undefined;
    user.verifyEmailOTPExpire = undefined;
    await this.userRepository.save(user);
  }

  public async login(email: string, password: string): Promise<IUserLoginResult> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) throw new InvalidCredentialError();

    const isMatch = await this.cryptoService.compareHash(password, user.password);
    if (!isMatch) throw new InvalidCredentialError();

    const token = this.cryptoService.generateToken({ id: String(user._id), email: user.email });

    const pendingApplicationCount = await this.applicationRepository.countByUserAndStatus(
      user._id,
      ApplicationStatus.PENDING_PAYMENT
    );

    const { password: _password, resetPasswordExpire, resetPasswordOTP, verifyEmailOTP, ...userObj } =
      user.toObject();

    return { token, userObj, pendingApplication: pendingApplicationCount > 0 };
  }

  public async forgotPassword(email: string): Promise<IUser> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) throw new NotFoundError("User not found");

    await this.sendPasswordResetOtp(user);
    return user;
  }

  public async resendOTP(email: string): Promise<IUser> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) throw new NotFoundError("User not found");

    await this.sendPasswordResetOtp(user);
    return user;
  }

  public async resetPassword(email: string, otp: string, password: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) throw new NotFoundError("User not found");

    if (!user.resetPasswordOTP || isOtpExpired(user.resetPasswordExpire)) throw new InvalidOTPError();

    const isOTPMatch = await this.cryptoService.compareHash(otp, user.resetPasswordOTP);
    if (!isOTPMatch) throw new InvalidOTPError();

    user.password = await this.cryptoService.hash(password);
    user.resetPasswordOTP = undefined;
    user.resetPasswordExpire = undefined;
    await this.userRepository.save(user);
  }

  public async changePassword(user: IUser, oldPassword: string, newPassword: string): Promise<IUser> {
    const isMatch = await this.cryptoService.compareHash(oldPassword, user.password);
    if (!isMatch) throw new BadRequestError("Old password does not match");

    user.password = await this.cryptoService.hash(newPassword);
    return await this.userRepository.save(user);
  }

  private async sendPasswordResetOtp(user: IUser): Promise<void> {
    if (isWithinResendCooldown(user.resetPasswordExpire)) throw new TooManyRequestsError();

    const otp = this.cryptoService.generateOTP();
    user.resetPasswordOTP = await this.cryptoService.hash(otp);
    user.resetPasswordExpire = otpExpiryDate();
    await this.userRepository.save(user);

    this.mailService.sendForgotPasswordEmail(user.email, otp, user.firstName);
  }
}
