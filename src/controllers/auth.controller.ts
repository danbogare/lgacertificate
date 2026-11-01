import { Request, Response } from "express";
import { IAuthService } from "../services/auth.service";
import { IUser } from "../models/user.model";
import { successResponse } from "../utils/response";

export interface IAuthController {
  signup: (req: Request, res: Response) => Promise<void>;
  requestEmailVerification: (req: Request, res: Response) => Promise<void>;
  verifyUserEmail: (req: Request, res: Response) => Promise<void>;
  login: (req: Request, res: Response) => Promise<void>;
  forgotPassword: (req: Request, res: Response) => Promise<void>;
  resetPassword: (req: Request, res: Response) => Promise<void>;
  resendOTP: (req: Request, res: Response) => Promise<void>;
}

export class AuthController implements IAuthController {
  constructor(private readonly authService: IAuthService) {}

  public signup = async (req: Request, res: Response): Promise<void> => {
    const { firstName, lastName, middleName, email, phone, password } = req.body;

    const user = await this.authService.signup({ firstName, lastName, middleName, email, phone, password });

    successResponse(res, "User registered successfully, check email to verify your account", {
      userId: user._id,
      email: user.email,
    });
  };

  public requestEmailVerification = async (req: Request, res: Response): Promise<void> => {
    const user = await this.authService.requestEmailVerification(req.user as IUser);

    successResponse(res, "Verification OTP sent to email", { userId: user._id, email: user.email });
  };

  public verifyUserEmail = async (req: Request, res: Response): Promise<void> => {
    const { email, otp } = req.body;

    await this.authService.verifyEmail(email, otp);

    successResponse(res, "Email verified successful", {});
  };

  public login = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;

    const result = await this.authService.login(email, password);

    successResponse(res, "Logged in successfully", result);
  };

  public forgotPassword = async (req: Request, res: Response): Promise<void> => {
    const user = await this.authService.forgotPassword(req.body.email);

    successResponse(res, "OTP sent to email", { email: user.email });
  };

  public resetPassword = async (req: Request, res: Response): Promise<void> => {
    const { email, otp, password } = req.body;

    await this.authService.resetPassword(email, otp, password);

    successResponse(res, "Password reset successful", {});
  };

  public resendOTP = async (req: Request, res: Response): Promise<void> => {
    const user = await this.authService.resendOTP(req.body.email);

    successResponse(res, "OTP resent successfully", { email: user.email });
  };
}
