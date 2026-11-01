import { Request, Response } from "express";
import { ILocationService } from "../services/location.service";
import { successResponse } from "../utils/response";

export interface ILocationController {
  getAllStates: (req: Request, res: Response) => Promise<void>;
  getLgas: (req: Request, res: Response) => Promise<void>;
}

export class LocationController implements ILocationController {
  constructor(private readonly locationService: ILocationService) {}

  public getAllStates = async (_req: Request, res: Response): Promise<void> => {
    successResponse(res, "All States retrieved", this.locationService.getStates());
  };

  public getLgas = async (req: Request, res: Response): Promise<void> => {
    const state = req.query.state;

    const lgas = this.locationService.getLgas(state as string);
    if (!lgas) {
      // This endpoint has always answered with `error` rather than the usual shape
      res.status(404).json({ error: "State not found" });
      return;
    }

    successResponse(res, "LGAs retrieved", { state, lgas });
  };
}
