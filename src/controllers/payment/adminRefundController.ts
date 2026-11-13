import type { Response, Request, NextFunction } from "express";
import {
  getAdminRefundInvoiceById,
  getAdminRefundInvoiceHistory,
} from "../../services/payment/adminInvoice.ts";
import { reconcileRefund } from "../../services/payment/refundReconciliation.ts";

const getQueryString = (value: unknown): string | undefined => {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
};

// GET /api/v1/admin/refunds
export const getAdminRefunds = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters",
      });
    }

    const result = await getAdminRefundInvoiceHistory({
      page,
      limit,
      status: getQueryString(req.query.status),
      studentId: getQueryString(req.query.studentId),
      invoiceId: getQueryString(req.query.invoiceId),
      search: getQueryString(req.query.search),
    });

    return res.status(200).json({
      success: true,
      message: "Refund history retrieved successfully",
      data: result.refunds,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/refunds/:id
export const getAdminRefundDetails = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const refund = await getAdminRefundInvoiceById(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Refund details retrieved successfully",
      data: refund,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/admin/refunds/:id/reconcile
export const reconcileAdminRefund = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await reconcileRefund(req.params.id);

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
