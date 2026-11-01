import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/error";

export class ErrorMiddleware {
  public handle = (error: any, _req: Request, res: Response, _next: NextFunction): void => {
    const statusCode = error instanceof AppError ? error.statusCode : 500;

    if (statusCode >= 500) console.error(error);

    res.status(statusCode).json({
      success: false,
      message: error?.message || "Internal Server Error",
    });
  };
}
