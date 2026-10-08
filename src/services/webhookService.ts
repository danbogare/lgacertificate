import Application, { ApplicationStatus } from "../models/applicationModel";
import Certificate from "../models/certificationModal";
import PartnerTransaction, { PaymentStatus } from "../models/partnerTransactionModel";
import { TransactionType } from "../models/transactionModel";
import { generateRandomString } from "../utils/hash";

export const webhookService = {
    async processPartnerEvent(payload: any): Promise<void> {

        if (payload.eventType !== 'INFLOW_PAYMENT_SUCCESS') {
            console.log(`Unhandled eventType: ${payload}`);
            return;
        }

        const data = payload.data;

        if (!data) throw new Error('Missing payload data');
        if (!data.referenceID) throw new Error('Missing payment reference');
        if (!data.beneficiaryAccountName) throw new Error('Missing beneficiary account name');
        if (!data.beneficiaryAccountNumber) throw new Error('Missing beneficiary account number');

        const beneficiaryName = data.beneficiaryAccountName.trim();

        const transaction = await PartnerTransaction.findOne({ paymentRef: beneficiaryName });
        if (!transaction) {
            console.log("transaction not found");
            return
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
            eventType: payload.eventType || '',
        };

        transaction.settledAt = new Date();
        await transaction.save();

        if (transaction.transactionType === TransactionType.APPLICATION) {
            const application = await Application.findById(transaction.applicationId);
            if (!application) {
                return;
            }
            application.status = ApplicationStatus.PENDING;
            application.pendingApprovalRejectionDate = new Date();
            application.pendingPaymentLink = null;
            await application.save();
        } else {
            const certificate = await Certificate.findById(transaction.certificateId);
            if (!certificate) {
                return;
            }
            certificate.isVerificationPaymentPending = false;
            certificate.isVerificationCodeGenerated = true;
            certificate.verificationCode = `${certificate.certificateRef}-${generateRandomString(7)}`;
            certificate.pendingPaymentLink = null;
            await certificate.save();
        }

    },
};