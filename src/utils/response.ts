import { Response } from "express";

export const successResponse = <T>(res: Response, message: string, data: T) => {
  return res.status(200).json({ success: true, message, data });
};

export const errorResponse = (res: Response, statusCode: number, message: string) => {
  return res.status(statusCode).json({ success: false, message });
};
