import type { Request, Response } from "express";

import {
  getMyTeacherPayrollHistory,
  getMyTeacherPayrollDetails,
} from "../../services/payment/teacherPayroll.ts";
import type { AuthenticatedRequest } from "../../utils/auth.type.ts";
import { sendError } from "../../utils/helperFunctions.ts";

export const getMyPayrollHistory = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const teacherId = req.user?.id;

    if (!teacherId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);

    const result = await getMyTeacherPayrollHistory(teacherId, page, limit);

    return res.status(200).json({
      success: true,
      message: "Your payroll history was retrieved.",
      data: result,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getMyPayrollDetails = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const teacherId = req.user?.id;

    if (!teacherId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const payroll = await getMyTeacherPayrollDetails(teacherId, req.params.id);

    return res.status(200).json({
      success: true,
      message: "Payroll details retrieved.",
      data: payroll,
    });
  } catch (error) {
    return sendError(res, error);
  }
};
