import { v2 as cloudinary } from "cloudinary";
import { ICloudinaryConfig } from "../config/env";

export type StorageResourceType = "image" | "raw";

export interface IUploadedFile {
  secureUrl: string;
  publicId: string;
}

export interface ICloudinaryService {
  upload(fileBuffer: Buffer, folder: string, resourceType?: StorageResourceType): Promise<IUploadedFile>;
  delete(publicId: string, resourceType?: StorageResourceType): Promise<void>;
}

export class CloudinaryService implements ICloudinaryService {
  constructor(cloudinaryConfig: ICloudinaryConfig) {
    cloudinary.config({
      cloud_name: cloudinaryConfig.cloudName,
      api_key: cloudinaryConfig.apiKey,
      api_secret: cloudinaryConfig.apiSecret,
    });
  }

  public async upload(
    fileBuffer: Buffer,
    folder: string,
    resourceType: StorageResourceType = "image"
  ): Promise<IUploadedFile> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder, resource_type: resourceType },
        (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new Error("Upload failed"));
          resolve({ secureUrl: result.secure_url, publicId: result.public_id });
        }
      );

      uploadStream.end(fileBuffer);
    });
  }

  public async delete(publicId: string, resourceType: StorageResourceType = "image"): Promise<void> {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  }
}
