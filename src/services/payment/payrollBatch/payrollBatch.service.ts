import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

import TeacherPayroll from "../../../models/TeacherPayroll.ts";
import PayrollBatch from "../../../models/PayrollBatch.ts";
import { PayrollBatchStatus } from "../../../models/PayrollBatch.ts";
import {
  fail,
  isValidObjectId,
  paystackRequest,
} from "../../../utils/helperFunctions.ts";
import {
  approveTeacherPayroll,
  validatePeriod,
} from "../adminTeacherPayroll.ts";
import { processPayrollTransferEvent } from "../paystackPayrollWebhook.ts";

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const key = process.env.PAYSTACK_SECRET_KEY;

interface CreatePayrollBatchParams {
  period: string;
  adminId: string | undefined;
}

export const createPayrollBatch = async ({
  period,
  adminId,
}: CreatePayrollBatchParams) => {
  if (!period.trim()) {
    fail("Payroll period is required!");
  }

  const session = await mongoose.startSession();

  try {
    let createdBatch: any;

    await session.withTransaction(async () => {
      // Get all eligible draft payrolls for this period
      const payrolls = await TeacherPayroll.find({
        period,
        status: "DRAFT",
        transferStatus: "NOT_STARTED",
        payrollBatchId: null,
      }).session(session);

      if (!payrolls.length) {
        fail("No eligible draft payrolls found for this period.");
      }

      // Validate individual payroll amounts.
      for (const payroll of payrolls) {
        if (
          !Number.isSafeInteger(payroll.netAmount) ||
          payroll.netAmount <= 0
        ) {
          fail(`Invalid net salary for payroll ${payroll._id}`);
        }

        if (!payroll.transferRecipientCode) {
          fail(
            `Missing paystack recipient for the teacher ${payroll.teacherId}`,
          );
        }
      }

      const totalAmount = payrolls.reduce(
        (total, payroll) => total + payroll.netAmount,
        0,
      );

      if (!Number.isSafeInteger(totalAmount)) {
        fail("Total payroll amount is invalid!");
      }

      const payrollIds = payrolls.map((payroll) => payroll._id);

      // const [batch] = await PayrollBatch.create(
      //   [
      //     {
      //       batchNumber: `PB-${randomUUID()}`,
      //       period,
      //       currency: "NGN",
      //       payrollIds,
      //       totalEmployees: payrolls.length,
      //       totalAmount,
      //       pendingCount: payrolls.length,
      //       successfulCount: 0,
      //       failedCount: 0,
      //       status: PayrollBatchStatus.PENDING_APPROVAL,
      //       createdBy: adminId,
      //     },
      //   ],
      //   { session },
      // );

      const batch = new PayrollBatch({
        batchNumber: `PB-${randomUUID()}`,
        period,
        currency: "NGN",
        payrollIds,
        totalEmployees: payrolls.length,
        totalAmount,
        pendingCount: payrolls.length,
        successfulCount: 0,
        failedCount: 0,
        status: PayrollBatchStatus.PENDING_APPROVAL,
        createdBy: adminId,
      });

      await batch.save({ session });

      // Associate individual payrolls with this batch
      const updateResult = await TeacherPayroll.updateMany(
        {
          _id: { $in: payrollIds },
          status: "DRAFT",
          transferStatus: "NOT_STARTED",
          payrollBatchId: null,
        },
        {
          $set: {
            payrollBatchId: batch._id,
          },
        },
        { session },
      );

      if (updateResult.modifiedCount !== payrollIds.length) {
        fail(
          "Some payroll records were modiefied by another operation. Please retry.",
        );
      }

      createdBatch = batch;
    });

    if (!createdBatch) {
      throw new Error("Payroll batch creation failed.");
    }

    const result = await PayrollBatch.findById(createdBatch._id);

    return result;
  } catch (error) {
    await session.endSession();
  }
};

interface ApprovePayrollBatchParams {
  batchId: string | string[];
  adminId: string | undefined;
}

