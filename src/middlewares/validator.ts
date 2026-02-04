import Joi, {CustomHelpers} from 'joi';
import { Request, Response, NextFunction } from 'express';

const validate = (schema: Joi.ObjectSchema<object>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    const valid = error == null;

    if (valid) {
      next();
    } else {
      const { details } = error;
      const message = details.map((i) => i.message).join(',');

      const newMessage = message.replace(/"/g, '');
      res.status(422).json({
        status: 'error',
        message: newMessage,
      });
    }
  };
};

const escapeHtml = (value: any) => {
  if (typeof value !== 'string') return value;
  
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;'
  };
  
  // Regex to find any of these 5 characters and replace them using the map
  return value.replace(/[&<>"']/g, (m) => map[m]);
};

const rejectSpecialCharacters = (value: any, helpers: CustomHelpers) => {
  if (typeof value !== 'string') return value;

  // Regex to detect: < > & " '
  const forbiddenChars = /[&<>"']/;

  if (forbiddenChars.test(value)) {
    // This triggers a Joi error and stops the process
    return helpers.error('any.invalid'); 
  }

  return value; // Input is clean, let it pass
};

const schemas = {
  createUserSchema: Joi.object().keys({
    firstName: Joi.string().custom(rejectSpecialCharacters).required(),
    lastName: Joi.string().custom(rejectSpecialCharacters).required(),
    middleName: Joi.string().custom(rejectSpecialCharacters).required(),
    email: Joi.string().custom(escapeHtml).email().required(),
    phone: Joi.string().length(11).pattern(/^\d{10,15}$/).required(),
    password: Joi.string().min(6).required(),
    confirmPassword: Joi.string()
        .valid(Joi.ref('password'))
        .required()
        .messages({
        'any.only': 'Confirm password does not match password',
        }),
  }),
  
  superSignupSchema: Joi.object().keys({
    firstName: Joi.string().custom(rejectSpecialCharacters).required(),
    lastName: Joi.string().custom(rejectSpecialCharacters).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    confirmPassword: Joi.string()
        .valid(Joi.ref('password'))
        .required()
        .messages({
        'any.only': 'Confirm password does not match password',
        }),
  }),
  
  createApplicationSchema: Joi.object().keys({
    fullNames: Joi.string().custom(rejectSpecialCharacters).optional(),
    fatherNames: Joi.string().custom(rejectSpecialCharacters).optional(),
    motherNames: Joi.string().custom(rejectSpecialCharacters).optional(),
    nativeTown: Joi.string().custom(rejectSpecialCharacters).optional(),
    nativePoliticalWard: Joi.string().custom(rejectSpecialCharacters).optional(),
    communityHead: Joi.string().custom(rejectSpecialCharacters).optional(),
    communityHeadContact: Joi.string().custom(rejectSpecialCharacters).optional(),
    village: Joi.string().custom(rejectSpecialCharacters).optional(),
    nin: Joi.string().length(11).pattern(/^\d{10,15}$/).optional(), // Allow 10-15 digit phone numbers
    currentAddress: Joi.string().custom(escapeHtml).required(),
    lga: Joi.string().required(),
    stateOfOrigin: Joi.string().required(),
    isResidentOfOgun: Joi.boolean().optional(),
    lgaOfResident: Joi.string().optional(),
  }),
  
  loginUserSchema: Joi.object().keys({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),
  
  forgotPasswordSchema: Joi.object().keys({
    email: Joi.string().email().required(),
  }),
  
  verifyUserEmailSchema: Joi.object().keys({
    email: Joi.string().email().required(),
    otp: Joi.string().length(6).required(),
  }),

  resetPasswordSchema: Joi.object().keys({
    email: Joi.string().email().required(),
    otp: Joi.string().length(6).required(),
    password: Joi.string().min(6).required(),
    confirmPassword: Joi.string()
      .valid(Joi.ref('password'))
      .required()
      .messages({
        'any.only': 'Password and Confirm Password do not match',
      }),
  }),

  createAdminSchema: Joi.object().keys({
    firstName: Joi.string().custom(rejectSpecialCharacters).required(),
    lastName: Joi.string().custom(rejectSpecialCharacters).required(),
    email: Joi.string().email().required(),
    position: Joi.string().custom(rejectSpecialCharacters).required(),
    staffID: Joi.string().custom(rejectSpecialCharacters).required(),
    lga: Joi.string().required(),
    phone: Joi.string().pattern(/^\d{10,15}$/).required(), // Allow 10-15 digit phone numbers
  }),
  
  rejectionReasonSchema: Joi.object().keys({
    rejectionReason: Joi.string().min(10).custom(escapeHtml).optional(),
  }),
  
  createSignatorySchema: Joi.object().keys({
    lga: Joi.string().required(),
    chairmanName: Joi.string().custom(rejectSpecialCharacters).required(),
    secretaryName: Joi.string().custom(rejectSpecialCharacters).required(),  
  }),

  changePasswordSchema: Joi.object().keys({
    oldPassword: Joi.string().min(6).required(),
    newPassword: Joi.string().min(6).required(),
    confirmNewPassword: Joi.string()
        .valid(Joi.ref('newPassword'))
        .required()
        .messages({
        'any.only': 'Confirm password does not match password',
        }),
  }),

};

export { validate, schemas };
