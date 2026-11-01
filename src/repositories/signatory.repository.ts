import { Model } from "mongoose";
import { ISignatory } from "../models/signatory.model";

export interface ISignatoryRepository {
  findByLga(lga: string): Promise<ISignatory | null>;
  create(data: Partial<ISignatory>): Promise<ISignatory>;
  updateByLga(lga: string, data: Partial<ISignatory>): Promise<ISignatory | null>;
  deleteByLga(lga: string): Promise<void>;
}

export class SignatoryRepository implements ISignatoryRepository {
  constructor(private readonly signatoryModel: Model<ISignatory>) {}

  public async findByLga(lga: string): Promise<ISignatory | null> {
    return await this.signatoryModel.findOne({ lga }).exec();
  }

  public async create(data: Partial<ISignatory>): Promise<ISignatory> {
    return await this.signatoryModel.create(data);
  }

  // Resolves to the document as it was before the update
  public async updateByLga(lga: string, data: Partial<ISignatory>): Promise<ISignatory | null> {
    return await this.signatoryModel.findOneAndUpdate({ lga }, data).exec();
  }

  public async deleteByLga(lga: string): Promise<void> {
    await this.signatoryModel.findOneAndDelete({ lga }).exec();
  }
}
