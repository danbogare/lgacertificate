import Joi from "joi";
import { Request, Response, NextFunction, RequestHandler } from "express";

// Rejects invalid bodies with 422 and every Joi message joined by commas.
// req.body is left as sent; schemas only check it.
export const validate = (schema: Joi.ObjectSchema): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body);

    if (!error) {
      next();
      return;
    }

    const message = error.details.map((detail) => detail.message).join(",").replace(/"/g, "");
    res.status(422).json({ status: "error", message });
  };
};
