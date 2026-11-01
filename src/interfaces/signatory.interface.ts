export interface ISignatoryPayload {
  lga: string;
  chairmanName: string;
  secretaryName: string;
}

export interface ISignatureUploads {
  chairmanSignature?: Express.Multer.File;
  secretarySignature?: Express.Multer.File;
}
