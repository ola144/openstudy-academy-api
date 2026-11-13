import type { NextFunction, Request, Response } from "express";
import {
  approvePayrollBatch,
  createPayrollBatch,
  getAllPayrollBatch,
  getBatchPayrollById,
  initiateBulkPayrollTransfer,
  reconcileBulkPayrollTransfer,
} from "../../../services/payment/payrollBatch/payrollBatch.service.ts";
import type { AuthenticatedRequest } from "../../../utils/auth.type.ts";

//POST /admin/payroll/batches
export const generatePayrollBatchController = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const batch = await createPayrollBatch({
      period: req.body.period,
      adminId: req.user?.id,
    });

    return res.status(201).json({
      success: true,
      message: "Payroll batch generated successfully!",
      data: batch,
    });
  } catch (error) {
    return next(error);
  }
};

//PATCH /admin/payroll/batches/:batchId/approve
export const approvedPayrollBatchController = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const batch = await approvePayrollBatch({
      batchId: req.params.batchId,
      adminId: req.user?.id,
    });

    res.status(200).json({
      success: true,
      message: "Payroll batch approved successfully!",
      data: batch,
    });
  } catch (error) {
    return next(error);
  }
};

//POST /admin/payroll/batches/:batchId/transfer
export const initiateBulkPayrollTranferController = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const batchId = req.params.batchId;
    const result = await initiateBulkPayrollTransfer(batchId);

    res.status(200).json({
      success: true,
      message: "Bulk transfer initiated successfully!",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

//GET /admin/payroll/batches
export const getBatchPayrolls = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await getAllPayrollBatch({
      page: Number(req.query.page ?? 1),
      limit: Number(req.query.limit ?? 10),
      period:
        typeof req.query.period === "string" ? req.query.period : undefined,
      status:
        typeof req.query.status === "string" ? req.query.status : undefined,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

//GET /admin/payroll/batches/:batchId
export const getBatchPayrollDetails = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const batchId = req.params.batchId;
    const result = await getBatchPayrollById(batchId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

//PATCH /admin/payroll/batches/:batchId/approve
export const reconcilePayrollBulkTransferController = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const batch = await reconcileBulkPayrollTransfer(req.params.batchId);

    res.status(200).json({
      success: true,
      message: batch.message,
      data: {
        ...batch,
      },
    });
  } catch (error) {
    return next(error);
  }
};
