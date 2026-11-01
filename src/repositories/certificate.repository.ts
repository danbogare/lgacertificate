import { ClientSession, Model, Types } from "mongoose";
import { ICertificate } from "../models/certificate.model";
import { IApplication } from "../models/application.model";

// Internal application fields that applicants and officials should not see
const APPLICATION_PUBLIC_FIELDS =
  "-pendingPaymentLink -passportPublicId -docFromCommunityHeadPublicId -pendingApprovalRejectionDate";

export type CertificateWithApplication = Omit<ICertificate, "application"> & { application: IApplication };

export interface ICertificateRepository {
  findById(id: unknown): Promise<ICertificate | null>;
  findByIdWithApplication(id: string): Promise<CertificateWithApplication | null>;
  findByIdForView(id: string): Promise<any | null>;
  findByUserAndApplication(userId: unknown, applicationId: string): Promise<ICertificate | null>;
  findByRef(certificateRef: string): Promise<ICertificate | null>;
  findByRefWithDetails(certificateRef: string): Promise<ICertificate | null>;
  findByHashWithDetails(certificateHash: string): Promise<ICertificate | null>;
  findByUser(userId: unknown): Promise<unknown[]>;
  findByApplicationForUser(applicationId: string, userId: unknown): Promise<unknown | null>;
  findByApplications(applicationIds: Types.ObjectId[]): Promise<unknown[]>;
  create(data: Partial<ICertificate>, session?: ClientSession): Promise<ICertificate>;
  save(certificate: ICertificate, session?: ClientSession): Promise<ICertificate>;
}

export class CertificateRepository implements ICertificateRepository {
  constructor(private readonly certificateModel: Model<ICertificate>) {}

  public async findById(id: unknown): Promise<ICertificate | null> {
    return await this.certificateModel.findById(id).exec();
  }

  public async findByIdWithApplication(id: string): Promise<CertificateWithApplication | null> {
    return (await this.certificateModel
      .findById(id)
      .populate<{ application: IApplication }>("application")
      .exec()) as CertificateWithApplication | null;
  }

  public async findByIdForView(id: string): Promise<any | null> {
    return await this.certificateModel
      .findById(id)
      .populate({ path: "application", select: APPLICATION_PUBLIC_FIELDS })
      .populate({ path: "revokedBy", select: "firstName middleName lastName email phone stateOfOrigin" })
      .lean()
      .exec();
  }

  public async findByUserAndApplication(userId: unknown, applicationId: string): Promise<ICertificate | null> {
    return await this.certificateModel.findOne({ user: userId, application: applicationId }).exec();
  }

  public async findByRef(certificateRef: string): Promise<ICertificate | null> {
    return await this.certificateModel.findOne({ certificateRef }).exec();
  }

  public async findByRefWithDetails(certificateRef: string): Promise<ICertificate | null> {
    return await this.certificateModel
      .findOne({ certificateRef })
      .populate("application")
      .populate("user", "firstName lastName email")
      .exec();
  }

  public async findByHashWithDetails(certificateHash: string): Promise<ICertificate | null> {
    return await this.certificateModel.findOne({ certificateHash }).populate("application").populate("user").exec();
  }

  public async findByUser(userId: unknown): Promise<unknown[]> {
    return await this.certificateModel
      .find({ user: userId })
      .populate({ path: "application", select: APPLICATION_PUBLIC_FIELDS })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  public async findByApplicationForUser(applicationId: string, userId: unknown): Promise<unknown | null> {
    return await this.certificateModel
      .findOne({ application: applicationId, user: userId })
      .populate({ path: "application", select: APPLICATION_PUBLIC_FIELDS })
      .lean()
      .exec();
  }

  public async findByApplications(applicationIds: Types.ObjectId[]): Promise<unknown[]> {
    return await this.certificateModel
      .find({ application: { $in: applicationIds } })
      .sort({ createdAt: -1 })
      .populate({ path: "application", select: APPLICATION_PUBLIC_FIELDS })
      .lean()
      .exec();
  }

  public async create(data: Partial<ICertificate>, session?: ClientSession): Promise<ICertificate> {
    const [certificate] = await this.certificateModel.create([data], { session });
    return certificate as ICertificate;
  }

  public async save(certificate: ICertificate, session?: ClientSession): Promise<ICertificate> {
    return await certificate.save({ session });
  }
}
