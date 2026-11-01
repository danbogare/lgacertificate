import { ClientSession, Model } from "mongoose";
import { ITransaction } from "../models/transaction.model";

export interface ITransactionRepository {
  findByRef(transactionRef: string): Promise<ITransaction | null>;
  create(data: Partial<ITransaction>, session?: ClientSession): Promise<ITransaction>;
  save(transaction: ITransaction, session?: ClientSession): Promise<ITransaction>;
}

export class TransactionRepository implements ITransactionRepository {
  constructor(private readonly transactionModel: Model<ITransaction>) {}

  public async findByRef(transactionRef: string): Promise<ITransaction | null> {
    return await this.transactionModel.findOne({ transactionRef }).exec();
  }

  public async create(data: Partial<ITransaction>, session?: ClientSession): Promise<ITransaction> {
    return await new this.transactionModel(data).save({ session });
  }

  public async save(transaction: ITransaction, session?: ClientSession): Promise<ITransaction> {
    return await transaction.save({ session });
  }
}
