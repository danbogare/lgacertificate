import { Request, Response, NextFunction } from "express";
import { IUser } from "../models/user.model";
import { IAdmin } from "../models/admin.model";
import { IUserRepository } from "../repositories/user.repository";
import { IAdminRepository } from "../repositories/admin.repository";
import { ICryptoService } from "../services/crypto.service";
import { UnauthorizedError } from "../errors/error";

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      admin?: IAdmin;
    }
  }
}

export interface IAuthMiddleware {
  requireUser: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  requireAdmin: (req: Request, res: Response, next: NextFunction) => Promise<void>;
}

// Applicants and officials share the JWT secret but live in different collections,
// so each guard only accepts tokens whose id exists in its own collection.
export class AuthMiddleware implements IAuthMiddleware {
  constructor(
    private readonly cryptoService: ICryptoService,
    private readonly userRepository: IUserRepository,
    private readonly adminRepository: IAdminRepository
  ) {}

  public requireUser = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    req.user = await this.authenticate(req, (id) => this.userRepository.findById(id));
    next();
  };

  public requireAdmin = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    req.admin = await this.authenticate(req, (id) => this.adminRepository.findById(id));
    next();
  };

  // Any bad token or unknown account is a plain 401, without saying which check failed
  private async authenticate<T>(req: Request, findAccount: (id: string) => Promise<T | null>): Promise<T> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("Unauthorized: No token provided");
    }

    try {
      const { id } = this.cryptoService.verifyToken(authHeader.split(" ")[1] as string);
      const account = await findAccount(id);
      if (account) return account;
    } catch {
      // Falls through to the 401 below
    }

    throw new UnauthorizedError();
  }
}
