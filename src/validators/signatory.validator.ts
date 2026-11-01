import Joi from "joi";
import { rejectSpecialCharacters } from "./common.validator";

export const createSignatorySchema = Joi.object().keys({
  lga: Joi.string().required(),
  chairmanName: Joi.string().custom(rejectSpecialCharacters).required(),
  secretaryName: Joi.string().custom(rejectSpecialCharacters).required(),
});
