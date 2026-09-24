import { Response } from 'express';
import { errorResponse, successResponse } from '../utils/responseUtils';
import Application, { ApplicationStatus, IApplication } from '../models/applicationModel';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import { formatDateTimeForFilename, generateCertificateHash, generateTransactionRef, isValidDateFormat, isValidEmail } from '../utils/hash';
import { restClientWithHeaders } from '../utils/apiCalls/restcall';
import { IBaseResponse } from '../utils/apiCalls/IResponse';
import { config } from '../config/app';
import mongoose from 'mongoose';
import Transaction, {
  ITransaction,
  TransactionStatus,
  TransactionType,
} from '../models/transactionModel';
import { AppError } from '../utils/appError';
import { uploadToCloudinary } from '../utils/upload';
import Certificate from '../models/certificationModal';
import CertificateService from '../services/certificateService';
import emitter from '../utils/common/eventlisteners';
import User from '../models/userModel';
import statesData from '../services/states.json';
import { AdminRole } from '../models/adminModel';
import { PipelineStage, FilterQuery } from "mongoose";

const ApplicationController = {
  createApplication: async (req: AuthenticatedRequest, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const user = req.user;
      const {
        fullNames,
        fatherNames,
        motherNames,
        nativeTown,
        nativePoliticalWard,
        village,
        communityHead,
        communityHeadContact,
        currentAddress,
        lga,
        nin,
        stateOfOrigin,
        isResidentOfOgun,
        lgaOfResident,
        dateOfBirth,
      } = req.body;

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const passportFile = files["passport"]?.[0];
      const docFile = files["docFromCommunityHead"]?.[0];

      if (!passportFile) {
        return errorResponse(res, "Passport is required", 400);
      }

      // Validate passport file is an image
      if (!["image/jpeg", "image/png", "image/jpg"].includes(passportFile.mimetype)) {
        return errorResponse(res, "Passport must be a JPG or PNG image", 400);
      }

      // Validate document file is a PDF (if provided)
      if (docFile && docFile.mimetype !== "application/pdf") {
        return errorResponse(res, "Community head document must be a PDF file", 400);
      }

      let parsedDateOfBirth: Date | null = null;
      if (dateOfBirth) {
        const d = new Date(dateOfBirth);
        if (isNaN(d.getTime())) {
          return errorResponse(res, "Invalid date of birth", 400);
        }
        if (d > new Date()) {
          return errorResponse(res, "Date of birth cannot be in the future", 400);
        }
        parsedDateOfBirth = d;
      } else {
        return errorResponse(res, "Date of birth is required", 400);
      }

      // 1️ Validate state
      if (!Object.keys(statesData).includes(stateOfOrigin)) {
        return errorResponse(res, "Invalid state of origin", 400);
      }

      // 2 Validate LGA within the selected state
      const validLgas = statesData[stateOfOrigin as keyof typeof statesData];
      if (!validLgas.includes(lga)) {
        return errorResponse(res, "Invalid LGA for the selected state", 400);
      }

      const isResidentOfOgunBool = isResidentOfOgun === "true" || isResidentOfOgun === true;
      if (stateOfOrigin !== "Ogun" && !isResidentOfOgunBool) {
        return errorResponse(res, "Must be a resident of Ogun State if not from Ogun State", 400);
      }
      if (stateOfOrigin !== "Ogun" && !lgaOfResident) {
        return errorResponse(res, "Must enter a LGA of residence of Ogun State if not from Ogun State", 400);
      }
      if (stateOfOrigin !== "Ogun" && lgaOfResident) {
        const validLgasOfResident = statesData["Ogun" as keyof typeof statesData];
         if (!validLgasOfResident.includes(lgaOfResident)) {
            return errorResponse(res, "Invalid LGA of Residence for Ogun state", 400);
        }
      }

      if (stateOfOrigin === "Ogun") {
        const requiredFields = {
          fatherNames,
          motherNames,
          nativeTown,
          nativePoliticalWard,
          village,
          communityHead,
          communityHeadContact,
        };

        const missing = Object.entries(requiredFields).filter(([_, value]) => !value || !value.toString().trim());

        if (missing.length > 0) {
          return errorResponse(res, "All fields relating to Ogun State origin are required", 400);
        }
      }

      const existingApplication = await Application.findOne({ nin, isPending: true });
      if (existingApplication) {
        await session.abortTransaction();
        return errorResponse(res, 'Existing application pending', 400);
      }

      // ✅ Upload files to Cloudinary
      const [passportData, docData] = await Promise.all([
        uploadToCloudinary(passportFile.buffer, "applications", "image"),
        docFile ? uploadToCloudinary(docFile.buffer, "applications", "raw") : Promise.resolve(null),
      ]);

      const transactionRef = generateTransactionRef();
      const paymentPayload = {
        tx_ref: transactionRef,
        amount: config.app.APPLICATION_AMOUNT.toString(),
        currency: 'NGN',
        redirect_url: `${config.app.URL}/api/v1/application/payment/verify`,
        customer: {
          email: user.email,
          name: fullNames,
          phone_number: user.phone,
        },
        customizations: {
          title: 'LGA Certificate Application Payment',
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

      const application: IApplication = new Application({
        fullNames,
        dateOfBirth: parsedDateOfBirth,
        fatherNames: stateOfOrigin === "Ogun" ? fatherNames : null,
        motherNames: stateOfOrigin === "Ogun" ? motherNames : null,
        nativeTown: stateOfOrigin === "Ogun" ? nativeTown : null,
        nativePoliticalWard: stateOfOrigin === "Ogun" ? nativePoliticalWard : null,
        village: stateOfOrigin === "Ogun" ? village : null,
        communityHead: stateOfOrigin === "Ogun" ? communityHead : null,
        communityHeadContact: stateOfOrigin === "Ogun" ? communityHeadContact : null,
        currentAddress,
        lga,
        stateOfOrigin,
        nin,
        passport: passportData.secureUrl,
        passportPublicId: passportData.publicId, 
        docFromCommunityHead: docData?.secureUrl || null,
        docFromCommunityHeadPublicId: docData?.publicId || null,
        status: ApplicationStatus.PENDING_PAYMENT,
        user: user._id,
        pendingPaymentLink: response?.data?.link,
        isResidentOfOgun: isResidentOfOgunBool || null,
        lgaOfResident: stateOfOrigin !== "Ogun" ? lgaOfResident : null,
      });

      await application.save({ session });

      const transaction = new Transaction({
        transactionRef,
        amount: config.app.APPLICATION_AMOUNT.toString(),
        transactionType: TransactionType.APPLICATION,
        user: user._id,
        application: application._id,
      });
      await transaction.save({ session });
      await session.commitTransaction();      

      return successResponse(res, 'redirect to payment link', {
        txRef: transactionRef,
        paymentLink: response?.data?.link,
      });
    } catch (err: any) {
      await session.abortTransaction();
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      return errorResponse(res, err.message, 500);
    } finally {
      session.endSession();
    }
  },

  verifyPayment: async (req: AuthenticatedRequest, res: Response) => {
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

      const application = await Application.findById(transaction.application);
      if (!application) {
        await session.abortTransaction();
        return errorResponse(res, 'application not found', 404);
      }
      application.status = ApplicationStatus.PENDING;
      application.pendingApprovalRejectionDate = new Date();
      application.pendingPaymentLink = null;
      await application.save({ session });
      
      await session.commitTransaction();

      const user = await User.findById(application.user);
      if (!user) {
        await session.abortTransaction();
        return errorResponse(res, 'user not found', 400)
      }       

      emitter.emit('application-awaiting-approval', {
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        applicationID: application._id,
      });

      return res.redirect(`${config.app.FRONT_END_URL}/successful?ref=${transactionRef}`);
    } catch (err: any) {
      await session.abortTransaction();
      return errorResponse(res, err.message, 500);
    } finally {
      session.endSession();
    }
  },

  getUserApplications: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user;
      const applications = await Application.find({ user: user._id }).sort({ createdAt: -1 });
      return successResponse(res, 'applications retrieved successfully', { applications });
    } catch (err: any) {
      return errorResponse(res, err.message, 500);
    }
  },

  getPendingApplications: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const admin = req.user;
      
      if (admin.role === AdminRole.SUPER_ADMIN) {
        const applications = await Application.find({
          status: ApplicationStatus.PENDING,
        }).sort({ createdAt: -1 });
      
        return successResponse(res, 'pending application retrieved successfully', { applications });
      }

      const applications = await Application.find({
        status: ApplicationStatus.PENDING,
        $or: [
          { lga: admin.lga },
          { lgaOfResident: admin.lga }
        ]
      }).sort({ createdAt: -1 });

      
      return successResponse(res, 'pending application retrieved successfully', { applications });
    } catch (err: any) {
      return errorResponse(res, err.message, 500);
    }
  },

  getApprovedApplications: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const admin = req.user;

      if (admin.role === AdminRole.SUPER_ADMIN) {
          const applications = await Application.find({ 
          status: ApplicationStatus.APPROVED,
        }).sort({ createdAt: -1 }).populate('user', 'firstName lastName email');

      
        return successResponse(res, 'approved application retrieved successfully', { applications });
      }

      const applications = await Application.find({ 
        status: ApplicationStatus.APPROVED, 
        $or: [{lga: admin.lga}, {lgaOfResident: admin.lga}]
      }).sort({ createdAt: -1 }).populate('user', 'firstName lastName email');
      
      return successResponse(res, 'approved application retrieved successfully', { applications });
    } catch (err: any) {
      return errorResponse(res, err.message, 500);
    }
  },

  getRejectedApplications: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const admin = req.user;

      if (admin.role === AdminRole.SUPER_ADMIN) {
        const applications = await Application.find({ 
          status: ApplicationStatus.REJECTED,
        }).sort({ createdAt: -1 });

        return successResponse(res, 'rejected application retrieved successfully', { applications });
      }

      const applications = await Application.find({ 
        status: ApplicationStatus.REJECTED,
        $or: [{lga: admin.lga}, {lgaOfResident: admin.lga}] 
      }).sort({ createdAt: -1 });
      
      return successResponse(res, 'rejected application retrieved successfully', { applications });
    } catch (err: any) {
      return errorResponse(res, err.message, 500);
    }
  },

  approveApplicationsByAdmin: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id;
      const approve = req.query.approve;
      const admin = req.user;
      const rejectionReason = req.body.rejectionReason;

      const application = await Application.findById(id);
      if (!application) {
        return errorResponse(res, 'application not found', 404);
      }

      if (admin.lga !== application.lga && admin.lga !== application.lgaOfResident) {
         return errorResponse(res, "request revoked: officials can only approve applications relating to their respective LGA", 400);
      }

      if (application.status === ApplicationStatus.APPROVED) return errorResponse(res, 'application already approved', 400);
      if (application.status === ApplicationStatus.REJECTED) return errorResponse(res, 'application already rejected', 400);
      if (application.status === ApplicationStatus.PENDING_PAYMENT) return errorResponse(res, 'application payment not yet completed', 400);

      const user = await User.findById(application.user);
      if (!user) return errorResponse(res, 'user not found', 400);

      let certificateHash;

      if (approve === 'true') {
        application.status = ApplicationStatus.APPROVED;
        application.pendingApprovalRejectionDate = new Date();

        const certificateRef = await CertificateService.certificateReference();
        certificateHash = generateCertificateHash({
          certificateRef,
          applicationId: String(application._id),
          userId: application.user.toString(),
        });

        await Certificate.create({
          certificateRef,
          certificateHash,
          application: application._id,
          user: application.user,
        });

        emitter.emit('application-approved', {
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          applicationID: application._id,
        });
      } else {
        if (!rejectionReason) return errorResponse(res, "rejection reason is required", 400);
        application.status = ApplicationStatus.REJECTED;
        application.pendingApprovalRejectionDate = new Date();

        emitter.emit('application-rejected', {
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          applicationID: application._id,
          rejectionReason: rejectionReason,
        });
      }
      await application.save();

      return successResponse(res, 'application approved successfully', { certificateHash, application });
    } catch (err: any) {
      return errorResponse(res, err.message, 500);
    }
  },

  getApplicationSummary: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const admin = req.user;
      const lga = req.query.lga as string | undefined;

      const match: FilterQuery<IApplication> = {};

      if (lga) {
        if (admin.role !== AdminRole.SUPER_ADMIN)
          return errorResponse(res, "Unauthorized", 401);

        const validLgas = statesData["Ogun" as keyof typeof statesData];
        if (!validLgas.includes(lga)) {
          return errorResponse(res, "Invalid LGA for Ogun State", 400);
        }

        match.lga = lga;
      }

      // Role based LGA restriction
      if (admin.role !== AdminRole.SUPER_ADMIN) {
        match.lga = admin.lga;
      }

      // Date range for today
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);

      const pipeline: PipelineStage[] = [
        { $match: match },

        {
          $facet: {
            stats: [
              {
                $group: {
                  _id: null,
                  totalApplications: {
                    $sum: {
                      $cond: [
                        {
                          $in: [
                            "$status",
                            [
                              ApplicationStatus.APPROVED,
                              ApplicationStatus.REJECTED,
                              ApplicationStatus.PENDING
                            ]
                          ]
                        },
                        1,
                        0
                      ]
                    }
                  },
                  totalApproved: {
                    $sum: {
                      $cond: [{ $eq: ["$status", ApplicationStatus.APPROVED] }, 1, 0]
                    }
                  },
                  totalRejected: {
                    $sum: {
                      $cond: [{ $eq: ["$status", ApplicationStatus.REJECTED] }, 1, 0]
                    }
                  },
                  totalPending: {
                    $sum: {
                      $cond: [{ $eq: ["$status", ApplicationStatus.PENDING] }, 1, 0]
                    }
                  }
                }
              },
              {
                $project: {
                  _id: 0,
                  totalApplications: { $ifNull: ["$totalApplications", 0] },
                  totalApproved: { $ifNull: ["$totalApproved", 0] },
                  totalRejected: { $ifNull: ["$totalRejected", 0] },
                  totalPending: { $ifNull: ["$totalPending", 0] }
                }
              }
            ],

            today: [
              {
                $match: {
                  ...(match.lga && { lga: match.lga }),
                  pendingApprovalRejectionDate: {
                    $gte: startOfToday,
                    $lte: endOfToday
                  }
                }
              },
              {
                $group: {
                  _id: null,
                  todayCount: {
                    $sum: {
                      $cond: [
                        {
                          $in: [
                            "$status",
                            [
                              ApplicationStatus.APPROVED,
                              ApplicationStatus.REJECTED,
                              ApplicationStatus.PENDING
                            ]
                          ]
                        },
                        1,
                        0
                      ]
                    }
                  },
                  todayApproved: {
                    $sum: {
                      $cond: [{ $eq: ["$status", ApplicationStatus.APPROVED] }, 1, 0]
                    }
                  },
                  todayRejected: {
                    $sum: {
                      $cond: [{ $eq: ["$status", ApplicationStatus.REJECTED] }, 1, 0]
                    }
                  },
                  todayPending: {
                    $sum: {
                      $cond: [{ $eq: ["$status", ApplicationStatus.PENDING] }, 1, 0]
                    }
                  }
                }
              },
              {
                $project: {
                  _id: 0,
                  todayCount: { $ifNull: ["$todayCount", 0] },
                  todayApproved: { $ifNull: ["$todayApproved", 0] },
                  todayRejected: { $ifNull: ["$todayRejected", 0] },
                  todayPending: { $ifNull: ["$todayPending", 0] }
                }
              }
            ]
          }
        }
      ];

      const result = await Application.aggregate(pipeline);

      const stats = result[0].stats[0] || {
        totalApplications: 0,
        totalApproved: 0,
        totalRejected: 0,
        totalPending: 0
      };

      const today = result[0].today[0] || {
        todayCount: 0,
        todayApproved: 0,
        todayRejected: 0,
        todayPending: 0
      };

      return successResponse(res, "summary retrieved successfully", {
        summary: { ...stats, ...today }
      });
    } catch (error: any) {
      return errorResponse(res, error.message || "Server error fetching summary", 500);
    }
  },


  getFilteredApplications: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const admin = req.user as any; // authenticated admin
      const {
        name,
        status,
        startDate,
        endDate,
        page = 1,
        limit = 10,
        email,
      } = req.query;

      const match: FilterQuery<IApplication> = {};

      if (admin.role !== AdminRole.SUPER_ADMIN) {
        match.$or = [{ lga: admin.lga }, { lgaOfResident: admin.lga }];
      }

      if (name) {
        match.fullNames = { $regex: name as string, $options: "i" };
        const applications = await Application.find(match)
          .sort({ createdAt: -1 })
          .populate("user", "firstName lastName email");

        if (!applications.length) return errorResponse(res, "Not Found", 404);

        return successResponse(res, "filtered application(s) retrieved successfully", applications);
      }

      if (status && !Object.values(ApplicationStatus).includes(status as ApplicationStatus)) return errorResponse(res, "Invalid application status", 400);

      if (
        status &&
        Object.values(ApplicationStatus).includes(status as ApplicationStatus)
      ) {
        match.status = status as ApplicationStatus;
      }

      if (startDate || endDate) {
        match.pendingApprovalRejectionDate = {};

        // --- Validate startDate ---
        if (startDate) {
          if (!isValidDateFormat(startDate as string)) {
            return errorResponse(res, "Invalid startDate format. Expected YYYY-MM-DD.", 400);
          }

          const start = new Date(`${startDate}T00:00:00.000Z`);
          match.pendingApprovalRejectionDate.$gte = start;
        }

        // --- Validate endDate ---
        if (endDate) {
          if (!isValidDateFormat(endDate as string)) {
            return errorResponse(res, "Invalid endDate format. Expected YYYY-MM-DD.", 400);
          }

          // Set endDate to 23:59:59.999 in UTC
          const end = new Date(`${endDate}T23:59:59.999Z`);
          match.pendingApprovalRejectionDate.$lte = end;
        }
      }

      // Pagination
      const skip = (Number(page) - 1) * Number(limit);

      // Fetch applications and total count in parallel
      const [applications, total] = await Promise.all([
        Application.find(match)
          .sort({createdAt: -1})
          .skip(skip)
          .limit(Number(limit))
          .populate("user", "firstName lastName email"), // populate user info if needed
        Application.countDocuments(match),
      ]);

      if (email && (email !== null || email !== "")) {
        const formattedDateTime = formatDateTimeForFilename(new Date());
        emitter.emit('send-application-report', {
          email: email,
          applications: applications,
          nameOfFile: `application_${formattedDateTime}.csv`,
        });
      }

      return successResponse(res, "filtered applications retrieved successfully", {
        total,
        page: Number(page),
        limit: Number(limit),
        data: applications,
      });
    } catch (error: any) {
      return errorResponse(res, error.message || "Server error fetching filtered application", 500);
    }
  },
  
  downloadApplicationReport: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const admin = req.user as any; // authenticated admin
      const {
        status,
        startDate,
        endDate,
        email,
      } = req.body;

      if (!email) return errorResponse(res, "Email is required", 400);

      if (typeof email !== "string" || !isValidEmail(email)) {
        return errorResponse(res, "Invalid email address", 400);
      }

      const match: FilterQuery<IApplication> = {};

      if (admin.role !== AdminRole.SUPER_ADMIN) {
        match.$or = [{ lga: admin.lga }, { lgaOfResident: admin.lga }];
      }

      if (status && !Object.values(ApplicationStatus).includes(status as ApplicationStatus)) return errorResponse(res, "Invalid application status", 400);

      if (
        status &&
        Object.values(ApplicationStatus).includes(status as ApplicationStatus)
      ) {
        match.status = status as ApplicationStatus;
      }

      if (startDate || endDate) {
        match.pendingApprovalRejectionDate = {};

        // --- Validate startDate ---
        if (startDate) {
          if (!isValidDateFormat(startDate as string)) {
            return errorResponse(res, "Invalid startDate format. Expected YYYY-MM-DD.", 400);
          }

          const start = new Date(`${startDate}T00:00:00.000Z`);
          match.pendingApprovalRejectionDate.$gte = start;
        }

        // --- Validate endDate ---
        if (endDate) {
          if (!isValidDateFormat(endDate as string)) {
            return errorResponse(res, "Invalid endDate format. Expected YYYY-MM-DD.", 400);
          }

          // Set endDate to 23:59:59.999 in UTC
          const end = new Date(`${endDate}T23:59:59.999Z`);
          match.pendingApprovalRejectionDate.$lte = end;
        }
      }

      // Fetch applications and total count in parallel
      const [applications, total] = await Promise.all([
        Application.find(match)
          .sort({createdAt: -1})
          .populate("user", "firstName lastName email"), // populate user info if needed
        Application.countDocuments(match),
      ]);

      const formattedDateTime = formatDateTimeForFilename(new Date());
      emitter.emit('send-application-report', {
        email: email,
        applications: applications,
        nameOfFile: `report_${formattedDateTime}.csv`,
      });
        
      return successResponse(res, "applications sent to email for download", {});
    } catch (error: any) {
      return errorResponse(res, error.message || "Server error fetching filtered application", 500);
    }
  }
};



export default ApplicationController;
