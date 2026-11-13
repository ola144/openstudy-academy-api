import mongoose from "mongoose";
import PaymentTransaction, {
  TransactionStatus,
} from "../../models/PaymentTransaction.ts";
import { isValidObjectId } from "../../utils/helperFunctions.ts";

type TransactionFilters = {
  page?: number;
  limit?: number;
  status?: string;
  provider?: string;
  reference?: string;
  studentId?: string;
  from?: string;
  to?: string;
};

export const parseDate = (value?: string) => {
  if (!value) return undefined;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw Object.assign(new Error(`Invalid date: ${value}`), {
      statusCode: 400,
    });
  }

  return date;
};

export const getAdminTransactions = async (filters: TransactionFilters) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filters.limit) || 10));

  const query: Record<string, any> = {};

  if (filters.status) {
    if (
      !Object.values(TransactionStatus).includes(
        filters.status as (typeof TransactionStatus)[keyof typeof TransactionStatus],
      )
    ) {
      throw Object.assign(new Error("Invalid transaction status"), {
        statusCode: 400,
      });
    }

    query.status = filters.status;
  }

  if (filters.provider) {
    query.provider = filters.provider.toUpperCase();
  }

  if (filters.reference?.trim()) {
    query.reference = {
      $regex: filters.reference.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      $options: "i",
    };
  }

  if (filters.studentId) {
    if (!isValidObjectId(filters.studentId)) {
      throw Object.assign(new Error("Invalid student ID"), {
        statusCode: 400,
      });
    }

    query.studentId = filters.studentId;
  }

  const from = parseDate(filters.from);
  const to = parseDate(filters.to);

  if (from || to) {
    query.createdAt = {};

    if (from) query.createdAt.$gte = from;
    if (to) query.createdAt.$lte = to;

    if (from && to && from > to) {
      throw Object.assign(
        new Error("'from' must be earlier than or equal to 'to'"),
        { statusCode: 400 },
      );
    }
  }

  const [transactionsQuery, total] = await Promise.all([
    PaymentTransaction.find(query)
      .populate("studentId", "firstName lastName email")
      .populate(
        "invoiceIds",
        "invoiceNumber totalAmount refundedAmount amountPaid status",
      )
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),

    PaymentTransaction.countDocuments(query),
  ]);

  const transactions = transactionsQuery.map((t) => {
    const transactionObj = t.toObject();

    const { studentId, invoiceIds, ...transactionRest } = transactionObj;

    return {
      student: studentId,
      invoices: invoiceIds,
      ...transactionRest,
    };
  });

  return {
    transactions,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
};

export const getAdminTransactionSummary = async (
  from?: string,
  to?: string,
) => {
  const startDate = parseDate(from);
  const endDate = parseDate(to);

  if (startDate && endDate && startDate > endDate) {
    throw Object.assign(
      new Error("'from' must be earlier than or equal to 'to'"),
      { statusCode: 400 },
    );
  }

  const match: Record<string, any> = {};

  if (startDate || endDate) {
    match.createdAt = {};

    if (startDate) match.createdAt.$gte = startDate;
    if (endDate) match.createdAt.$lte = endDate;
  }

  const [result] = await PaymentTransaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalTransactions: { $sum: 1 },

        pendingCount: {
          $sum: {
            $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0],
          },
        },

        successfulCount: {
          $sum: {
            $cond: [
              { $in: ["$status", ["SUCCESS", "PARTIALLY_REFUNDED"]] },
              1,
              0,
            ],
          },
        },

        failedCount: {
          $sum: {
            $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0],
          },
        },

        refundedCount: {
          $sum: {
            $cond: [
              { $in: ["$status", ["REFUNDED", "PARTIALLY_REFUNDED"]] },
              1,
              0,
            ],
          },
        },

        successfulAmount: {
          $sum: {
            $cond: [
              { $in: ["$status", ["SUCCESS", "PARTIALLY_REFUNDED"]] },
              "$amount",
              0,
            ],
          },
        },
      },
    },
    {
      $project: { _id: 0 },
    },
  ]);

  return (
    result ?? {
      totalTransactions: 0,
      pendingCount: 0,
      successfulCount: 0,
      failedCount: 0,
      refundedCount: 0,
      successfulAmount: 0,
    }
  );
};

export const getAdminTransactionById = async (id: string | string[]) => {
  if (!isValidObjectId(id)) {
    throw Object.assign(new Error("Invalid transaction ID"), {
      statusCode: 400,
    });
  }

  const transactionQuery = await PaymentTransaction.findById(id)
    .populate("studentId", "firstName lastName email")
    .populate(
      "invoiceIds",
      "invoiceNumber amountPaid totalAmount refundedAmount status",
    )
    .populate("reviewedBy", "firstName lastName email");

  if (!transactionQuery) {
    throw Object.assign(new Error("Transaction not found"), {
      statusCode: 404,
    });
  }

  const transactionObj = transactionQuery.toObject();

  const { studentId, invoiceIds, reviewedBy, ...transactionRest } =
    transactionObj;

  const transaction = {
    student: studentId,
    invoices: invoiceIds,
    reviewedBy,
    ...transactionRest,
  };

  return transaction;
};

export const markTransactionReviewed = async (
  id: string | string[],
  adminId: string,
  reviewNote: string,
) => {
  if (!isValidObjectId(id) || !isValidObjectId(adminId)) {
    throw Object.assign(new Error("Invalid transaction or admin ID"), {
      statusCode: 400,
    });
  }

  if (!reviewNote?.trim()) {
    throw Object.assign(new Error("A review note is required"), {
      statusCode: 400,
    });
  }

  const transaction = await PaymentTransaction.findByIdAndUpdate(
    id,
    {
      $set: {
        reviewedAt: new Date(),
        reviewedBy: adminId,
        reviewNote: reviewNote.trim(),
      },
    },
    { new: true, runValidators: true },
  )
    .populate("studentId", "firstName lastName email")
    .populate("reviewedBy", "firstName lastName email");

  if (!transaction) {
    throw Object.assign(new Error("Transaction not found"), {
      statusCode: 404,
    });
  }

  return transaction;
};
