import mongoose, { Schema, Document } from "mongoose";

export interface ISignatory extends Document {
  lga: string;
  chairmanName: string;
  secretaryName: string;
  chairmanSignature: string;
  chairmanSignaturePublicId: string;
  secretarySignature: string;
  secretarySignaturePublicId: string;
}

const signatorySchema = new Schema<ISignatory>(
  {
    lga: { type: String, required: true },
    chairmanName: { type: String, required: true },
    secretaryName: { type: String, required: true },
    chairmanSignature: { type: String, required: true },
    chairmanSignaturePublicId: { type: String, required: true },
    secretarySignature: { type: String, required: true },
    secretarySignaturePublicId: { type: String, required: true },
  },
  { timestamps: true }
);

export const Signatory = mongoose.model<ISignatory>("Signatory", signatorySchema);
