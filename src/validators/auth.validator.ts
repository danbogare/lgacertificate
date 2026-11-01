import Joi from "joi";
import { escapeHtml, rejectSpecialCharacters } from "./common.validator";

export const signupSchema = Joi.object().keys({
  firstName: Joi.string().custom(rejectSpecialCharacters).required(),
  lastName: Joi.string().custom(rejectSpecialCharacters).required(),
  middleName: Joi.string().custom(rejectSpecialCharacters).required(),
  email: Joi.string().custom(escapeHtml).email().required(),
  phone: Joi.string().length(11).pattern(/^\d{10,15}$/).required(),
  password: Joi.string().min(6).required(),
  confirmPassword: Joi.string().valid(Joi.ref("password")).required().messages({
    "any.only": "Confirm password does not match password",
  }),
});

export const loginSchema = Joi.object().keys({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export const verifyEmailSchema = Joi.object().keys({
  email: Joi.string().email().required(),
  otp: Joi.string().length(6).required(),
});

export const resetPasswordSchema = Joi.object().keys({
  email: Joi.string().email().required(),
  otp: Joi.string().length(6).required(),
  password: Joi.string().min(6).required(),
  confirmPassword: Joi.string().valid(Joi.ref("password")).required().messages({
    "any.only": "Password and Confirm Password do not match",
  }),
});
