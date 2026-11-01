import { Request, Response } from "express";
import { ISignatoryService } from "../services/signatory.service";
import { IAdmin } from "../models/admin.model";
import { pickUploadedFiles } from "../middlewares/upload.middleware";
import { successResponse } from "../utils/response";
import { getAuditContext } from "../utils/request";

export interface ISignatoryController {
  createSignatory: (req: Request, res: Response) => Promise<void>;
  updateSignatory: (req: Request, res: Response) => Promise<void>;
  getSignatory: (req: Request, res: Response) => Promise<void>;
  deleteSignatory: (req: Request, res: Response) => Promise<void>;
}

const SIGNATURE_UPLOAD_FIELDS = ["chairmanSignature", "secretarySignature"] as const;

export class SignatoryController implements ISignatoryController {
  constructor(private readonly signatoryService: ISignatoryService) {}

  public createSignatory = async (req: Request, res: Response): Promise<void> => {
    const { lga, chairmanName, secretaryName } = req.body;
    const uploads = pickUploadedFiles(req.files, SIGNATURE_UPLOAD_FIELDS);

    const signatory = await this.signatoryService.createSignatory(
      req.admin as IAdmin,
      { lga, chairmanName, secretaryName },
      uploads,
      getAuditContext(req)
    );

    successResponse(res, `Signatory for ${lga} LGA registered successfully`, signatory);
  };

  public updateSignatory = async (req: Request, res: Response): Promise<void> => {
    const { lga, chairmanName, secretaryName } = req.body;
    const uploads = pickUploadedFiles(req.files, SIGNATURE_UPLOAD_FIELDS);

    const signatory = await this.signatoryService.updateSignatory(
      req.admin as IAdmin,
      { lga, chairmanName, secretaryName },
      uploads,
      getAuditContext(req)
    );

    successResponse(res, `Signatory for ${lga} LGA updated successfully`, { signatory });
  };

  public getSignatory = async (req: Request, res: Response): Promise<void> => {
    const lga = req.params.lga as string;

    const signatory = await this.signatoryService.getSignatory(lga);

    successResponse(res, `Signatory for ${lga} LGA retrieved successfully`, signatory);
  };

  public deleteSignatory = async (req: Request, res: Response): Promise<void> => {
    const lga = req.params.lga as string;

    const signatory = await this.signatoryService.deleteSignatory(req.admin as IAdmin, lga, getAuditContext(req));

    successResponse(res, `Signatory for ${lga} LGA deleted successfully`, signatory);
  };
}
