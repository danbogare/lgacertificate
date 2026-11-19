import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";

// Forces HTTPS in production: redirects plaintext requests and sets HSTS so
// browsers never negotiate plaintext for this host again. Money transfer and
// all other traffic must never travel unencrypted over the network.
export function requireHttps(_req: Request, res: Response, next: NextFunction): void {
  if (env.nodeEnv !== "production") {
    next();
    return;
  }

  const isSecure =
    _req.secure ||
    _req.headers["x-forwarded-proto"] === "https" ||
    _req.headers["x-forwarded-ssl"] === "on";

  if (!isSecure) {
    res.redirect(301, `https://${_req.headers.host}${_req.originalUrl}`);
    return;
  }

  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
}
