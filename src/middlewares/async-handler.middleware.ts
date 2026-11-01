import { Request, Response, NextFunction } from "express";

// Express 4 does not catch rejected promises, so async handlers forward them to the error middleware
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
