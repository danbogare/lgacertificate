import { ClientSession, FilterQuery, Model, PipelineStage, Types } from "mongoose";
import { ApplicationStatus, IApplication } from "../models/application.model";
import { IApplicationSummary } from "../interfaces/application.interface";

export interface IApplicationQueryOptions {
  populateUser?: boolean;
  // Admin fields to load for approvedBy and rejectedBy; left as ids when unset
  reviewerFields?: string;
  skip?: number;
  limit?: number;
}

export interface IApplicationRepository {
  findById(id: unknown): Promise<IApplication | null>;
  findByIdWithReviewers(id: string, reviewerFields: string, populateUser?: boolean): Promise<IApplication | null>;
  findAwaitingReviewByNin(nin: string): Promise<IApplication | null>;
  findByUser(userId: unknown, reviewerFields: string): Promise<IApplication[]>;
  countByUserAndStatus(userId: unknown, status: ApplicationStatus): Promise<number>;
  find(filter: FilterQuery<IApplication>, options?: IApplicationQueryOptions): Promise<IApplication[]>;
  count(filter: FilterQuery<IApplication>): Promise<number>;
  findIds(filter: FilterQuery<IApplication>): Promise<Types.ObjectId[]>;
  getSummary(match: FilterQuery<IApplication>): Promise<IApplicationSummary>;
  create(data: Partial<IApplication>, session?: ClientSession): Promise<IApplication>;
  save(application: IApplication, session?: ClientSession): Promise<IApplication>;
}

const REVIEWED_STATUSES = [ApplicationStatus.APPROVED, ApplicationStatus.REJECTED, ApplicationStatus.PENDING];

const countWhere = (status: ApplicationStatus) => ({ $sum: { $cond: [{ $eq: ["$status", status] }, 1, 0] } });
const countReviewed = { $sum: { $cond: [{ $in: ["$status", REVIEWED_STATUSES] }, 1, 0] } };

export class ApplicationRepository implements IApplicationRepository {
  constructor(private readonly applicationModel: Model<IApplication>) {}

  public async findById(id: unknown): Promise<IApplication | null> {
    return await this.applicationModel.findById(id).exec();
  }

  public async findByIdWithReviewers(
    id: string,
    reviewerFields: string,
    populateUser = false
  ): Promise<IApplication | null> {
    const query = this.applicationModel.findById(id).populate([
      { path: "approvedBy", select: reviewerFields },
      { path: "rejectedBy", select: reviewerFields },
    ]);
    if (populateUser) query.populate("user", "firstName lastName email");
    return await query.exec();
  }

  public async findAwaitingReviewByNin(nin: string): Promise<IApplication | null> {
    return await this.applicationModel.findOne({ nin, status: ApplicationStatus.PENDING }).exec();
  }

  public async findByUser(userId: unknown, reviewerFields: string): Promise<IApplication[]> {
    return await this.applicationModel
      .find({ user: userId })
      .sort({ createdAt: -1 })
      .populate([
        { path: "approvedBy", select: reviewerFields },
        { path: "rejectedBy", select: reviewerFields },
      ])
      .exec();
  }

  public async countByUserAndStatus(userId: unknown, status: ApplicationStatus): Promise<number> {
    return await this.applicationModel.countDocuments({ user: userId, status }).exec();
  }

  public async find(filter: FilterQuery<IApplication>, options: IApplicationQueryOptions = {}): Promise<IApplication[]> {
    const query = this.applicationModel.find(filter).sort({ createdAt: -1 });
    if (options.skip !== undefined) query.skip(options.skip);
    if (options.limit !== undefined) query.limit(options.limit);
    if (options.populateUser) query.populate("user", "firstName lastName email");
    if (options.reviewerFields) {
      query.populate([
        { path: "approvedBy", select: options.reviewerFields },
        { path: "rejectedBy", select: options.reviewerFields },
      ]);
    }
    return await query.exec();
  }

  public async count(filter: FilterQuery<IApplication>): Promise<number> {
    return await this.applicationModel.countDocuments(filter).exec();
  }

  public async findIds(filter: FilterQuery<IApplication>): Promise<Types.ObjectId[]> {
    return await this.applicationModel.find(filter).distinct("_id").exec();
  }

  // Overall totals plus the totals for applications reviewed today
  public async getSummary(match: FilterQuery<IApplication>): Promise<IApplicationSummary> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $facet: {
          stats: [
            {
              $group: {
                _id: null,
                totalApplications: countReviewed,
                totalApproved: countWhere(ApplicationStatus.APPROVED),
                totalRejected: countWhere(ApplicationStatus.REJECTED),
                totalPending: countWhere(ApplicationStatus.PENDING),
              },
            },
            {
              $project: {
                _id: 0,
                totalApplications: { $ifNull: ["$totalApplications", 0] },
                totalApproved: { $ifNull: ["$totalApproved", 0] },
                totalRejected: { $ifNull: ["$totalRejected", 0] },
                totalPending: { $ifNull: ["$totalPending", 0] },
              },
            },
          ],
          today: [
            {
              $match: {
                ...(match.lga && { lga: match.lga }),
                pendingApprovalRejectionDate: { $gte: startOfToday, $lte: endOfToday },
              },
            },
            {
              $group: {
                _id: null,
                todayCount: countReviewed,
                todayApproved: countWhere(ApplicationStatus.APPROVED),
                todayRejected: countWhere(ApplicationStatus.REJECTED),
                todayPending: countWhere(ApplicationStatus.PENDING),
              },
            },
            {
              $project: {
                _id: 0,
                todayCount: { $ifNull: ["$todayCount", 0] },
                todayApproved: { $ifNull: ["$todayApproved", 0] },
                todayRejected: { $ifNull: ["$todayRejected", 0] },
                todayPending: { $ifNull: ["$todayPending", 0] },
              },
            },
          ],
        },
      },
    ];

    const [result] = await this.applicationModel.aggregate(pipeline).exec();

    const stats = result?.stats[0] ?? {
      totalApplications: 0,
      totalApproved: 0,
      totalRejected: 0,
      totalPending: 0,
    };

    const today = result?.today[0] ?? {
      todayCount: 0,
      todayApproved: 0,
      todayRejected: 0,
      todayPending: 0,
    };

    return { ...stats, ...today };
  }

  public async create(data: Partial<IApplication>, session?: ClientSession): Promise<IApplication> {
    return await new this.applicationModel(data).save({ session });
  }

  public async save(application: IApplication, session?: ClientSession): Promise<IApplication> {
    return await application.save({ session });
  }
}
