import { Model } from "mongoose";
import { IRequestDump } from "../models/requestDump.model";

export interface IRequestDumpRepository {
  create(data: Partial<IRequestDump>): Promise<IRequestDump>;
}

export class RequestDumpRepository implements IRequestDumpRepository {
  constructor(private readonly requestDumpModel: Model<IRequestDump>) {}

  public async create(data: Partial<IRequestDump>): Promise<IRequestDump> {
    return await this.requestDumpModel.create(data);
  }
}
