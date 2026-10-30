import { Request, Response } from 'express';
import { errorResponse, successResponse } from '../utils/responseUtils';
import { compareHash, generateRandomPassword, hash } from '../utils/hash';
import { generateToken } from '../utils/jwtHandler';
import emitter from '../utils/common/eventlisteners';
import Admin, { AdminRole } from '../models/adminModel';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import statesData from '../services/states.json';

const AdminController = {
  signup: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { firstName, lastName, email, position, staffID, lga, phone } = req.body;
      const user = req.user;

      if (user.role !== AdminRole.SUPER_ADMIN) return errorResponse(res, "Unauthorized", 401);

      // 2️⃣ Validate LGA within the selected state
      const validLgas = statesData["Ogun" as keyof typeof statesData];
      if (!validLgas.includes(lga)) {
        return errorResponse(res, 'Invalid LGA for the selected state', 400);
      }

      const existingAdmin = await Admin.findOne({ email });
      if (existingAdmin) return errorResponse(res, 'Official already registered', 400);

      const password = generateRandomPassword();
      const hashedPassword = await hash(password);

      const admin = await Admin.create({
        firstName,
        lastName,
        email,
        position,
        staffID,
        stateOfOrigin: "Ogun",
        lga,
        phone,
        password: hashedPassword,
      });

      emitter.emit('send-admin-invitation', {
        email: email,
        name: `${firstName} ${lastName}`,
        password: password,
      });

      return successResponse(res, 'Invitation Email sent to admin successfully', {
        adminId: admin._id,
      });
    } catch (err: any) {
      return errorResponse(res, err.message, 500);
    }
  },

  login: async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      const admin = await Admin.findOne({ email });
      if (!admin) return errorResponse(res, 'Invalid credentials', 400);

      const isMatch = await compareHash(password, admin.password);
      if (!isMatch) return errorResponse(res, 'Invalid credentials', 400);

      const token = generateToken({
        id: admin._id,
        email: admin.email,
        state: admin.stateOfOrigin,
        lga: admin.lga,
      });

      const adminObj: any = admin.toObject();
      delete adminObj.password;
      delete adminObj.resetPasswordExpire;
      delete adminObj.resetPasswordOTP;

      return successResponse(res, 'Logged in successfully', { token, admin: adminObj });
    } catch (err: any) {
      return errorResponse(res, err.message, 500);
    }
  },

  forgotPassword: async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      const admin = await Admin.findOne({ email });

      if (!admin) return errorResponse(res, 'invalid Credentials', 404);

      // Check 1-minute cooldown using resetPasswordExpire as reference
      const now = Date.now();
      if (admin.resetPasswordExpire) {
        // The OTP was originally sent 10 minutes before the expire time
        const otpSentAt = admin.resetPasswordExpire.getTime() - 10 * 60 * 1000;

        // If it's been less than 1 minute since that time, block new OTP
        if (now - otpSentAt < 60 * 1000) {
          return errorResponse(res, 'Please wait before requesting a new OTP', 429);
        }
      }

      // Generate a 6-digit numeric OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      const hashedOTP = await hash(otp);

      admin.resetPasswordOTP = hashedOTP;
      admin.resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000); // valid 10 mins
      await admin.save();

      emitter.emit('forgot-password', {
        email: admin.email,
        otp: otp,
        name: admin.firstName,
      });

      return successResponse(res, 'OTP sent to email', { email: admin.email });
    } catch (err: any) {
      return errorResponse(res, err.message, 500);
    }
  },

  resetPassword: async (req: Request, res: Response) => {
    try {
      const { email, otp, password } = req.body;

      const admin = await Admin.findOne({ email });
      if (!admin) return errorResponse(res, 'Invalid credentials', 404);

      // Check if OTP or expiration is missing/expired
      if (
        !admin.resetPasswordOTP ||
        !admin.resetPasswordExpire ||
        admin.resetPasswordExpire < new Date()
      ) {
        return errorResponse(res, 'Invalid or expired OTP', 400);
      }

      // Compare provided OTP with hashed one in DB
      const isOTPMatch = await compareHash(otp, admin.resetPasswordOTP);
      if (!isOTPMatch) {
        admin.resetPasswordOTP = undefined;
        admin.resetPasswordExpire = undefined;
        await admin.save();
        return errorResponse(res, 'Invalid or expired OTP', 400);
      }

      // OTP is valid → update password
      admin.password = await hash(password);
      admin.resetPasswordOTP = undefined;
      admin.resetPasswordExpire = undefined;

      await admin.save();

      return successResponse(res, 'Password reset successful', {});
    } catch (err: any) {
      console.error(err);
      return errorResponse(res, err.message, 500);
    }
  },

  resendOTP: async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      const admin = await Admin.findOne({ email });
      if (!admin) return errorResponse(res, 'User not found', 404);

      // Check 1-minute cooldown using resetPasswordExpire as reference
      const now = Date.now();
      if (admin.resetPasswordExpire) {
        // The OTP was originally sent 10 minutes before the expire time
        const otpSentAt = admin.resetPasswordExpire.getTime() - 10 * 60 * 1000;

        // If it's been less than 1 minute since that time, block new OTP
        if (now - otpSentAt < 60 * 1000) {
          return errorResponse(res, 'Please wait before requesting a new OTP', 429);
        }
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const hashedOTP = await hash(otp);

      // Save hashed OTP and new expiry
      admin.resetPasswordOTP = hashedOTP;
      admin.resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 min expiry
      await admin.save();

      emitter.emit('forgot-password', {
        email: admin.email,
        otp: otp, // send raw OTP here (not hashed)
        name: admin.firstName,
      });

      return successResponse(res, 'OTP resent successfully', {
        email: admin.email,
      });
    } catch (err: any) {
      return errorResponse(res, err.message, 500);
    }
  },

  changePassword: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const admin = req.user;
      const { oldPassword, newPassword } = req.body;

      // Check if old password match
      const isMatch = await compareHash(oldPassword, admin.password);
      if (!isMatch) return errorResponse(res, 'Old password does not match', 400);

      const hashedPassword = await hash(newPassword);

      admin.password = hashedPassword;
      admin.mustResetPassword = false; // Reset the flag after changing password
      await admin.save();

      return successResponse(res, 'Password changed successfully', {
        email: admin.email,
      });
    } catch (err: any) {
      return errorResponse(res, err.message, 500);
    }
  },
};

export default AdminController;
