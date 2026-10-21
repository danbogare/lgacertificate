import mongoose, { Schema } from "mongoose";
 
export interface ICounter {
  _id: string; // e.g. "OG-OWL-CO"
  seq: number;
}
 
const counterSchema = new Schema<ICounter>({
  _id: { type: String },
  seq: { type: Number, default: 0 },
});
 
const Counter = mongoose.model<ICounter>("Counter", counterSchema);
export default Counter;