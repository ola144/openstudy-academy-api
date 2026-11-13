import type { Response } from "express";

import {
  submitTeacherBankAccount,
  getMyBankAccount,
} from "../../services/payment/teacherBankAccount.ts";
import type { AuthenticatedRequest } from "../../utils/auth.type.ts";
import { sendError } from "../../utils/helperFunctions.ts";

export const submitMyBankAccount = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const teacherId = req.user?.id;

    const bankAccount = await submitTeacherBankAccount(teacherId, {
      bankCode: req.body.bankCode,
      bankName: req.body.bankName,
      accountNumber: req.body.accountNumber,
      accountName: req.body.accountName,
    });

    return res.status(200).json({
      success: true,
      message: "Bank details submitted. Awaiting admin verification.",
      data: bankAccount,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getTeacherBankAccount = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const teacherId = req.user?.id;

    const bankAccount = await getMyBankAccount(teacherId);

    return res.status(200).json({
      success: true,
      message: bankAccount
        ? "Bank account retrieved successfully."
        : "You have not submitted bank details.",
      data: bankAccount
        ? { ...bankAccount.toObject(), hasAccount: true }
        : { hasAccount: false },
    });
  } catch (error) {
    return sendError(res, error);
  }
};