export const approvePayrollBatch = async ({
  batchId,
  adminId,
}: ApprovePayrollBatchParams) => {
  const batch = await PayrollBatch.findOneAndUpdate(
    {
      _id: batchId,
      status: PayrollBatchStatus.PENDING_APPROVAL,
    },
    {
      $set: {
        status: PayrollBatchStatus.APPROVED,
        approvedBy: adminId,
        approvedAt: new Date(),
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!batch) {
    throw new Error("Payroll batch not found or it has already been approved.");
  }

  await TeacherPayroll.updateMany(
    {
      _id: { $in: batch.payrollIds },
      status: "DRAFT",
    },
    {
      $set: {
        status: "APPROVED",
      },
    },
  );

  return batch;
};

interface PaystackBulkTransferItem {
  id: number;
  integration: number;
  reference: string;
  transfer_code: string;
  status: string;
  amount: number;
  currency: string;
  recipient: number;
}

interface BulkTransferInput {
  amount: number;
  recipient: string;
  reference: string;
  reason: string;
}

const createPaystckBulkTransfer = async (transfers: BulkTransferInput[]) => {
  if (!transfers.length || transfers.length > 100) {
    fail("A paystack bulk transfer must contain between 1 and 100 transfers.");
  }

  const response = await paystackRequest<PaystackBulkTransferItem[]>(
    "/transfer/bulk",
    PAYSTACK_BASE_URL,
    key,
    {
      method: "POST",
      body: JSON.stringify({
        source: "balance",
        currency: "NGN",
        transfers,
      }),
    },
  );

  return response;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const chunkArray = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i++) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
};

export const initiateBulkPayrollTransfer = async (
  batchId: string | string[],
) => {
  const batch = await PayrollBatch.findOne({
    _id: batchId,
    status: PayrollBatchStatus.APPROVED,
  });

  const payrolls = await TeacherPayroll.find({
    _id: { $in: batch?.payrollIds },
    payrollBatchId: batch?._id,
    status: "APPROVED",
    transferStatus: "NOT_STARTED",
  });

  if (payrolls.length !== batch?.totalEmployees) {
    fail(
      "Some payroll records are mission or are no longer eligible for transfer.",
    );
  }

  // Prepare unique references and validate every payroll
  const prepared = payrolls.map((payroll) => {
    if (!Number.isSafeInteger(payroll.netAmount) || payroll.netAmount <= 0) {
      fail(`Invalid net amount for payroll ${payroll._id}.`);
    }

    if (!payroll.transferRecipientCode) {
      fail(`Mission paystack recipient for payroll ${payroll._id}`);
    }

    return {
      payroll,
      reference: `pay-${randomUUID()}`,
    };
  });

  const calculatedTotal = prepared.reduce(
    (sum, item) => sum + item.payroll.netAmount,
    0,
  );

  if (calculatedTotal !== batch?.totalAmount) {
    fail(
      "The payroll total has changed since the batch was approved. Generate new bactch for review.",
    );
  }

  // Reserve individual payrolls before contacting Paystack

  const reservation = await TeacherPayroll.bulkWrite(
    prepared.map(({ payroll, reference }) => ({
      updateOne: {
        filter: {
          _id: payroll._id,
          payrollBatchId: batch?._id,
          status: "APPROVED",
          transferStatus: "NOT_STARTED",
        },
        update: {
          $set: {
            status: "TRANSFER_PENDING",
            transferStatus: "PENDING",
            transferReference: reference,
            transferInitiatedAt: new Date(),
          },
        },
      },
    })),
  );

  if (reservation.modifiedCount !== prepared.length) {
    fail("Unable to reserve every payroll. No bulk transfer was submitted.");
  }

  if (!batch) {
    return fail("Batch not found. No bulk transfer was submitted.");
  }

  // Mark batch as processing;
  batch.status = PayrollBatchStatus.PROCESSING;
  batch.submittedAt = new Date();
  await batch.save();

  const groups = chunkArray(prepared, 100);

  const results: PaystackBulkTransferItem[] = [];

  for (let index = 0; index < groups.length; index++) {
    const group = groups[index];

    // Paystack recommends a five-seconds internal between batches
    if (index > 0) {
      await delay(5000);
    }

    const transfers = group.map(({ payroll, reference }) => ({
      amount: payroll.netAmount,
      recipient: payroll.transferRecipientCode!,
      reference,
      reason: `${batch.period} teacher salary`,
    }));

    // If this request times out, don't blindly resubmit it.
    // Reconcile the saved references with Paystack first.
    const paystackResults = await createPaystckBulkTransfer(transfers);

    for (const result of paystackResults) {
      const matchingPayroll = group.find(
        (item) => item.reference === result.reference,
      );

      if (!matchingPayroll) {
        return fail(
          `Unexpected paystack transfer reference: ${result.reference}`,
        );
      }

      if (
        result.amount !== matchingPayroll.payroll.netAmount ||
        result.currency !== "NGN"
      ) {
        return fail(
          `Paystack transfer amount or currency mismatch for ${result.reference}`,
        );
      }

      const updateResult = await TeacherPayroll.updateOne(
        {
          _id: matchingPayroll.payroll._id,
          transferReference: result.reference,
        },
        {
          $set: {
            transferCode: result.transfer_code,
            status:
              result.status === "success"
                ? "PAID"
                : result.status === "failed"
                  ? "FAILED"
                  : result.status === "reversed"
                    ? "REVERSED"
                    : "TRANSFER_PENDING",
            transferStatus:
              result.status === "success"
                ? "SUCCESS"
                : result.status === "otp"
                  ? "OTP_REQUIRED"
                  : "PENDING",
          },
        },
      );

      if (updateResult.matchedCount !== 1) {
        throw new Error(
          `Payroll not updated for transfer reference: ${result.reference}. ` +
            `Matched records: ${updateResult.matchedCount}`,
        );
      }

      if (
        result.status === "success" ||
        result.status === "failed" ||
        result.status === "reversed"
      ) {
        await processPayrollTransferEvent({
          event: `transfer.${result.status}`,
          reference: result.reference,
        });
      }

      results.push(result);
    }
  }

  return {
    batchId: batch._id,
    batchNumber: batch.batchNumber,
    totalEmployees: batch.totalEmployees,
    totalAmount: batch.totalAmount,
    submittedTransfers: results.length,
    status: batch.status,
    results,
  };
};

export const refreshPayrollBatchStatus = async (batchId: string) => {
  const batch = await PayrollBatch.findById(batchId);

  if (!batch) {
    return fail("Payroll batch not found.", 404);
  }

  const [successfulCount, failedCount, pendingCount, reversedCount] =
    await Promise.all([
      TeacherPayroll.countDocuments({
        payrollBatchId: batchId,
        transferStatus: "SUCCESS",
      }),

      TeacherPayroll.countDocuments({
        payrollBatchId: batchId,
        transferStatus: "FAILED",
      }),

      TeacherPayroll.countDocuments({
        payrollBatchId: batchId,
        transferStatus: {
          $in: ["NOT_STARTED", "PENDING", "OTP_REQUIRED"],
        },
      }),

      TeacherPayroll.countDocuments({
        payrollBatchId: batchId,
        transferStatus: "REVERSED",
      }),
    ]);

  batch.successfulCount = successfulCount;
  batch.failedCount = failedCount;
  batch.pendingCount = pendingCount;

  if (pendingCount > 0) {
    batch.status =
      successfulCount > 0 || failedCount > 0
        ? PayrollBatchStatus.PARTIALLY_COMPLETED
        : PayrollBatchStatus.PROCESSING;
  } else if (successfulCount === batch.totalEmployees) {
    batch.status = PayrollBatchStatus.COMPLETED;
    batch.completedAt = new Date();
  } else if (successfulCount > 0 || reversedCount > 0) {
    batch.status = PayrollBatchStatus.PARTIALLY_COMPLETED;
    batch.completedAt = new Date();
  } else {
    batch.status = PayrollBatchStatus.FAILED;
    batch.completedAt = new Date();
  }

  await batch.save();

  return batch;
};

type PayrollListInput = {
  page?: number;
  limit?: number;
  period?: string;
  status?: string;
  teacherId?: string;
};

export const getAllPayrollBatch = async ({
  page = 1,
  limit = 10,
  period,
  status,
}: PayrollListInput) => {
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    fail("Invalid pagination values.");
  }

  const filter: Record<string, unknown> = {};

  if (period) {
    validatePeriod(period);
    filter.period = period;
  }

  if (status) {
    if (
      ![
        "PENDING_APPROVAL",
        "APPROVED",
        "PROCESSING",
        "COMPLETED",
        "PARTIALLY_COMPLETED",
        "FAILED",
        "CANCELLED",
      ].includes(status)
    ) {
      fail("Invalid payroll batch status.");
    }

    filter.status = status;
  }

  const [batchesQuery, total] = await Promise.all([
    PayrollBatch.find(filter)
      .populate({
        path: "payrollIds",
        select:
          "period baseSalary allowances deductions status transferStatus netAmount notes paidAt payrollBatchId teacherId",
        populate: {
          path: "teacherId",
          select: "firstName lastName email",
        },
      })
      .skip((page - 1) * limit)
      .limit(limit),

    PayrollBatch.countDocuments(filter),
  ]);

  const batches = batchesQuery.map((batch) => {
    const batchObj = batch.toObject();

    const { payrollIds, ...payrollBatchResst } = batchObj;

    return {
      ...payrollBatchResst,
      payrolls: payrollIds.map((item: any) => {
        const { teacherId, ...payrollRest } = item;

        return {
          ...payrollRest,
          teacher: teacherId,
        };
      }),
    };
  });

  return {
    batches,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getBatchPayrollById = async (id: string | string[]) => {
  if (!isValidObjectId(id)) fail("Invalid payroll ID.");

  const payrollQuery = await PayrollBatch.findById(id).populate({
    path: "payrollIds",
    select:
      "period baseSalary allowances deductions status transferStatus netAmount notes paidAt payrollBatchId teacherId",
    populate: {
      path: "teacherId",
      select: "firstName lastName email",
    },
  });

  if (!payrollQuery) {
    return fail("Payroll record not found.", 404);
  }

  const payrollObj = payrollQuery.toObject();

  const { payrollIds, ...payrollBatchRest } = payrollObj;

  const payroll = {
    ...payrollBatchRest,
    payrolls: payrollIds.map((item: any) => {
      const { teacherId, ...payrollRest } = item;

      return {
        ...payrollRest,
        teacher: teacherId,
      };
    }),
  };

  return payroll;
};

type PaystackTransfer = {
  id: number;
  reference: string;
  transfer_code: string;
  status: "success" | "failed" | "pending" | "reversed" | "otp";
  amount: number;
  currency: string;
  transferred_at?: string | null;
  failures?: string | null;
};

const TERMINAL_TRANSFER_STATUSES = ["SUCCESS", "FAILED", "REVERSED"] as const;

const mapPaystackTransferStatus = (status: string): string => {
  switch (status.toLowerCase()) {
    case "success":
      return "SUCCESS";
    case "failed":
      return "FAILED";
    case "reversed":
      return "REVERSED";
    case "otp":
      return "OTP_REQUIRED";
    case "pending":
    default:
      return "TRANSFER_PENDING";
  }
};

export const reconcileBulkPayrollTransfer = async (
  batchId: string | string[],
) => {
  if (!isValidObjectId(batchId)) {
    throw new Error("Invalid payroll batch ID.");
  }

  const batch = await PayrollBatch.findById(batchId).populate({
    path: "payrollIds",
    select:
      "_id teacherId netAmount transferReference transferCode transferStatus",
  });

  if (!batch) {
    throw new Error("Payroll batch not found.");
  }

  const payrolls = batch.payrollIds as unknown as Array<{
    _id: mongoose.Types.ObjectId;
    teacherId: mongoose.Types.ObjectId;
    netAmount: number;
    transferReference?: string;
    transferCode?: string;
    transferStatus?: string;
  }>;

  const summary = {
    checked: 0,
    successful: 0,
    failed: 0,
    reversed: 0,
    pending: 0,
    skipped: 0,
    errors: [] as Array<{
      payrollId: string;
      reference?: string;
      message: string;
    }>,
  };

  for (const payroll of payrolls) {
    const reference = payroll.transferReference;

    if (!reference) {
      summary.skipped++;
      continue;
    }

    // A webhook may already have confirmed this transfer.
    // Do not waste an API request verifying an already-final record.
    if (
      TERMINAL_TRANSFER_STATUSES.includes(
        payroll.transferStatus as (typeof TERMINAL_TRANSFER_STATUSES)[number],
      )
    ) {
      summary.skipped++;
      continue;
    }

    try {
      summary.checked++;

      // Your paystackRequest helper returns the unwrapped data payload.
      const transfer = await paystackRequest<PaystackTransfer>(
        `/transfer/verify/${encodeURIComponent(reference)}`,
        PAYSTACK_BASE_URL,
        key,
        { method: "GET" },
      );

      if (transfer.reference !== reference) {
        throw new Error(
          "Paystack returned a transfer with a different reference.",
        );
      }

      const mappedStatus = mapPaystackTransferStatus(transfer.status);

      const isTerminal = TERMINAL_TRANSFER_STATUSES.includes(
        mappedStatus as (typeof TERMINAL_TRANSFER_STATUSES)[number],
      );

      const update: Record<string, unknown> = {
        transferCode: transfer.transfer_code,
      };

      if (isTerminal) {
        update.transferStatus = mappedStatus;
        update.transferCompletedAt = transfer.transferred_at
          ? new Date(transfer.transferred_at)
          : new Date();
      } else {
        update.transferStatus = mappedStatus;
      }

      if (mappedStatus === "FAILED") {
        update.transferFailureReason =
          transfer.failures || "Paystack transfer failed.";
      }

      if (mappedStatus === "REVERSED") {
        update.transferReversedAt = new Date();
        update.transferFailureReason =
          transfer.failures || "Paystack reversed this transfer.";
      }

      // Only update the payroll associated with this exact reference.
      // A pending verification must never overwrite a final webhook result.
      const filter: Record<string, unknown> = {
        _id: payroll._id,
        transferReference: reference,
      };

      if (!isTerminal) {
        filter.transferStatus = {
          $nin: [...TERMINAL_TRANSFER_STATUSES],
        };
      }

      await TeacherPayroll.updateOne(filter, { $set: update });

      switch (mappedStatus) {
        case "SUCCESS":
          summary.successful++;
          break;
        case "FAILED":
          summary.failed++;
          break;
        case "REVERSED":
          summary.reversed++;
          break;
        default:
          summary.pending++;
          break;
      }
    } catch (error) {
      summary.errors.push({
        payrollId: payroll._id.toString(),
        reference,
        message:
          error instanceof Error
            ? error.message
            : "Unknown reconciliation error.",
      });
    }
  }

  // Recalculate counts from the actual payroll documents.
  const refreshedPayrolls = await TeacherPayroll.find({
    payrollBatchId: batch._id,
  }).select("transferStatus");

  const totalEmployees = refreshedPayrolls.length;

  const successfulCount = refreshedPayrolls.filter(
    (p) => p.transferStatus === "SUCCESS",
  ).length;

  const failedCount = refreshedPayrolls.filter((p) =>
    ["FAILED", "REVERSED"].includes(p.transferStatus),
  ).length;

  const pendingCount = totalEmployees - successfulCount - failedCount;

  let batchStatus = "PROCESSING";

  if (totalEmployees > 0 && successfulCount === totalEmployees) {
    batchStatus = "COMPLETED";
  } else if (totalEmployees > 0 && failedCount === totalEmployees) {
    batchStatus = "FAILED";
  } else if (
    totalEmployees > 0 &&
    successfulCount + failedCount === totalEmployees
  ) {
    batchStatus = "PARTIALLY_COMPLETED";
  }

  await PayrollBatch.findByIdAndUpdate(
    batch._id,
    {
      $set: {
        totalEmployees,
        successfulCount,
        failedCount,
        pendingCount,
        status: batchStatus,
        ...(pendingCount === 0 ? { completedAt: new Date() } : {}),
      },
    },
    { new: true },
  );

  return {
    message: "Bulk payroll transfer reconciliation completed.",
    batchId: batch._id,
    batchStatus,
    totalEmployees,
    successfulCount,
    failedCount,
    pendingCount,
    reconciliation: summary,
  };
};
