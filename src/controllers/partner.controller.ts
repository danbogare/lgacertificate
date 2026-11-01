import { Request, Response } from "express";
import { IPaymentService } from "../services/payment.service";
import { IWebhookService } from "../services/webhook.service";
import { IUser } from "../models/user.model";
import { successResponse } from "../utils/response";

export interface IPartnerController {
  handleWebhookEvent: (req: Request, res: Response) => Promise<void>;
  getPartnerTransaction: (req: Request, res: Response) => Promise<void>;
}

export class PartnerController implements IPartnerController {
  constructor(
    private readonly webhookService: IWebhookService,
    private readonly paymentService: IPaymentService
  ) {}

  public handleWebhookEvent = async (req: Request, res: Response): Promise<void> => {
    await this.webhookService.processPartnerEvent(req.body);

    successResponse(res, "OK.", {});
  };

  public getPartnerTransaction = async (req: Request, res: Response): Promise<void> => {
    const source = (req.query.source ?? req.body?.source) as string | undefined;

    const transaction = await this.paymentService.getPartnerTransaction(
      String((req.user as IUser)._id),
      req.params.sourceId as string,
      source
    );

    successResponse(res, "partner transaction retrieved", transaction);
  };
}
