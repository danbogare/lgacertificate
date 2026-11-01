import { Request, Response } from "express";
import { IAdminService } from "../services/admin.service";
import { IAdmin } from "../models/admin.model";
import { successResponse } from "../utils/response";
import { getAuditContext } from "../utils/request";

export interface IAdminController {
  signup: (req: Request, res: Response) => Promise<void>;
  login: (req: Request, res: Response) => Promise<void>;
  forgotPassword: (req: Request, res: Response) => Promise<void>;
  resetPassword: (req: Request, res: Response) => Promise<void>;
  resendOTP: (req: Request, res: Response) => Promise<void>;
  changePassword: (req: Request, res: Response) => Promise<void>;
}

export class AdminController implements IAdminController {
  constructor(private readonly adminService: IAdminService) {}

  public signup = async (req: Request, res: Response): Promise<void> => {
    const { firstName, lastName, email, position, staffID, lga, phone } = req.body;

    const admin = await this.adminService.createAdmin(
      req.admin as IAdmin,
      { firstName, lastName, email, position, staffID, lga, phone },
      getAuditContext(req)
    );

    successResponse(res, "Invitation Email sent to admin successfully", { adminId: admin._id });
  };

  public login = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;

    const result = await this.adminService.login(email, password, getAuditContext(req));

    successResponse(res, "Logged in successfully", result);
  };

  public forgotPassword = async (req: Request, res: Response): Promise<void> => {
    const admin = await this.adminService.forgotPassword(req.body.email, getAuditContext(req));

    successResponse(res, "OTP sent to email", { email: admin.email });
  };

  public resetPassword = async (req: Request, res: Response): Promise<void> => {
    const { email, otp, password } = req.body;

    await this.adminService.resetPassword(email, otp, password, getAuditContext(req));

    successResponse(res, "Password reset successful", {});
  };

  public resendOTP = async (req: Request, res: Response): Promise<void> => {
    const admin = await this.adminService.resendOTP(req.body.email, getAuditContext(req));

    successResponse(res, "OTP resent successfully", { email: admin.email });
  };

  public changePassword = async (req: Request, res: Response): Promise<void> => {
    const { oldPassword, newPassword } = req.body;

    const admin = await this.adminService.changePassword(
      req.admin as IAdmin,
      oldPassword,
      newPassword,
      getAuditContext(req)
    );

    successResponse(res, "Password changed successfully", { email: admin.email });
  };
}
