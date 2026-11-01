import Joi from "joi";
import { escapeHtml, rejectSpecialCharacters } from "./common.validator";

// Ogun-origin fields are optional here; the service enforces them for Ogun applicants
export const createApplicationSchema = Joi.object().keys({
  fullNames: Joi.string().custom(rejectSpecialCharacters).optional(),
  fatherNames: Joi.string().custom(rejectSpecialCharacters).optional(),
  dateOfBirth: Joi.string().custom(rejectSpecialCharacters).required(),
  motherNames: Joi.string().custom(rejectSpecialCharacters).optional(),
  nativeTown: Joi.string().custom(rejectSpecialCharacters).optional(),
  nativePoliticalWard: Joi.string().custom(rejectSpecialCharacters).optional(),
  nativePollingUnit: Joi.string().custom(rejectSpecialCharacters).optional(),
  communityHead: Joi.string().custom(rejectSpecialCharacters).optional(),
  communityHeadContact: Joi.string().custom(rejectSpecialCharacters).optional(),
  village: Joi.string().custom(rejectSpecialCharacters).optional(),
  nin: Joi.string().length(11).pattern(/^\d{10,15}$/).optional(),
  currentAddress: Joi.string().custom(escapeHtml).required(),
  lga: Joi.string().required(),
  stateOfOrigin: Joi.string().required(),
  isResidentOfOgun: Joi.boolean().optional(),
  lgaOfResident: Joi.string().optional(),
});
