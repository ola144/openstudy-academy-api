import mongoose from "mongoose";

import PaymentTransaction from "../../models/PaymentTransaction.ts";
import { fail, isValidObjectId } from "../../utils/helperFunctions.ts";

const PAYMENT_STATUSES = [
  "PENDING",
  "SUCCESS",
  "FAILED",
  "ABANDONED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
] as const;

type HistoryInput = {
  studentId: string;
  page?: number;
  limit?: number;
  status?: string;
};

export const getStudentPaymentHistory = async ({
  studentId,
  page = 1,
  limit = 10,
  status,
}: HistoryInput) => {
  if (!isValidObjectId(studentId)) {
    fail("Invalid student ID.");
  }

  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50
  ) {
    fail("Invalid pagination values.");
  }

  const filter: Record<string, unknown> = { studentId };

  if (status) {
    if (
      !PAYMENT_STATUSES.includes(status as (typeof PAYMENT_STATUSES)[number])
    ) {
      fail("Invalid payment status.");
    }

    filter.status = status;
  }

  const skip = (page - 1) * limit;

  const [transactionsQuery, total] = await Promise.all([
    PaymentTransaction.find(filter)
      .select(
        "reference provider providerTransactionId status amount currency description paidAt failureReason invoiceIds createdAt",
      )
      .populate({
        path: "invoiceIds",
        select:
          "invoiceNumber totalAmount amountPaid outstandingBalance status academicSession term",
      })
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit),

    PaymentTransaction.countDocuments(filter),
  ]);

  const transactions = transactionsQuery.map((t) => {
    const transactionObj = t.toObject();

    const { invoiceIds, ...invoiceRest } = transactionObj;

    return {
      invoices: invoiceIds,
      ...invoiceRest,
    };
  });

  return {
    transactions,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getStudentPaymentDetails = async (
  studentId: string,
  transactionId: string | string[],
) => {
  if (!isValidObjectId(studentId) || !isValidObjectId(transactionId)) {
    fail("Invalid student or transaction ID.");
  }

  const transactionQuery = await PaymentTransaction.findOne({
    _id: transactionId,
    studentId,
  })
    .select(
      "reference provider providerTransactionId status amount currency description paidAt failureReason invoiceIds createdAt",
    )
    .populate({
      path: "invoiceIds",
      select:
        "invoiceNumber totalAmount amountPaid outstandingBalance status academicSession term",
    });

  if (!transactionQuery) {
    fail("Payment transaction not found.", 404);
  }

  const transactionObj = transactionQuery.toObject();

  const { invoiceIds, ...invoiceRest } = transactionObj;

  const transaction = {
    invoices: invoiceIds,
    ...invoiceRest,
  };

  return transaction;
};
