import { ClientSession, Model } from "mongoose";
import { IPartnerTransaction } from "../models/partnerTransaction.model";

export interface IPartnerTransactionRepository {
  findByPaymentRef(paymentRef: string): Promise<IPartnerTransaction | null>;
  findByApplicationId(applicationId: string): Promise<IPartnerTransaction | null>;
  findByCertificateId(certificateId: string): Promise<IPartnerTransaction | null>;
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

  public async create(data: Partial<IPartnerTransaction>, session?: ClientSession): Promise<IPartnerTransaction> {
    return await new this.partnerTransactionModel(data).save({ session });
  }

  public async save(transaction: IPartnerTransaction): Promise<IPartnerTransaction> {
    return await transaction.save();
  }
}
