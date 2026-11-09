import { ClientSession, Model, Types } from "mongoose";
import { IPartnerTransaction, PaymentStatus } from "../models/partnerTransaction.model";

export interface IPartnerTransactionRepository {
  findPendingByPaymentRef(paymentRef: string): Promise<IPartnerTransaction | null>;
  findExpiredByPaymentRef(paymentRef: string): Promise<IPartnerTransaction[]>;
  findByApplicationId(applicationId: string): Promise<IPartnerTransaction | null>;
  findByCertificateId(certificateId: string): Promise<IPartnerTransaction | null>;
  create(data: Partial<IPartnerTransaction>, session?: ClientSession): Promise<IPartnerTransaction>;
  save(transaction: IPartnerTransaction): Promise<IPartnerTransaction>;
  findPendingCreatedBefore(cutoff: Date): Promise<IPartnerTransaction[]>;
  markPendingAsFailed(ids: Types.ObjectId[]): Promise<number>;
  findCertificateIdsWithPending(certificateIds: Types.ObjectId[]): Promise<Types.ObjectId[]>;
}

export class PartnerTransactionRepository implements IPartnerTransactionRepository {
  constructor(private readonly partnerTransactionModel: Model<IPartnerTransaction>) {}

  public async findPendingByPaymentRef(paymentRef: string): Promise<IPartnerTransaction | null> {
    return await this.partnerTransactionModel.findOne({ paymentRef, status: PaymentStatus.PENDING }).exec();
  }

  // Partner transactions only become FAILED through the expiry job; newest first
  public async findExpiredByPaymentRef(paymentRef: string): Promise<IPartnerTransaction[]> {
    return await this.partnerTransactionModel
      .find({ paymentRef, status: PaymentStatus.FAILED })
      .sort({ createdAt: -1 })
      .limit(10)
      .exec();
  }

  public async findByApplicationId(applicationId: string): Promise<IPartnerTransaction | null> {
    return await this.partnerTransactionModel.findOne({ applicationId }).sort({ createdAt: -1 }).exec();
  }

  public async findByCertificateId(certificateId: string): Promise<IPartnerTransaction | null> {
    return await this.partnerTransactionModel.findOne({ certificateId }).sort({ createdAt: -1 }).exec();
  }

  public async create(data: Partial<IPartnerTransaction>, session?: ClientSession): Promise<IPartnerTransaction> {
    return await new this.partnerTransactionModel(data).save({ session });
  }

  public async save(transaction: IPartnerTransaction): Promise<IPartnerTransaction> {
    return await transaction.save();
  }

  public async findPendingCreatedBefore(cutoff: Date): Promise<IPartnerTransaction[]> {
    return await this.partnerTransactionModel
      .find({ status: PaymentStatus.PENDING, createdAt: { $lt: cutoff } })
      .select("_id certificateId")
      .exec();
  }

  // Still filtered on PENDING so a webhook that lands mid-run is not overwritten
  public async markPendingAsFailed(ids: Types.ObjectId[]): Promise<number> {
    const result = await this.partnerTransactionModel
      .updateMany({ _id: { $in: ids }, status: PaymentStatus.PENDING }, { $set: { status: PaymentStatus.FAILED } })
      .exec();
    return result.modifiedCount;
  }

  public async findCertificateIdsWithPending(certificateIds: Types.ObjectId[]): Promise<Types.ObjectId[]> {
    return await this.partnerTransactionModel
      .distinct("certificateId", { certificateId: { $in: certificateIds }, status: PaymentStatus.PENDING })
      .exec();
  }
}
