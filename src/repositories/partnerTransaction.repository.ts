import { ClientSession, Model } from "mongoose";
import { IPartnerTransaction, PaymentStatus } from "../models/partnerTransaction.model";

export interface IPartnerTransactionRepository {
  findByPaymentRef(paymentRef: string): Promise<IPartnerTransaction | null>;
  findByApplicationId(applicationId: string): Promise<IPartnerTransaction | null>;
  findByCertificateId(certificateId: string): Promise<IPartnerTransaction | null>;
  markExpiredPending(now: Date): Promise<number>;
  create(data: Partial<IPartnerTransaction>, session?: ClientSession): Promise<IPartnerTransaction>;
  save(transaction: IPartnerTransaction): Promise<IPartnerTransaction>;
}

export class PartnerTransactionRepository implements IPartnerTransactionRepository {
  constructor(private readonly partnerTransactionModel: Model<IPartnerTransaction>) {}

  public async findByPaymentRef(paymentRef: string): Promise<IPartnerTransaction | null> {
    return await this.partnerTransactionModel.findOne({ paymentRef }).exec();
  }

  public async findByApplicationId(applicationId: string): Promise<IPartnerTransaction | null> {
    return await this.partnerTransactionModel.findOne({ applicationId }).exec();
  }

  public async findByCertificateId(certificateId: string): Promise<IPartnerTransaction | null> {
    return await this.partnerTransactionModel.findOne({ certificateId }).exec();
  }

  public async markExpiredPending(now: Date): Promise<number> {
    const result = await this.partnerTransactionModel.updateMany(
      { status: PaymentStatus.PENDING, expiresAt: { $lte: now } },
      { $set: { status: PaymentStatus.FAILED } }
    );
    return result.modifiedCount;
  }

  public async create(data: Partial<IPartnerTransaction>, session?: ClientSession): Promise<IPartnerTransaction> {
    return await new this.partnerTransactionModel(data).save({ session });
  }

  public async save(transaction: IPartnerTransaction): Promise<IPartnerTransaction> {
    return await transaction.save();
  }
}
