import type { Request, Response } from "express";
import { getAdminPayrollSummary } from "../../services/payment/adminPayrollSummary.ts";

export const getPayrollSummary = async (req: Request, res: Response) => {
  try {
    const period =
      typeof req.query.period === "string"
        ? req.query.period
        : new Date().toISOString().slice(0, 7);

    const data = await getAdminPayrollSummary(period);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    const err = error as Error & { statusCode?: number };

    return res.status(err.statusCode ?? 500).json({
      success: false,
      message: err.message || "Could not load payroll summary.",
    });
  }
};
