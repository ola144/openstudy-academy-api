import type { NextFunction, Request, Response } from "express";

import {
  createStudentInvoice,
  generateClassInvoices,
  getAdminInvoices,
  getAdminInvoiceById,
  updateDraftInvoice,
  cancelAdminInvoice,
  issueDraftInvoice,
  issueClassDraftInvoices,
  unIssueUnpaidInvoice,
} from "../../services/payment/adminInvoice.ts";
import type { AuthenticatedRequest } from "../../utils/auth.type.ts";
import { getUserId, sendError } from "../../utils/helperFunctions.ts";
import { initiateStudentInvoiceRefund } from "../../services/payment/paystackRefund.ts";

export const createInvoice = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const adminId = getUserId(req);

    const invoice = await createStudentInvoice(req.body, adminId);

    return res.status(201).json({
      success: true,
      message: "Student invoice created successfully",
      data: invoice,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const createInvoiceDraft = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const invoice = await createStudentInvoice(
      { ...req.body, status: "DRAFT" },
      getUserId(req),
    );

    return res.status(201).json({
      success: true,
      message: "Draft invoice created successfully",
      data: invoice,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const generateInvoicesForClass = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const adminId = getUserId(req);

    const result = await generateClassInvoices(req.body, adminId);

    return res.status(201).json({
      success: true,
      message: `${result.created} class invoice generation completed`,
      data: result,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getInvoices = async (req: Request, res: Response) => {
  try {
    const result = await getAdminInvoices({
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 10,
      status: req.query.status as string | undefined,
      studentId: req.query.studentId as string | undefined,
      classId: req.query.classId as string | undefined,
      academicSession: req.query.academicSession as string | undefined,
      term: req.query.term as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
    });

    return res.status(200).json({
      success: true,
      message: "Invoices retrieved successfully",
      data: result.invoices,
      pagination: result.pagination,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getInvoiceDetails = async (req: Request, res: Response) => {
  try {
    const invoice = await getAdminInvoiceById(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Invoice retrieved successfully",
      data: invoice,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const updateInvoiceDraft = async (req: Request, res: Response) => {
  try {
    const invoice = await updateDraftInvoice(req.params.id, req.body);

    return res.status(200).json({
      success: true,
      message: "Draft invoice updated successfully",
      data: invoice,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const cancelInvoice = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const adminId = getUserId(req);
    const { reason } = req.body;

    if (typeof reason !== "string") {
      return res.status(400).json({
        success: false,
        message: "A cancellation reason is required",
      });
    }

    const invoice = await cancelAdminInvoice(req.params.id, adminId, reason);

    return res.status(200).json({
      success: true,
      message: "Invoice cancelled successfully",
      data: invoice,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /api/admin/invoices/:id/issued
export const issueInvoice = async (req: Request, res: Response) => {
  try {
    const invoice = await issueDraftInvoice(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Invoice issued successfully",
      data: invoice,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /api/admin/invoices/:id/unissued
export const unissuedInvoice = async (req: Request, res: Response) => {
  try {
    const invoice = await unIssueUnpaidInvoice(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Invoice unissued successfully",
      data: invoice,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /api/admin/invoices/issue-class
export const issueInvoicesForClass = async (req: Request, res: Response) => {
  try {
    const { classId, academicSession, term } = req.body;

    if (
      typeof classId !== "string" ||
      typeof academicSession !== "string" ||
      typeof term !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "classId, academicSession, and term are required",
      });
    }

    const result = await issueClassDraftInvoices({
      classId,
      academicSession,
      term,
    });

    return res.status(200).json({
      success: true,
      message: "Class invoice issuing completed",
      data: result,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /api/admin/invoices/:invoiceId/refund
export const refundStudentInvoice = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { invoiceId } = req.params;
    const { amount, reason } = req.body;

    if (!invoiceId) {
      return res.status(400).json({
        success: false,
        message: "Invoice ID is required",
      });
    }

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid refund amount in kobo is required",
      });
    }

    if (typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Refund reason is required",
      });
    }

    const result = await initiateStudentInvoiceRefund({
      invoiceId,
      amount,
      reason: reason.trim(),
      adminId: req?.user?.id ?? "",
    });

    return res.status(202).json({
      success: true,
      message: "Refund request submitted successfully!",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
