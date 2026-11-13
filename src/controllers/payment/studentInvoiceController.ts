import type { Response } from "express";

import {
  getStudentInvoices,
  getStudentInvoiceById,
  getStudentInvoiceSummary,
} from "../../services/payment/studentInvoice.ts";
import { getUserId, sendError } from "../../utils/helperFunctions.ts";
import type { AuthenticatedRequest } from "../../utils/auth.type.ts";

// GET /api/student/invoices
export const getMyInvoices = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const studentId = getUserId(req);

    const result = await getStudentInvoices({
      studentId,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 10,
      status: req.query.status as string | undefined,
      academicSession: req.query.academicSession as string | undefined,
      term: req.query.term as string | undefined,
    });

    return res.status(200).json({
      success: true,
      message: "Your invoices were retrieved successfully",
      data: result.invoices,
      pagination: result.pagination,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /api/student/invoices/summary
export const getMyInvoiceSummary = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const summary = await getStudentInvoiceSummary(getUserId(req));

    return res.status(200).json({
      success: true,
      message: "Invoice summary retrieved successfully",
      data: summary,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /api/student/invoices/:id
export const getMyInvoiceDetails = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const invoice = await getStudentInvoiceById(req.params.id, getUserId(req));

    return res.status(200).json({
      success: true,
      message: "Invoice retrieved successfully",
      data: invoice,
    });
  } catch (error) {
    return sendError(res, error);
  }
};
