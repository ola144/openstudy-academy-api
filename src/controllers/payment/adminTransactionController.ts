import type { Request, Response } from "express";

import {
  getAdminTransactions,
  getAdminTransactionSummary,
  getAdminTransactionById,
  markTransactionReviewed,
} from "../../services/payment/adminTransactionService.ts";
import type { AuthenticatedRequest } from "../../utils/auth.type.ts";

const getErrorStatus = (error: unknown): number => {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode;
  }

  return 500;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred";
};

export const getTransactions = async (req: Request, res: Response) => {
  try {
    const result = await getAdminTransactions({
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      status: req.query.status as string | undefined,
      provider: req.query.provider as string | undefined,
      reference: req.query.reference as string | undefined,
      studentId: req.query.studentId as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
    });

    return res.status(200).json({
      success: true,
      message: "Transactions retrieved successfully",
      data: result.transactions,
      pagination: result.pagination,
    });
  } catch (error) {
    return res.status(getErrorStatus(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const getTransactionSummary = async (req: Request, res: Response) => {
  try {
    const summary = await getAdminTransactionSummary(
      req.query.from as string | undefined,
      req.query.to as string | undefined,
    );

    return res.status(200).json({
      success: true,
      message: "Transaction summary retrieved successfully",
      data: summary,
    });
  } catch (error) {
    return res.status(getErrorStatus(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const getTransactionDetails = async (req: Request, res: Response) => {
  try {
    const transaction = await getAdminTransactionById(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Transaction retrieved successfully",
      data: transaction,
    });
  } catch (error) {
    return res.status(getErrorStatus(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};

export const reviewTransaction = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const adminId = req.user?.id;
    const { reviewNote } = req.body;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (
      typeof reviewNote !== "string" ||
      !reviewNote.trim() ||
      reviewNote.trim().length > 1000
    ) {
      return res.status(400).json({
        success: false,
        message: "Review note is required and must not exceed 1000 characters",
      });
    }

    const transaction = await markTransactionReviewed(
      req.params.id,
      adminId,
      reviewNote,
    );

    return res.status(200).json({
      success: true,
      message: "Transaction review recorded successfully",
      data: transaction,
    });
  } catch (error) {
    return res.status(getErrorStatus(error)).json({
      success: false,
      message: getErrorMessage(error),
    });
  }
};
