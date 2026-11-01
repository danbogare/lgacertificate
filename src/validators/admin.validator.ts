import Joi from "joi";
import { escapeHtml, rejectSpecialCharacters } from "./common.validator";

export const createAdminSchema = Joi.object().keys({
  firstName: Joi.string().custom(rejectSpecialCharacters).required(),
  lastName: Joi.string().custom(rejectSpecialCharacters).required(),
  email: Joi.string().email().required(),
  position: Joi.string().custom(rejectSpecialCharacters).required(),
  staffID: Joi.string().custom(rejectSpecialCharacters).required(),
  lga: Joi.string().required(),
  phone: Joi.string().pattern(/^\d{10,15}$/).required(),
});

export const changePasswordSchema = Joi.object().keys({
  oldPassword: Joi.string().min(6).required(),
  newPassword: Joi.string().min(6).required(),
  confirmNewPassword: Joi.string().valid(Joi.ref("newPassword")).required().messages({
    "any.only": "Confirm password does not match password",
  }),
});

export const rejectionReasonSchema = Joi.object().keys({
  rejectionReason: Joi.string().min(10).custom(escapeHtml).optional(),
});
