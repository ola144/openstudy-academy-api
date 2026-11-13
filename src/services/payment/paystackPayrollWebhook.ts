import dotenv from "dotenv";
dotenv.config();

import TeacherPayroll from "../../models/TeacherPayroll.ts";
import { refreshPayrollBatchStatus } from "./payrollBatch/payrollBatch.service.ts";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

function getSecretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  return key;
}

export const verifyTransfer = async (reference: string) => {
  const response = await fetch(
    `${PAYSTACK_BASE_URL}/transfer/verify/${encodeURIComponent(reference)}`,
    {
      headers: {
        Authorization: `Bearer ${getSecretKey()}`,
      },
    },
  );

  const result = (await response.json()) as {
    status: boolean;
    message?: string;
    data: {
      reference: string;
      status: string;
      amount: number;
      currency: string;
      transfer_code?: string;
      reason?: string;
    };
  };

  if (!response.ok || !result.status) {
    throw new Error(result.message || "Could not verify Paystack transfer.");
  }

  return result.data;
};

export const processPayrollTransferEvent = async (input: {
  event: string;
  reference: string;
}) => {
  const { event, reference } = input;

  if (!reference) throw new Error("Missing transfer reference.");

  const payroll = await TeacherPayroll.findOne({
    transferReference: reference,
  });

  // Unknown or unrelated references must not change payroll records.
  if (!payroll) return { processed: false, reason: "Payroll not found." };

  // Confirm the final state against Paystack rather than trusting
  // a webhook's event name alone.
  const transfer = await verifyTransfer(reference);

  if (
    transfer.reference !== reference ||
    transfer.amount !== payroll.netAmount ||
    transfer.currency !== "NGN"
  ) {
    throw new Error("Transfer details do not match the payroll.");
  }

  if (event === "transfer.success") {
    if (transfer.status !== "success") {
      throw new Error("Paystack has not confirmed a successful transfer.");
    }

    // Idempotent: repeated success webhooks won't reapply payment.
    await TeacherPayroll.updateOne(
      {
        _id: payroll._id,
        transferReference: reference,
        status: "TRANSFER_PENDING",
        transferStatus: { $in: ["PENDING", "OTP_REQUIRED"] },
      },
      {
        $set: {
          status: "PAID",
          transferStatus: "SUCCESS",
          paidAt: new Date(),
          transferCompletedAt: new Date(),
          paymentReference: reference,
          paymentMethod: "PAYSTACK",
          transferFailureReason: undefined,
        },
      },
    );

    if (payroll.payrollBatchId) {
      await TeacherPayroll.updateOne(
        {
          _id: payroll._id,
          payrollBatchId: payroll.payrollBatchId,
          transferReference: reference,
          status: "TRANSFER_PENDING",
          transferStatus: { $in: ["PENDING"] },
        },
        {
          $set: {
            status: "PAID",
            transferStatus: "SUCCESS",
            paidAt: new Date(),
            transferCompletedAt: new Date(),
            paymentReference: reference,
            paymentMethod: "PAYSTACK",
            transferFailureReason: undefined,
          },
        },
      );

      await refreshPayrollBatchStatus(payroll.payrollBatchId.toString());
    }

    return { processed: true, status: "SUCCESS" };
  }

  if (event === "transfer.failed") {
    if (transfer.status !== "failed") {
      throw new Error("Paystack has not confirmed a failed transfer.");
    }

    await TeacherPayroll.updateOne(
      {
        _id: payroll._id,
        transferReference: reference,
        status: "TRANSFER_PENDING",
      },
      {
        $set: {
          status: "APPROVED",
          transferStatus: "FAILED",
          transferFailureReason:
            transfer.reason || "Paystack reported a failed transfer.",
        },
      },
    );

    return { processed: true, status: "FAILED" };
  }

  if (event === "transfer.reversed") {
    if (transfer.status !== "reversed") {
      throw new Error("Paystack has not confirmed a reversed transfer.");
    }

    await TeacherPayroll.updateOne(
      {
        _id: payroll._id,
        transferReference: reference,
        status: { $in: ["PAID", "TRANSFER_PENDING"] },
      },
      {
        $set: {
          status: "REVERSED",
          transferStatus: "REVERSED",
          transferReversedAt: new Date(),
          transferFailureReason:
            transfer.reason || "Paystack reversed the transfer.",
        },
      },
    );

    return { processed: true, status: "REVERSED" };
  }

  return { processed: false, reason: "Unsupported event." };
};
