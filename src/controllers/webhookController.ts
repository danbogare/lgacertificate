import { Request, Response } from "express";
import { webhookService } from "../services/webhookService";
import { errorResponse, successResponse } from "../utils/responseUtils";

const WebhookController = {
    handlePartnerEvent: async (req: Request, res: Response) => {
        try {
            // req.body is already parsed JSON here (express.json() ran before the guard)
            const payload = req.body;

            console.log('Received webhook event:', {
                payload: payload,
            });

            await webhookService.processPartnerEvent(payload);

            // Respond quickly — most webhook senders expect a fast 2xx
            // and will retry on timeout, so avoid slow work in this request cycle
            return successResponse(res, 'OK.', {});
        } catch (err: any) {
            return errorResponse(res, err.message, 500);
        }
    },
}

export default WebhookController;