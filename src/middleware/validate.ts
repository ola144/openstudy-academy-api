import type { Request, Response, NextFunction } from "express";
import { ZodError, ZodType } from "zod";

type ValidationTarget = "body" | "params" | "query";

export const validate = (
  schema: ZodType,
  target: ValidationTarget = "body",
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.parse(req[target]);

      req[target] = result;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      next(error);
    }
  };
};
