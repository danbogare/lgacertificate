import multer from "multer";
import { RequestHandler } from "express";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];

// Files stay in memory and are streamed to Cloudinary by the services
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only .jpeg, .png, and .pdf files are allowed!"));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const uploadApplicationFiles: RequestHandler = upload.fields([
  { name: "passport", maxCount: 1 },
  { name: "docFromCommunityHead", maxCount: 1 },
]);

export const uploadSignatureFiles: RequestHandler = upload.fields([
  { name: "chairmanSignature", maxCount: 1 },
  { name: "secretarySignature", maxCount: 1 },
]);

type UploadedFiles = { [fieldname: string]: Express.Multer.File[] } | undefined;

// Picks the first file of each field from a multer .fields() upload
export const pickUploadedFiles = <K extends string>(
  files: unknown,
  fields: readonly K[]
): Partial<Record<K, Express.Multer.File>> => {
  const uploaded = files as UploadedFiles;
  const picked: Partial<Record<K, Express.Multer.File>> = {};
  for (const field of fields) {
    picked[field] = uploaded?.[field]?.[0];
  }
  return picked;
};
