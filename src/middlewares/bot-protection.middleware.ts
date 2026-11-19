import { Request, Response, NextFunction } from "express";
import { errorResponse } from "../utils/response";

// Known AI agent / crawler user-agents that should not scrape this API.
// Matching is case-insensitive and substring-based so variants are caught too.
const AI_CRAWLER_PATTERNS = [
  "gptbot",
  "chatgpt-user",
  "anthropic-ai",
  "claude",
  "perplexitybot",
  "perplexity",
  "google-extended",
  "googlesystem",
  "ai2",
  "cohere-ai",
  "differbot",
  "diffbot",
  "facebookexternalhit",
  "twitterbot",
  "linkedinbot",
  "slackbot",
  "discordbot",
  "applebot",
  "semrushbot",
  "ahrefsbot",
  "mj12bot",
  "dotbot",
  "barkrowler",
  "crawl",
  "spider",
  "bot",
];

export function isAICrawler(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return AI_CRAWLER_PATTERNS.some((pattern) => ua.includes(pattern));
}

export interface IBotProtectionMiddleware {
  blockAICrawlers: (req: Request, res: Response, next: NextFunction) => void;
}

export class BotProtectionMiddleware implements IBotProtectionMiddleware {
  constructor(private readonly allowEmptyUserAgent: boolean = false) {}

  public blockAICrawlers = (req: Request, res: Response, next: NextFunction): void => {
    const userAgent = req.headers["user-agent"];

    if (!userAgent) {
      if (!this.allowEmptyUserAgent) {
        errorResponse(res, 403, "User-Agent is required");
        return;
      }
      next();
      return;
    }

    if (isAICrawler(userAgent)) {
      errorResponse(res, 403, "Automated clients are not allowed");
      return;
    }

    next();
  };
}
