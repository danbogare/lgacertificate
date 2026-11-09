import cron, { ScheduledTask } from "node-cron";
import { Types } from "mongoose";
import { IPartnerTransactionRepository } from "../repositories/partnerTransaction.repository";
import { ICertificateRepository } from "../repositories/certificate.repository";

// Marks partner transactions that were never paid as FAILED once the account's payment window
// (plus a grace period for slow webhooks) has passed. Applications stay pending_payment so the
// applicant can pay again; a certificate's pending flag is cleared unless a newer attempt is open.
export async function expirePartnerPayments(
  partnerTransactionRepository: IPartnerTransactionRepository,
  certificateRepository: ICertificateRepository,
  timeoutMinutes: number
): Promise<number> {
  const cutoff = new Date(Date.now() - timeoutMinutes * 60_000);
  const stale = await partnerTransactionRepository.findPendingCreatedBefore(cutoff);
  if (stale.length === 0) return 0;

  const staleIds = stale.map((transaction) => transaction._id as Types.ObjectId);
  const expiredCount = await partnerTransactionRepository.markPendingAsFailed(staleIds);

  const certificateIds = stale.flatMap((transaction) => (transaction.certificateId ? [transaction.certificateId] : []));
  if (certificateIds.length > 0) {
    const stillPending = new Set(
      (await partnerTransactionRepository.findCertificateIdsWithPending(certificateIds)).map(String)
    );
    const idle = certificateIds.filter((id) => !stillPending.has(String(id)));
    if (idle.length > 0) await certificateRepository.clearPendingVerificationPayment(idle);
  }

  return expiredCount;
}

export function schedulePartnerPaymentExpiry(
  partnerTransactionRepository: IPartnerTransactionRepository,
  certificateRepository: ICertificateRepository,
  timeoutMinutes: number
): ScheduledTask {
  // Every 5 minutes is precise enough against a 5-hour payment window
  return cron.schedule(
    "*/5 * * * *",
    async () => {
      try {
        const expired = await expirePartnerPayments(partnerTransactionRepository, certificateRepository, timeoutMinutes);
        if (expired > 0) console.log(`Marked ${expired} unpaid partner transaction(s) as failed`);
      } catch (error) {
        console.error("Partner payment expiry job failed:", error);
      }
    },
    { name: "partner-payment-expiry", noOverlap: true }
  );
}
