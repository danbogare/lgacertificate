import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { errorResponse, successResponse } from '../utils/responseUtils';
import Certificate from '../models/certificationModal';
import { generateCertificateHash, generateRandomString, generateTransactionRef } from '../utils/hash';
import { config } from '../config/app';
import { IBaseResponse } from '../utils/apiCalls/IResponse';
import { restClientWithHeaders } from '../utils/apiCalls/restcall';
import mongoose from 'mongoose';
import Transaction, {
  ITransaction,
  TransactionStatus,
  TransactionType,
} from '../models/transactionModel';
import Application from '../models/applicationModel';
import User from '../models/userModel';
import emitter from '../utils/common/eventlisteners';

const CertificateController = {
  requestVerificationCode: async (req: AuthenticatedRequest, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const user = req.user;
      const applicationId = req.params.id;
      const {email} = req.body

      const certificate = await Certificate.findOne({ user: user._id, application: applicationId });
      if (!certificate) {
        await session.abortTransaction();
        return errorResponse(res, 'No certificate found for user', 404);
      }
      if (certificate.isVerificationCodeGenerated) {
        await session.abortTransaction();
        return errorResponse(res, 'Verification code already generated', 400);
      }

      const transactionRef = generateTransactionRef();

      const paymentPayload = {
        tx_ref: transactionRef,
        amount: config.app.CERTIFICATE_AMOUNT.toString(),
        currency: 'NGN',
        redirect_url: `${config.app.URL}/api/v1/certificate/payment/verify`,
        customer: {
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          phone_number: user.phone,
        },
        customizations: {
          title: 'LGA Certificate Verification Payment',
        },
      };

      const response: IBaseResponse = await restClientWithHeaders(
        'POST',
        `${config.payments.URI}payments`,
        paymentPayload,
        {
          Authorization: `Bearer ${config.payments.SECRET}`,
        }
      );

      if (response.status !== 'success') {
        await session.abortTransaction();
        return errorResponse(res, 'an error has occurred', 500);
      }

      certificate.isVerificationPaymentPending = true;
      certificate.pendingPaymentLink = response?.data?.link;
      certificate.emailOfVerification = email;
      await certificate.save({ session });

      const transaction = new Transaction({
        transactionRef,
        amount: config.app.CERTIFICATE_AMOUNT.toString(),
        transactionType: TransactionType.CERTIFICATE,
        user: user._id,
        certificate: certificate._id,
      });
      await transaction.save({ session });
      await session.commitTransaction();

      return successResponse(res, 'redirect to payment link', {
        txRef: transactionRef,
        paymentLink: response?.data?.link,
      });
    } catch (err: any) {
      await session.abortTransaction();
      return errorResponse(res, err.message, 500);
    } finally {
      session.endSession();
    }
  },

  verifyCertificateVerificationCodePayment: async (req: Request, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const transactionRef = req.query.tx_ref;
      const status = req.query.status;
      const transactionId = req.query.transaction_id;

      if (!transactionRef || !status || !transactionId) {
        await session.abortTransaction();
        return errorResponse(res, 'missing required query parameters', 400);
      }

      const transaction: ITransaction | null = await Transaction.findOne({ transactionRef });
      if (!transaction) {
        await session.abortTransaction();
        return errorResponse(res, 'wrong transaction reference', 400);
      }

      if (status === 'failed') {
        transaction.status = 'failed';
        await transaction.save({ session });
        await session.commitTransaction();
        return errorResponse(res, 'transaction failed', 400);
      }

      if (transaction.status === 'successful') {
        await session.abortTransaction();
        return successResponse(res, 'transaction successful', { transaction });
      }

      const response: IBaseResponse = await restClientWithHeaders(
        'GET',
        `${config.payments.URI}transactions/${Number(transactionId)}/verify`,
        { null: null },
        { Authorization: `Bearer ${config.payments.SECRET}` }
      );

      if (response?.status !== 'success') {
        await session.abortTransaction();
        return errorResponse(res, 'an error has occurred', 500);
      }

      if (response.data.status === 'pending') {
        transaction.transactionId = Number(transactionId);
        await transaction.save({ session });
        await session.commitTransaction();
        return errorResponse(res, 'transaction still pending', 400);
      }
      if (response.data.status !== 'successful') {
        transaction.status = 'failed';
        transaction.transactionId = Number(transactionId);
        await transaction.save({ session });
        await session.commitTransaction();
        return errorResponse(res, 'transaction failed', 400);
      }

      transaction.status = TransactionStatus.SUCCESSFUL;
      transaction.transactionId = Number(transactionId);
      transaction.providerRef = response?.data?.flw_ref;
      await transaction.save({ session });

      const certificate = await Certificate.findById(transaction.certificate);
      if (!certificate) {
        await session.abortTransaction();
        return errorResponse(res, 'certificate not found', 404);
      }
      certificate.isVerificationPaymentPending = false;
      certificate.isVerificationCodeGenerated = true;
      certificate.verificationCode = `${certificate.certificateRef}-${generateRandomString(7)}`;
      certificate.pendingPaymentLink = null;
      await certificate.save({ session });
      await session.commitTransaction();

      const user = await User.findById(certificate.user);
      if (!user) return errorResponse(res, 'User not found', 404);    

      emitter.emit('certificate-verification', {
        email: certificate.emailOfVerification,
        name: `${user.firstName} ${user.lastName}`,
        verificationCode: certificate.verificationCode,
      });

      return res.redirect(`${config.app.FRONT_END_URL}/successful?ref=${transactionRef}`);
    } catch (err: any) {
      await session.abortTransaction();
      return errorResponse(res, err.message, 500);
    } finally {
      session.endSession();
    }
  },

  confirmVerificationCode: async (req: Request, res: Response) => {
    try {
      const fullReference = req.params.ref;
      if (!fullReference) return errorResponse(res, 'Invalid Request', 400);

      const [certificateRef, verificationCode] = String(fullReference).split('-');
      if (!certificateRef || !verificationCode)
        return errorResponse(res, 'Invalid Reference Format', 400);

      const certificate = await Certificate.findOne({ certificateRef }).populate('application').populate('user', 'firstName lastName email');
      if (!certificate) return errorResponse(res, 'Certificate not found', 400);

      if (!certificate.verificationCode) return errorResponse(res, 'Certificate not verified', 400);

      const certVerificationCode = certificate.verificationCode?.split('-')[1]
  
      if (verificationCode !== certVerificationCode) return errorResponse(res, 'Certificate not verified', 400);

      return successResponse(res, 'Certificate verified', { ref: certificateRef,  certificate});
    } catch (err: any) {
      return errorResponse(res, err.message, 500);
    }
  },
  
  getCertificates: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user;
      const certificates = await Certificate.find({ user: user._id })
        .populate({
          path: "application",
          select: "-pendingPaymentLink -passportPublicId -docFromCommunityHeadPublicId -pendingApprovalRejectionDate",
        })
        .sort({ createdAt: -1 })
        .lean();
      return successResponse(res, 'Certificates retrieved successfully', { certificates });
    } catch (err: any) {
      return errorResponse(res, err.message, 500);
    }
  },
  
  getCertificateByApplicationId: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user;
      const { applicationId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(applicationId)) {
        return errorResponse(res, "Invalid application id", 400);
      }
      const certificate = await Certificate.findOne({
        application: applicationId,
        user: user._id,           // ensures it belongs to the logged-in user
      })
        .populate({
          path: "application",
          select: "-pendingPaymentLink -passportPublicId -docFromCommunityHeadPublicId -pendingApprovalRejectionDate",
        })
        .lean();

      if (!certificate) {
        return errorResponse(res, 'Certificate not found', 404);
      }
      return successResponse(res, 'Certificates retrieved successfully', { certificate });
    } catch (err: any) {
      return errorResponse(res, err.message, 500);
    }
  },

  nullifyVerificationCode: async (req: Request, res: Response) => {
    try {
      const ref = req.params.ref;
      if (!ref) return errorResponse(res, 'Invalid Request', 400);

      const certificate = await Certificate.findOne({ certificateRef: ref });
      if (!certificate) return errorResponse(res, 'Certificate not found', 404);

      certificate.verificationCode = null;
      certificate.emailOfVerification = null;
      certificate.isVerificationCodeGenerated = false;
      await certificate.save();

      return successResponse(res, 'Verification Code nullified successfully', {});
    } catch (err: any) {
      return errorResponse(res, err.message, 500);
    }
  },

  verifyCertificateHash: async (req: Request, res: Response) => {
    try {
      const { hash } = req.params;

      const certificate = await Certificate.findOne({ certificateHash: hash })
        .populate("application")
        .populate("user");

      if (!certificate) {
        return errorResponse(res, "Certificate not found or invalid", 404);
      }

      // Optional belt-and-suspenders: recompute and compare
      const expected = generateCertificateHash({
        certificateRef: certificate.certificateRef,
        applicationId: certificate.application._id.toString(),
        userId: certificate.user._id.toString(),
      });

      if (expected !== hash) {
        return successResponse(res, "Certificate not found or invalid", {
          certificateValid: false,
        });
      }

      return successResponse(res, "Certificate verified", {
        certificateValid: true,
      });
    } catch (err: any) {
      return errorResponse(res, err.message, 500);
    }
  },

};

export default CertificateController;
