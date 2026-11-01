import { IAdmin } from "../models/admin.model";
import { ISignatory } from "../models/signatory.model";
import { ISignatoryRepository } from "../repositories/signatory.repository";
import { ICloudinaryService } from "./storage.service";
import { IAuditService } from "./audit.service";
import { IAuditContext } from "../interfaces/audit.interface";
import { AuditAction, AuditTargetType } from "../models/auditLog.model";
import { ISignatoryPayload, ISignatureUploads } from "../interfaces/signatory.interface";
import { BadRequestError } from "../errors/error";
import { HOME_STATE, isValidLga } from "../utils/states";

const SIGNATURE_MIME_TYPES = ["image/jpeg", "image/png", "image/jpg"];

export interface ISignatoryService {
  createSignatory(
    admin: IAdmin,
    payload: ISignatoryPayload,
    uploads: ISignatureUploads,
    context: IAuditContext
  ): Promise<ISignatory>;
  updateSignatory(
    admin: IAdmin,
    payload: ISignatoryPayload,
    uploads: ISignatureUploads,
    context: IAuditContext
  ): Promise<ISignatory | null>;
  getSignatory(lga: string): Promise<ISignatory>;
  deleteSignatory(admin: IAdmin, lga: string, context: IAuditContext): Promise<ISignatory>;
}

// Each LGA has one chairman/secretary pair whose signatures appear on its certificates
export class SignatoryService implements ISignatoryService {
  constructor(
    private readonly signatoryRepository: ISignatoryRepository,
    private readonly storageService: ICloudinaryService,
    private readonly auditService: IAuditService
  ) {}

  public async createSignatory(
    admin: IAdmin,
    payload: ISignatoryPayload,
    uploads: ISignatureUploads,
    context: IAuditContext
  ) {
    const { chairmanSignature, secretarySignature } = this.validateSignatures(uploads);
    this.assertValidLga(payload.lga);
    this.assertOwnLga(admin, payload.lga, "register");

    const existing = await this.signatoryRepository.findByLga(payload.lga);
    if (existing) throw new BadRequestError("Signatory already exist");

    const signatures = await this.uploadSignatures(chairmanSignature, secretarySignature);

    const signatory = await this.signatoryRepository.create({
      lga: payload.lga,
      chairmanName: payload.chairmanName,
      secretaryName: payload.secretaryName,
      ...signatures,
    });

    await this.recordChange(admin, AuditAction.SIGNATORY_CREATED, signatory, context, {
      chairmanName: payload.chairmanName,
      secretaryName: payload.secretaryName,
    });

    return signatory;
  }

  // Resolves to the signatory as it was before the update
  public async updateSignatory(
    admin: IAdmin,
    payload: ISignatoryPayload,
    uploads: ISignatureUploads,
    context: IAuditContext
  ) {
    const { chairmanSignature, secretarySignature } = this.validateSignatures(uploads);
    this.assertValidLga(payload.lga);
    this.assertOwnLga(admin, payload.lga, "update");

    const existing = await this.signatoryRepository.findByLga(payload.lga);
    if (!existing) throw new BadRequestError("Signatory does not exist");

    await this.deleteSignatures(existing);
    const signatures = await this.uploadSignatures(chairmanSignature, secretarySignature);

    const previous = await this.signatoryRepository.updateByLga(payload.lga, {
      chairmanName: payload.chairmanName,
      secretaryName: payload.secretaryName,
      ...signatures,
    });

    await this.recordChange(admin, AuditAction.SIGNATORY_UPDATED, existing, context, {
      previous: { chairmanName: existing.chairmanName, secretaryName: existing.secretaryName },
      chairmanName: payload.chairmanName,
      secretaryName: payload.secretaryName,
    });

    return previous;
  }

  public async getSignatory(lga: string): Promise<ISignatory> {
    this.assertValidLga(lga);

    const signatory = await this.signatoryRepository.findByLga(lga);
    if (!signatory) throw new BadRequestError("Signatory does not exist");

    return signatory;
  }

  public async deleteSignatory(admin: IAdmin, lga: string, context: IAuditContext): Promise<ISignatory> {
    this.assertValidLga(lga);
    this.assertOwnLga(admin, lga, "delete");

    const signatory = await this.signatoryRepository.findByLga(lga);
    if (!signatory) throw new BadRequestError("Signatory does not exist");

    await this.deleteSignatures(signatory);
    await this.signatoryRepository.deleteByLga(lga);

    await this.recordChange(admin, AuditAction.SIGNATORY_DELETED, signatory, context, {
      chairmanName: signatory.chairmanName,
      secretaryName: signatory.secretaryName,
    });

    return signatory;
  }

  private validateSignatures(uploads: ISignatureUploads) {
    const { chairmanSignature, secretarySignature } = uploads;

    if (!chairmanSignature || !secretarySignature) {
      throw new BadRequestError("Both chairman signature and secretary signature are required");
    }
    if (!SIGNATURE_MIME_TYPES.includes(chairmanSignature.mimetype)) {
      throw new BadRequestError("chairman signature must be a JPG or PNG image");
    }
    if (!SIGNATURE_MIME_TYPES.includes(secretarySignature.mimetype)) {
      throw new BadRequestError("secretary signature must be a JPG or PNG image");
    }

    return { chairmanSignature, secretarySignature };
  }

  private assertValidLga(lga: string): void {
    if (!isValidLga(HOME_STATE, lga)) throw new BadRequestError("Invalid LGA for Ogun state");
  }

  private assertOwnLga(admin: IAdmin, lga: string, action: "register" | "update" | "delete"): void {
    if (lga !== admin.lga) {
      throw new BadRequestError(
        `request revoked: officials can only ${action} signatories relating to their respective LGA`
      );
    }
  }

  private async uploadSignatures(chairmanSignature: Express.Multer.File, secretarySignature: Express.Multer.File) {
    const [chairman, secretary] = await Promise.all([
      this.storageService.upload(chairmanSignature.buffer, "signatory", "image"),
      this.storageService.upload(secretarySignature.buffer, "signatory", "image"),
    ]);

    return {
      chairmanSignature: chairman.secureUrl,
      chairmanSignaturePublicId: chairman.publicId,
      secretarySignature: secretary.secureUrl,
      secretarySignaturePublicId: secretary.publicId,
    };
  }

  private async recordChange(
    admin: IAdmin,
    action: AuditAction,
    signatory: ISignatory,
    context: IAuditContext,
    details: Record<string, unknown>
  ): Promise<void> {
    await this.auditService.record(
      {
        admin: admin._id as any,
        action,
        target: { type: AuditTargetType.SIGNATORY, id: signatory._id },
        details: { lga: signatory.lga, ...details },
      },
      context
    );
  }

  private async deleteSignatures(signatory: ISignatory): Promise<void> {
    await Promise.all([
      this.storageService.delete(signatory.chairmanSignaturePublicId, "image"),
      this.storageService.delete(signatory.secretarySignaturePublicId, "image"),
    ]);
  }
}
