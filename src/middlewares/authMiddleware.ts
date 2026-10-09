import { NextFunction, Request, Response } from "express";
import { errorResponse } from "../utils/responseUtils";
import { verifyToken } from "../utils/jwtHandler";
import User from "../models/userModel";
import Admin, { AdminRole } from "../models/adminModel";

export interface AuthenticatedRequest extends Request {
    user?: any;
}

export const authMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) return errorResponse(res, "Unauthorized: No token provided", 401);

        const token = authHeader.split(" ")[1];

        // Verify the token
        const decoded = verifyToken(token);
        // get user
        const user = await User.findById((decoded as any).id);
        if (!user) return errorResponse(res, "Unauthorized", 401);
        
        req.user = user;

        next();
    } catch (error) {
        errorResponse(res, "Unauthorized", 401);
    }
}

export const adminAuthMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) return errorResponse(res, "Unauthorized: No token provided", 401);

        const token = authHeader.split(" ")[1];

        // Verify the token
        const decoded = verifyToken(token);
        
        // get admin
        const admin = await Admin.findById((decoded as any).id);
        if (!admin) return errorResponse(res, "Unauthorized", 401);
        
        req.user = admin;

        next();
    } catch (error) {
        errorResponse(res, "Unauthorized", 401);
    }
}