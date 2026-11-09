import mongoose, { ClientSession } from "mongoose";
import { ITransaction, TransactionStatus, TransactionType } from "../models/transaction.model";
import {
  IPartnerTransaction,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
} from "../models/partnerTransaction.model";
import { ITransactionRepository } from "../repositories/transaction.repository";
import { IPartnerTransactionRepository } from "../repositories/partnerTransaction.repository";
import { IFlutterwaveService } from "./flutterwave.service";
import { IPartnerPaymentService } from "./partner-payment.service";
import { ICryptoService } from "./crypto.service";
import { IPaymentRedirectQuery } from "../interfaces/payment.interface";
import { BadRequestError, NotFoundError, PaymentProviderError } from "../errors/error";
import { IProcessingChargeConfig } from "../config/env";

export interface IFlutterwaveCheckout {
  // Amount we must receive; processing charges are added on top
  amount: number;
  redirectUrl: string;
  title: string;
  customer: { email: string; name: string; phone: string };
}

export interface IFlutterwaveCheckoutResult {
  transactionRef: string;
  // What the payer is charged, including processing charges
  amount: number;
  paymentLink: string;
}

export interface IPartnerPayer {
  firstName: string;
  lastName: string;
}

export interface IPartnerCheckoutResult {
  // The webhook identifies the payment by this account number and name
  accountNumber: string;
  accountName: string;
  amount: number;
  paymentData: unknown;
}

export interface IProcessingCharges {
  flutterwave: IProcessingChargeConfig;
  partner: IProcessingChargeConfig;
}

// Grosses up the amount so we still receive it in full after the gateway takes its cut plus VAT:
// C = (N + flat) / (1 - rate), with rate and flat each multiplied by (1 + vat).
// Once the charge would exceed the cap (plus VAT), the payer pays N + cap * (1 + vat).
// Rounded up to the next naira so we never land short.
export function addProcessingCharges(amount: number, { rate, flat, cap, vat }: IProcessingChargeConfig): number {
  const vatMultiplier = 1 + vat;
  const effectiveRate = rate * vatMultiplier;
  if (effectiveRate >= 1) throw new Error("Processing charge rate must be below 100%");

  const grossed = (amount + flat * vatMultiplier) / (1 - effectiveRate);
  const maxCharge = cap === undefined ? undefined : cap * vatMultiplier;
  const total = maxCharge !== undefined && grossed - amount > maxCharge ? amount + maxCharge : grossed;
  return Math.ceil(total);
}

export type FlutterwaveVerification =
  | { alreadyVerified: true; transaction: ITransaction }
  | { alreadyVerified: false; transaction: ITransaction; transactionId: number; providerRef?: string };

export interface IPaymentService {
  startFlutterwaveCheckout(checkout: IFlutterwaveCheckout): Promise<IFlutterwaveCheckoutResult>;
  startPartnerCheckout(payer: IPartnerPayer, amount: number): Promise<IPartnerCheckoutResult>;
  recordTransaction(data: Partial<ITransaction>, session?: ClientSession): Promise<ITransaction>;
  recordPartnerTransaction(data: Partial<IPartnerTransaction>, session?: ClientSession): Promise<IPartnerTransaction>;
  verifyFlutterwavePayment(query: IPaymentRedirectQuery): Promise<FlutterwaveVerification>;
  markTransactionSuccessful(
    verification: Extract<FlutterwaveVerification, { alreadyVerified: false }>,
    session?: ClientSession
  ): Promise<void>;
  getPartnerTransaction(payerId: string, sourceId: string, source?: string): Promise<IPartnerTransaction>;
}

