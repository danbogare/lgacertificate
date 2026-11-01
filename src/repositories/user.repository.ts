import { ClientSession, Model } from "mongoose";
import { IUser } from "../models/user.model";

export interface IUserRepository {
  findById(id: unknown): Promise<IUser | null>;
  findByEmail(email: string): Promise<IUser | null>;
  create(data: Partial<IUser>): Promise<IUser>;
  save(user: IUser, session?: ClientSession): Promise<IUser>;
}

export class UserRepository implements IUserRepository {
  constructor(private readonly userModel: Model<IUser>) {}

  public async findById(id: unknown): Promise<IUser | null> {
    return await this.userModel.findById(id).exec();
  }

  public async findByEmail(email: string): Promise<IUser | null> {
    return await this.userModel.findOne({ email }).exec();
  }

  public async create(data: Partial<IUser>): Promise<IUser> {
    return await this.userModel.create(data);
  }

  public async save(user: IUser, session?: ClientSession): Promise<IUser> {
    return await user.save({ session });
  }
}
