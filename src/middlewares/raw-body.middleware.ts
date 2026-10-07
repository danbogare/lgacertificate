import { Request } from 'express';

// Extend Express's Request type to carry rawBody
declare global {
    namespace Express {
        interface Request {
            rawBody?: Buffer;
        }
    }
}

export function rawBodySaver(req: Request, res: any, buf: Buffer): void {
    if (buf && buf.length) {
        req.rawBody = Buffer.from(buf);
    }
}