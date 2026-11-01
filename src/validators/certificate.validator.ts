import Joi from "joi";
import { escapeHtml } from "./common.validator";

export const revocationReasonSchema = Joi.object().keys({
  revocationReason: Joi.string().min(10).custom(escapeHtml).optional(),
});
