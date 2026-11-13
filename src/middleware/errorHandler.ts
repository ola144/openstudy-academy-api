import type { Request, Response, NextFunction } from "express";

interface AppError extends Error {
  statusCode?: number;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode ?? 500;

  return res.status(statusCode).json({
    success: statusCode >= 500 ? "error" : "failed",
    message: err.message,
  });
};
