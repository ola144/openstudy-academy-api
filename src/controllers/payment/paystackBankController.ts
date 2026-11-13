import type { Request, Response } from "express";
import { getAllPaystackBanks } from "../../services/payment/paystackBank.ts";

export const getAllBanks = async (_req: Request, res: Response) => {
  try {
    const banks = await getAllPaystackBanks();

    return res.status(200).json({
      success: true,
      message: "Banks retrieved successfully.",
      total: banks.length,
      data: banks,
    });
  } catch (error) {
    const err = error as Error & { statusCode?: number };

    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to retrieve banks.",
    });
  }
};
