import type { Request, Response } from "express";
import {
  getPaystackBanks,
  verifyTeacherSubmittedBankAccount,
  initiateTeacherPayrollTransfer,
  getPendingTeacherBankAccounts,
  rejectTeacherBankAccount,
} from "../../services/payment/paystackTransfer.ts";
import type { AuthenticatedRequest } from "../../utils/auth.type.ts";
import { sendError } from "../../utils/helperFunctions.ts";

export const listPayrollBanks = async (_req: Request, res: Response) => {
  try {
    const banks = await getPaystackBanks();

    return res.status(200).json({
      success: true,
      data: banks
        .filter((bank) => bank.active && bank.currency === "NGN")
        .map(({ name, code }) => ({ name, code })),
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getPendingBankAccounts = async (_req: Request, res: Response) => {
  try {
    const data = await getPendingTeacherBankAccounts();

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const verifyTeacherBank = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const adminId = req.user?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const data = await verifyTeacherSubmittedBankAccount({
      teacherId: req.params.teacherId,
      adminId,
    });

    if (!data.verified) {
      return res.status(422).json({
        success: false,
        message: data.message,
        data: {
          submittedAccountName: data.submittedAccountName,
          resolvedAccountName: data.resolvedAccountName,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Bank account verified and recipient saved.",
      data: data.data,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const rejectTeacherBank = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const adminId = req.user?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const data = await rejectTeacherBankAccount({
      teacherId: req.params.teacherId,
      adminId,
      reason: req.body.reason,
    });

    return res.status(200).json({
      success: true,
      message: "Teacher bank account rejected.",
      data,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const initiatePayrollTransfer = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const adminId = req.user?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const data = await initiateTeacherPayrollTransfer({
      payrollId: req.params.id,
      adminId,
    });

    return res.status(202).json({
      success: true,
      message: data.message,
      data,
    });
  } catch (error) {
    return sendError(res, error);
  }
};
