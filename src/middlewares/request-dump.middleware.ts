import { randomUUID } from "crypto";
import { Request, Response, NextFunction, RequestHandler } from "express";
import { RequestDirection, RequestProvider } from "../models/requestDump.model";
import { IRequestDumpRepository } from "../repositories/requestDump.repository";
import { redactHeaders } from "../utils/request";

export interface IRequestDumpMiddleware {
  recordInbound(provider: RequestProvider): RequestHandler;
}

export class RequestDumpMiddleware implements IRequestDumpMiddleware {
  constructor(private readonly requestDumpRepository: IRequestDumpRepository) {}

  // Mounted before signature checks so rejected webhooks are recorded along with the reply we sent
  public recordInbound = (provider: RequestProvider): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const startedAt = Date.now();
      let responseBody: unknown;

      const sendJson = res.json.bind(res);
      res.json = (body: unknown) => {
        responseBody = body;
        return sendJson(body);
      };

      res.on("finish", () => {
        this.requestDumpRepository
          .create({
            requestId: randomUUID(),
            provider,
            direction: RequestDirection.INBOUND,
            method: req.method,
            url: req.originalUrl,
            requestHeaders: redactHeaders(req.headers),
            requestBody: req.body,
            responseStatus: res.statusCode,
            responseBody,
            durationMs: Date.now() - startedAt,
          })
          .catch((error) => console.error(`Failed to save request dump for ${req.method} ${req.originalUrl}:`, error));
      });

      next();
    };
  };
}
