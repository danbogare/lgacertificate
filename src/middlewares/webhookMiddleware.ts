import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/responseUtils';
import crypto from 'crypto';

export function webhookSignatureGuard(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    try {
        const signature = req.headers['x-webhook-signature'] as string | undefined;
        const timestamp = req.headers['x-webhook-timestamp'] as string | undefined;

        if (!signature || !timestamp) {
            return errorResponse(res, 'Missing webhook signature headers', 401);
        }

        const rawBody = req.rawBody as any;
        if (!rawBody) {
            return errorResponse(res, 'Raw body not available for verification', 400);
        }

        const expectedSignature = crypto
            .createHmac('sha256', process.env.PARTNER_SECRET as string)
            .update(rawBody)
            .digest('hex');

        const isValid = timingSafeCompare(signature, expectedSignature);
        if (!isValid) {
            return errorResponse(res, 'Invalid webhook signature', 401);
        }

        next();
    } catch (err) {
        errorResponse(res, "Unauthorized", 401);
    }
}

function timingSafeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}