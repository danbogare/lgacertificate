import { ClientSession, Model } from "mongoose";
import { ICounter } from "../models/counter.model";

export interface ICounterRepository {
  nextCertificateSequence(stateCode: string, lgaCode: string, session?: ClientSession): Promise<number>;
  ensureCertificateCounter(stateCode: string, lgaCode: string): Promise<void>;
}

const certificateCounterId = (stateCode: string, lgaCode: string) => `${stateCode}-${lgaCode}-CO`;

export class CounterRepository implements ICounterRepository {
  constructor(private readonly counterModel: Model<ICounter>) {}

  // Atomic increment keeps numbers unique when two officials approve at the same time
  public async nextCertificateSequence(stateCode: string, lgaCode: string, session?: ClientSession): Promise<number> {
    const counter = await this.counterModel
      .findOneAndUpdate(
        { _id: certificateCounterId(stateCode, lgaCode) },
        { $inc: { seq: 1 } },
        { upsert: true, new: true, session }
      )
      .exec();
    return counter.seq;
  }

  public async ensureCertificateCounter(stateCode: string, lgaCode: string): Promise<void> {
    await this.counterModel
      .updateOne({ _id: certificateCounterId(stateCode, lgaCode) }, { $setOnInsert: { seq: 0 } }, { upsert: true })
      .exec();
  }
}
