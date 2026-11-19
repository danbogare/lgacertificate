import { schedule } from "node-cron";
import { IPartnerTransactionRepository } from "../repositories/partnerTransaction.repository";

// Marks pending partner transactions whose dynamic virtual account has expired as FAILED,
// so unpaid accounts cannot be credited later by a stale or replayed notification.
export class PartnerExpirationService {
  private readonly task: ReturnType<typeof schedule>;

  constructor(
    private readonly partnerTransactionRepository: IPartnerTransactionRepository,
    private readonly cronExpression: string = "0 * * * *"
  ) {
    this.task = schedule(this.cronExpression, this.run);
  }

  public start(): void {
    this.task.start();
  }

  public stop(): void {
    this.task.stop();
  }

  private readonly run = async (): Promise<void> => {
    const now = new Date();
    const count = await this.partnerTransactionRepository.markExpiredPending(now);
    if (count) {
      console.log(`Marked ${count} expired partner transactions as FAILED`);
    }
  };
}
