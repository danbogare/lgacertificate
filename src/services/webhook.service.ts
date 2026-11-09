import { IPartnerTransaction, PaymentStatus } from "../models/partnerTransaction.model";
import { TransactionType } from "../models/transaction.model";
import { IPartnerTransactionRepository } from "../repositories/partnerTransaction.repository";
import { IApplicationRepository } from "../repositories/application.repository";
import { ICertificateRepository } from "../repositories/certificate.repository";
import { IApplicationService } from "./application.service";
import { ICertificateService } from "./certificate.service";

export interface IWebhookService {
  processPartnerEvent(payload: any): Promise<void>;
}

export class WebhookService implements IWebhookService {
  constructor(
    private readonly partnerTransactionRepository: IPartnerTransactionRepository,
    private readonly applicationRepository: IApplicationRepository,
    private readonly certificateRepository: ICertificateRepository,
    private readonly applicationService: IApplicationService,
    private readonly certificateService: ICertificateService
  ) {}

  // A transfer is matched to its transaction by the dynamic account number (stored as paymentRef) and account name.
  public async processPartnerEvent(payload: any): Promise<void> {
    if (payload.eventType !== "INFLOW_PAYMENT_SUCCESS") {
      console.log(`Unhandled eventType: ${payload.eventType}`);
      return;
    }

    const data = payload.data;
    if (!data) throw new Error("Missing payload data");
    if (!data.referenceID) throw new Error("Missing payment reference");
    if (!data.beneficiaryAccountName) throw new Error("Missing beneficiary account name");
    if (!data.beneficiaryAccountNumber) throw new Error("Missing beneficiary account number");

    // Settled transactions never match, so repeated deliveries of the same event are ignored
    const transaction = await this.findTransactionForTransfer(
      String(data.beneficiaryAccountNumber).trim(),
      data.beneficiaryAccountName
    );
    if (!transaction) {
      console.error(
        `No partner transaction matches account ${data.beneficiaryAccountNumber} (reference ${data.referenceID})`
      );
      return;
    }

    transaction.status = PaymentStatus.SUCCESS;
    transaction.metadata = {
      publishers: payload.publishers,
      transactionDate: data.transactionDate,
      originatingAccountNumber: data.originatingAccountNumber,
      originatingAccountName: data.originatingAccountName,
      status: payload.status,
      channel: payload.channel,
      sessionId: data.sessionId,
      referenceID: data.referenceID,
      beneficiaryAccountName: data.beneficiaryAccountName,
      beneficiaryAccountNumber: data.beneficiaryAccountNumber,
      eventType: payload.eventType || "",
    };
    transaction.settledAt = new Date();
    await this.partnerTransactionRepository.save(transaction);

    if (transaction.transactionType === TransactionType.APPLICATION) {
      const application = await this.applicationRepository.findById(transaction.applicationId);
      if (!application) return;

      if (this.applicationService.markAsPaid(application)) {
        await this.applicationRepository.save(application);
      } else {
        console.error(`Partner payment ${transaction._id} is for an application already paid for; refund needed`);
      }
    } else {
      const certificate = await this.certificateRepository.findById(transaction.certificateId);
      if (!certificate) return;
      if (certificate.isVerificationCodeGenerated) {
        console.error(`Partner payment ${transaction._id} is for a verification already paid for; refund needed`);
        return;
      }

      this.certificateService.applyVerificationPayment(certificate);
      await this.certificateRepository.save(certificate);
    }
  }

  // Prefers the open payment on this account. A transfer that lands after its payment expired is matched to
  // the expired transaction with the same account name, so a rotated account number never settles another
  // applicant's payment.
  private async findTransactionForTransfer(
    accountNumber: string,
    accountName: unknown
  ): Promise<IPartnerTransaction | null> {
    const pending = await this.partnerTransactionRepository.findPendingByPaymentRef(accountNumber);
    if (pending && isSameAccountName(pending.accountName, accountName)) return pending;

    const expired = await this.partnerTransactionRepository.findExpiredByPaymentRef(accountNumber);
    return expired.find((transaction) => isSameAccountName(transaction.accountName, accountName)) ?? null;
  }
}

const normalizeAccountName = (name: string): string => name.trim().replace(/\s+/g, " ").toLowerCase();

const isSameAccountName = (stored: string | undefined, received: unknown): boolean =>
  !!stored && typeof received === "string" && normalizeAccountName(stored) === normalizeAccountName(received);