export class PaymentService implements IPaymentService {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly partnerTransactionRepository: IPartnerTransactionRepository,
    private readonly flutterwaveService: IFlutterwaveService,
    private readonly partnerPaymentService: IPartnerPaymentService,
    private readonly cryptoService: ICryptoService,
    private readonly processingCharges: IProcessingCharges
  ) {}

  public async startFlutterwaveCheckout(checkout: IFlutterwaveCheckout): Promise<IFlutterwaveCheckoutResult> {
    const transactionRef = this.cryptoService.generateTransactionRef();
    const amount = addProcessingCharges(checkout.amount, this.processingCharges.flutterwave);

    const response = await this.flutterwaveService.initializePayment({
      tx_ref: transactionRef,
      amount: amount.toString(),
      currency: "NGN",
      redirect_url: checkout.redirectUrl,
      customer: {
        email: checkout.customer.email,
        name: checkout.customer.name,
        phone_number: checkout.customer.phone,
      },
      customizations: { title: checkout.title },
    });

    if (response.status !== "success") throw new PaymentProviderError();

    return { transactionRef, amount, paymentLink: response.data?.link };
  }

  // The partner names the account after the payer, so each account number is what makes a payment unique
  public async startPartnerCheckout(payer: IPartnerPayer, baseAmount: number): Promise<IPartnerCheckoutResult> {
    const amount = addProcessingCharges(baseAmount, this.processingCharges.partner);

    const response = await this.partnerPaymentService.createDynamicAccount({
      firstName: payer.firstName,
      lastName: payer.lastName,
      amount: amount.toString(),
    });

    if (!response.success) {
      console.error("Partner dynamic account request failed:", response);
      throw new PaymentProviderError();
    }

    const paymentData = response.data?.result?.data;
    if (!paymentData?.accountNumber || !paymentData?.accountName) {
      console.error("Partner dynamic account response is missing account details:", response);
      throw new PaymentProviderError();
    }

    return { accountNumber: paymentData.accountNumber, accountName: paymentData.accountName, amount, paymentData };
  }

  public async recordTransaction(data: Partial<ITransaction>, session?: ClientSession): Promise<ITransaction> {
    return await this.transactionRepository.create(data, session);
  }

  public async recordPartnerTransaction(
    data: Partial<IPartnerTransaction>,
    session?: ClientSession
  ): Promise<IPartnerTransaction> {
    return await this.partnerTransactionRepository.create(
      { ...data, type: PaymentType.CAPTURE, status: PaymentStatus.PENDING, method: PaymentMethod.BANK_TRANSFER },
      session
    );
  }

  // Checks a Flutterwave redirect against the provider. Failed and pending payments are
  // recorded on the transaction and rejected; a successful one is returned for the caller to finalise.
  public async verifyFlutterwavePayment(query: IPaymentRedirectQuery): Promise<FlutterwaveVerification> {
    const { tx_ref: transactionRef, status, transaction_id } = query;

    if (!transactionRef || !status || !transaction_id) {
      throw new BadRequestError("missing required query parameters");
    }

    const transaction = await this.transactionRepository.findByRef(transactionRef);
    if (!transaction) throw new BadRequestError("wrong transaction reference");

    if (status === "failed") {
      transaction.status = TransactionStatus.FAILED;
      await this.transactionRepository.save(transaction);
      throw new BadRequestError("transaction failed");
    }

    if (transaction.status === TransactionStatus.SUCCESSFUL) {
      return { alreadyVerified: true, transaction };
    }

    const transactionId = Number(transaction_id);
    const response = await this.flutterwaveService.verifyTransaction(transactionId);
    if (response?.status !== "success") throw new PaymentProviderError();

    if (response.data.status === "pending") {
      transaction.transactionId = transactionId;
      await this.transactionRepository.save(transaction);
      throw new BadRequestError("transaction still pending");
    }

    if (response.data.status !== "successful") {
      transaction.status = TransactionStatus.FAILED;
      transaction.transactionId = transactionId;
      await this.transactionRepository.save(transaction);
      throw new BadRequestError("transaction failed");
    }

    return { alreadyVerified: false, transaction, transactionId, providerRef: response.data?.flw_ref };
  }

  public async markTransactionSuccessful(
    verification: Extract<FlutterwaveVerification, { alreadyVerified: false }>,
    session?: ClientSession
  ): Promise<void> {
    const { transaction } = verification;
    transaction.status = TransactionStatus.SUCCESSFUL;
    transaction.transactionId = verification.transactionId;
    transaction.providerRef = verification.providerRef;
    await this.transactionRepository.save(transaction, session);
  }

  // sourceId is an application or certificate id; without a source both are tried
  public async getPartnerTransaction(payerId: string, sourceId: string, source?: string): Promise<IPartnerTransaction> {
    if (!mongoose.isValidObjectId(sourceId)) throw new BadRequestError("Invalid sourceId");

    let transaction: IPartnerTransaction | null;
    if (!source) {
      transaction =
        (await this.partnerTransactionRepository.findByApplicationId(sourceId)) ??
        (await this.partnerTransactionRepository.findByCertificateId(sourceId));
    } else if (source === TransactionType.APPLICATION) {
      transaction = await this.partnerTransactionRepository.findByApplicationId(sourceId);
    } else if (source === TransactionType.CERTIFICATE) {
      transaction = await this.partnerTransactionRepository.findByCertificateId(sourceId);
    } else {
      throw new BadRequestError("Invalid source type");
    }

    // Other people's transactions look the same as missing ones
    if (!transaction || transaction.payerId.toString() !== payerId) throw new NotFoundError("Transaction not found");
    return transaction;
  }
}
