import { Model } from "mongoose";
import { IAdmin } from "../models/admin.model";

export interface IAdminRepository {
  findById(id: unknown): Promise<IAdmin | null>;
  findByEmail(email: string): Promise<IAdmin | null>;
  create(data: Partial<IAdmin>): Promise<IAdmin>;
  save(admin: IAdmin): Promise<IAdmin>;
}

export class AdminRepository implements IAdminRepository {
  constructor(private readonly adminModel: Model<IAdmin>) {}

  public async findById(id: unknown): Promise<IAdmin | null> {
    return await this.adminModel.findById(id).exec();
  }

  public async findByEmail(email: string): Promise<IAdmin | null> {
    return await this.adminModel.findOne({ email }).exec();
  }

  public async create(data: Partial<IAdmin>): Promise<IAdmin> {
    return await this.adminModel.create(data);
  }

  public async save(admin: IAdmin): Promise<IAdmin> {
    return await admin.save();
  }
}
