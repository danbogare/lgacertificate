import { PaymentStatus } from "../models/partnerTransaction.model";
import { TransactionType } from "../models/transaction.model";
import { IPartnerTransactionRepository } from "../repositories/partnerTransaction.repository";
import { IApplicationRepository } from "../repositories/application.repository";
import { ICertificateRepository } from "../repositories/certificate.repository";
import { IApplicationService } from "./application.service";
import { ICertificateService } from "./certificate.service";
import { IPartnerPaymentService } from "./partner-payment.service";

export interface IWebhookService {
  processPartnerEvent(payload: any): Promise<void>;
}

export class WebhookService implements IWebhookService {
  constructor(
    private readonly partnerTransactionRepository: IPartnerTransactionRepository,
    private readonly applicationRepository: IApplicationRepository,
    private readonly certificateRepository: ICertificateRepository,
    private readonly applicationService: IApplicationService,
    private readonly certificateService: ICertificateService,
    private readonly partnerPaymentService: IPartnerPaymentService
  ) {}

  // The partner matches a transfer to us by the dynamic account name we stored as paymentRef.
  // Before crediting we: (1) requery the partner to confirm the real status, (2) confirm the
  // amount paid equals the original requested amount, and (3) reject expired dynamic accounts.
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
    if (data.amount == null) throw new Error("Missing payment amount");

    const transaction = await this.partnerTransactionRepository.findByPaymentRef(data.beneficiaryAccountName.trim());
    if (!transaction) {
      console.log("Partner transaction not found for webhook event");
      return;
    }

    // Reject payments arriving after the dynamic virtual account has expired
    if (transaction.expiresAt && new Date(transaction.expiresAt) <= new Date()) {
      transaction.status = PaymentStatus.FAILED;
      await this.partnerTransactionRepository.save(transaction);
      console.log(`Partner transaction ${transaction.paymentRef} has expired`);
      return;
    }

    // Requery the partner so a forged notification cannot credite on its own
    const verification = await this.partnerPaymentService.verifyTransaction(data.referenceID);
    if (!verification?.success && verification?.status !== "success") {
      throw new Error("Partner transaction requery failed");
    }

    const providerData = verification?.data ?? verification;
    const providerStatus = String(providerData?.status ?? providerData?.paymentStatus ?? payload.status ?? "").toLowerCase();
    if (providerStatus !== "success" && providerStatus !== "successful" && providerStatus !== "completed") {
      transaction.status = PaymentStatus.FAILED;
      await this.partnerTransactionRepository.save(transaction);
      console.log(`Partner transaction ${transaction.paymentRef} not successful per provider (status=${providerStatus})`);
      return;
    }

    // Confirm the amount paid equals the original requested amount
    const paidAmount = Number(data.amount);
    const expectedAmount = Number(transaction.amount);
    if (!Number.isFinite(paidAmount) || !Number.isFinite(expectedAmount) || paidAmount !== expectedAmount) {
      transaction.status = PaymentStatus.FAILED;
      await this.partnerTransactionRepository.save(transaction);
      console.log(
        `Amount mismatch for ${transaction.paymentRef}: paid=${paidAmount} expected=${expectedAmount}`
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
      amount: data.amount,
    };
    transaction.settledAt = new Date();
    await this.partnerTransactionRepository.save(transaction);

    if (transaction.transactionType === TransactionType.APPLICATION) {
      const application = await this.applicationRepository.findById(transaction.applicationId);
      if (!application) return;

      this.applicationService.markAsPaid(application);
      await this.applicationRepository.save(application);
    } else {
      const certificate = await this.certificateRepository.findById(transaction.certificateId);
      if (!certificate) return;

      this.certificateService.applyVerificationPayment(certificate);
      await this.certificateRepository.save(certificate);
    }
  }
}
