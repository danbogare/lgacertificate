import { Router } from "express";
import { ILocationController } from "../controllers/location.controller";
import { asyncHandler } from "../middlewares/async-handler.middleware";

// Mounted at /api/v1
export class LocationRouter {
  private readonly router = Router();

  constructor(private readonly locationController: ILocationController) {
    this.initializeRoutes();
  }

  public getRouter(): Router {
    return this.router;
  }

  private initializeRoutes(): void {
    this.router.get("/states", asyncHandler(this.locationController.getAllStates));
    this.router.get("/lgas", asyncHandler(this.locationController.getLgas));
  }
}
