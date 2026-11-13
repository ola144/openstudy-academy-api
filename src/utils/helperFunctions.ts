import mongoose from "mongoose";
import type { Response } from "express";
import type { AuthenticatedRequest } from "./auth.type.ts";

export const fail = (message: string, statusCode = 400): never => {
  throw Object.assign(new Error(message), { statusCode });
};

export const parseDate = (value: string, field: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    fail(`Invalid ${field}`);
  }

  return date;
};

export const isValidObjectId = (value: string | any) =>
  mongoose.Types.ObjectId.isValid(value);

export const getUserId = (req: AuthenticatedRequest) => {
  if (!req.user?.id) {
    throw Object.assign(new Error("Authentication required"), {
      statusCode: 401,
    });
  }

  return req.user.id;
};

export const sendError = (res: Response, error: unknown) => {
  const err = error as Error & { statusCode?: number };

  return res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "An unexpected error occurred.",
  });
};

export const formatNaira = (amount: number, currency = "NGN") => {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatReceiptDate = (value?: Date | string | null) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(date);
};

export const getSecretKey = (key: any) => {
  if (!key) {
    throw Object.assign(new Error("PAYSTACK_SECRET_KEY is not configured."), {
      statusCode: 500,
    });
  }

  return key;
};

export const paystackRequest = async <T>(
  path: string,
  paystackBaseUrl: string,
  key: any,
  options: RequestInit = {},
): Promise<T> => {
  const url = `${paystackBaseUrl}${path}`;

  // console.log("[PAYSTACK] Request URL:", url);
  // console.log("[PAYSTACK] Method:", options.method || "GET");

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${getSecretKey(key)}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
    signal: AbortSignal.timeout(15000),
  });

  const result = await response.json().catch(() => null);

  // console.log("[PAYSTACK] HTTP status:", response.status);
  // console.log("[PAYSTACK] Response:", result);

  if (!response.ok || !result?.status) {
    throw Object.assign(
      new Error(result?.message || "Paystack request failed."),
      {
        statusCode: 502,
        paystackCode: result?.code,
        paystackData: result?.data,
      },
    );
  }

  return result.data as T;
};
