import type { Response } from "express";

import {
  initializeInvoicePayment,
  verifyAndApplyPayment,
} from "../../services/payment/paystackPayment.ts";
import type { AuthenticatedRequest } from "../../utils/auth.type.ts";
import { sendError } from "../../utils/helperFunctions.ts";

export const initializePayment = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const studentId = req.user?.id;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const { invoiceId, amountKobo } = req.body;

    if (
      typeof invoiceId !== "string" ||
      (amountKobo !== undefined &&
        (!Number.isSafeInteger(amountKobo) || amountKobo <= 0))
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide a valid invoiceId and optional amountKobo.",
      });
    }

    const result = await initializeInvoicePayment({
      studentId,
      invoiceId,
      amountKobo,
    });

    return res.status(200).json({
      success: true,
      message: "Payment initialized successfully.",
      data: result,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const verifyPayment = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const studentId = req.user?.id;
    const { reference } = req.body;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (typeof reference !== "string" || !reference.trim()) {
      return res.status(400).json({
        success: false,
        message: "Payment reference is required.",
      });
    }

    const result = await verifyAndApplyPayment(reference.trim(), studentId);

    return res.status(200).json({
      success: true,
      message:
        result.status === "SUCCESS"
          ? "Payment confirmed."
          : "Payment has not been confirmed as successful.",
      data: result,
    });
  } catch (error) {
    return sendError(res, error);
  }
};
