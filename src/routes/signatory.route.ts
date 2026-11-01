import { Router } from "express";
import { ISignatoryController } from "../controllers/signatory.controller";
import { IAuthMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import { asyncHandler } from "../middlewares/async-handler.middleware";
import { uploadSignatureFiles } from "../middlewares/upload.middleware";
import { createSignatorySchema } from "../validators/signatory.validator";

// Mounted at /api/v1/signatory
export class SignatoryRouter {
  private readonly router = Router();

  constructor(
    private readonly signatoryController: ISignatoryController,
    private readonly authMiddleware: IAuthMiddleware
  ) {
    this.initializeRoutes();
  }

  public getRouter(): Router {
    return this.router;
  }

  private initializeRoutes(): void {
    const requireAdmin = asyncHandler(this.authMiddleware.requireAdmin);

    this.router.get("/:lga", asyncHandler(this.signatoryController.getSignatory));
    this.router.post(
      "/",
      requireAdmin,
      uploadSignatureFiles,
      validate(createSignatorySchema),
      asyncHandler(this.signatoryController.createSignatory)
    );
    this.router.put(
      "/",
      requireAdmin,
      uploadSignatureFiles,
      validate(createSignatorySchema),
      asyncHandler(this.signatoryController.updateSignatory)
    );
    this.router.delete("/:lga", requireAdmin, asyncHandler(this.signatoryController.deleteSignatory));
  }
}
