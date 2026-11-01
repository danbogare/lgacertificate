import Joi, { CustomHelpers } from "joi";

export const escapeHtml = (value: unknown) => {
  if (typeof value !== "string") return value;

  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
  };

  return value.replace(/[&<>"']/g, (char) => map[char] as string);
};

// Names and other plain-text fields may not contain HTML-sensitive characters
export const rejectSpecialCharacters = (value: unknown, helpers: CustomHelpers) => {
  if (typeof value !== "string") return value;
  if (/[&<>"']/.test(value)) return helpers.error("any.invalid");
  return value;
};

export const emailSchema = Joi.object().keys({
  email: Joi.string().email().required(),
});

// Same as emailSchema but tolerates extra fields older clients still send
export const resendOtpSchema = emailSchema.unknown(true);
