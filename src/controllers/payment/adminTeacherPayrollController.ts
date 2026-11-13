import type { NextFunction, Request, Response } from "express";
import TeacherPayroll from "../../models/TeacherPayroll.ts";
import {
  createTeacherPayroll,
  getAdminTeacherPayrolls,
  getAdminTeacherPayrollById,
  approveTeacherPayroll,
  cancelTeacherPayroll,
  reconcilePayrollTranser,
} from "../../services/payment/adminTeacherPayroll.ts";
import { getUserId, sendError } from "../../utils/helperFunctions.ts";
import type { AuthenticatedRequest } from "../../utils/auth.type.ts";
import {
  finalizeTeacherPayrollTransfer,
  resendPaystackTransferOTP,
} from "../../services/payment/paystackTransfer.ts";

export const createPayroll = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const adminId = getUserId(req);

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const payroll = await createTeacherPayroll(req.body, adminId);

    return res.status(201).json({
      success: true,
      message: "Teacher payroll created as draft.",
      data: payroll,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getPayrolls = async (req: Request, res: Response) => {
  try {
    const result = await getAdminTeacherPayrolls({
      page: Number(req.query.page ?? 1),
      limit: Number(req.query.limit ?? 10),
      period:
        typeof req.query.period === "string" ? req.query.period : undefined,
      status:
        typeof req.query.status === "string"
          ? req.query.status.toUpperCase()
          : undefined,
      teacherId:
        typeof req.query.teacherId === "string"
          ? req.query.teacherId
          : undefined,
    });

    return res.status(200).json({
      success: true,
      message: "Teacher payroll records retrieved.",
      data: result,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getPayrollDetails = async (req: Request, res: Response) => {
  try {
    const payroll = await getAdminTeacherPayrollById(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Payroll details retrieved.",
      data: payroll,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const approvePayroll = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const adminId = getUserId(req);

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const payroll = await approveTeacherPayroll(req.params.id, adminId);

    return res.status(200).json({
      success: true,
      message: "Payroll approved.",
      data: payroll,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const cancelPayroll = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const adminId = getUserId(req);

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const payroll = await cancelTeacherPayroll(
      req.params.id,
      adminId,
      req.body.reason,
    );

    return res.status(200).json({
      success: true,
      message: "Payroll cancelled.",
      data: payroll,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const finalizePayrollTransfer = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const { id } = req.params;
    const { otp } = req.body;

    const result = await finalizeTeacherPayrollTransfer({
      payrollId: id,
      adminId: req.user?.id,
      otp,
    });

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

const RESEND_COOLDOWN_SECONDS = 60;

export const resendTeacherPayrollOTP = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    const payroll = await TeacherPayroll.findById(id).select("+transferCode");

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll record not found.",
      });
    }

    if (
      payroll.status !== "TRANSFER_PENDING" ||
      payroll.transferStatus !== "OTP_REQUIRED"
    ) {
      return res.status(409).json({
        success: false,
        message: "This payroll transfer is not awaiting OTP authorization.",
      });
    }

    if (!payroll.transferCode) {
      return res.status(400).json({
        success: false,
        message: "Transfer code is missing.",
      });
    }

    const now = new Date();

    // Check the resend cooldown.
    if (
      payroll.transferOtpResendAvailableAt &&
      payroll.transferOtpResendAvailableAt > now
    ) {
      const remainingSeconds = Math.ceil(
        (payroll.transferOtpResendAvailableAt.getTime() - now.getTime()) / 1000,
      );

      return res.status(429).json({
        success: false,
        message: "Please wait before requesting another OTP.",
        remainingSeconds,
        resendAvailableAt: payroll.transferOtpResendAvailableAt,
      });
    }

    // Reserve the resend cooldown atomically.
    const nextResendAvailableAt = new Date(
      now.getTime() + RESEND_COOLDOWN_SECONDS * 1000,
    );

    const reserved = await TeacherPayroll.findOneAndUpdate(
      {
        _id: payroll._id,
        status: "TRANSFER_PENDING",
        transferStatus: "OTP_REQUIRED",
        transferCode: payroll.transferCode,
        $or: [
          { transferOtpResendAvailableAt: null },
          { transferOtpResendAvailableAt: { $exists: false } },
          { transferOtpResendAvailableAt: { $lte: now } },
        ],
      },
      {
        $set: {
          transferOtpResendAvailableAt: nextResendAvailableAt,
        },
      },
      { new: true },
    );

    if (!reserved) {
      return res.status(429).json({
        success: false,
        message:
          "An OTP resend request is already being processed or the cooldown is active.",
      });
    }

    try {
      const response = await resendPaystackTransferOTP(payroll.transferCode);

      if (!response.status) {
        throw new Error(response.message || "Paystack could not resend OTP.");
      }

      return res.status(200).json({
        success: true,
        message: "Paystack transfer OTP has been resent successfully.",
        resendAvailableAt: nextResendAvailableAt,
      });
    } catch (error) {
      // Release cooldown if Paystack explicitly rejects the request.
      // For network timeouts, do not blindly retry: the request may
      // have succeeded at Paystack even if your server did not receive
      // its response.
      await TeacherPayroll.updateOne(
        {
          _id: payroll._id,
          transferOtpResendAvailableAt: nextResendAvailableAt,
        },
        {
          $unset: {
            transferOtpResendAvailableAt: 1,
          },
        },
      );

      throw error;
    }
  } catch (error) {
    next(error);
  }
};

export const reconcilePayrollPendingTranster = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    const payroll = await reconcilePayrollTranser(id);

    return res.status(200).json({
      success: true,
      message: "Payroll transfer reconciliation completed.",
      data: payroll,
    });
  } catch (error) {
    return next(error);
  }
};
