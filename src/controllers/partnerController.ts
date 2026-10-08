import { Request, Response } from "express";
import { webhookService } from "../services/webhookService";
import { errorResponse, successResponse } from "../utils/responseUtils";
import { TransactionType } from "../models/transactionModel";
import PartnerTransaction, { IPartnerTransaction } from "../models/partnerTransactionModel";

const PartnerController = {
    getPartnerTransaction: async (req: Request, res: Response) => {
        try {
            const sourceId = req.params.sourceId as string;
            const source = req.params.source as string;

            if (!sourceId || !source) {
                return errorResponse(res, 'Missing sourceId or source', 400);
            }

            let transaction: IPartnerTransaction | null = null;

            if (source === TransactionType.APPLICATION) {
                transaction = await PartnerTransaction.findOne({ applicationId: sourceId });
            } else if (source === TransactionType.CERTIFICATE) {
                transaction = await PartnerTransaction.findOne({ certificateId: sourceId });
            } else {
                return errorResponse(res, 'Invalid source type', 400);
            }

            if (!transaction) {
                return errorResponse(res, 'Transaction not found', 404);
            }

            return successResponse(res, "partner transaction retrieved", transaction);
        } catch (err: any) {
            return errorResponse(res, err.message, 500);
        }
    },
}

export default PartnerController;