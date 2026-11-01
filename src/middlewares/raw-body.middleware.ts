import { Request, Response } from "express";

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

// Keeps the exact bytes of JSON bodies so webhook signatures can be verified
export function rawBodySaver(req: Request, _res: Response, buf: Buffer): void {
  if (buf && buf.length) {
    req.rawBody = Buffer.from(buf);
  }
}
