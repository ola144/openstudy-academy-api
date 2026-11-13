import mongoose from "mongoose";
import StudentInvoice from "../../models/StudentInvoice.ts";
import { fail, isValidObjectId } from "../../utils/helperFunctions.ts";
import { syncOverdueInvoices } from "./overdueInvoice.ts";

type StudentInvoiceFilters = {
  studentId: string;
  page?: number;
  limit?: number;
  status?: string;
  academicSession?: string;
  term?: string;
};

export const getStudentInvoices = async (filters: StudentInvoiceFilters) => {
  await syncOverdueInvoices();

  const { studentId, status, academicSession, term } = filters;

  if (!isValidObjectId(studentId)) {
    fail("Invalid student ID", 401);
  }

  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filters.limit) || 10));

  const query: Record<string, unknown> = {
    studentId,
    status: { $ne: "DRAFT" },
  };

  if (status) {
    const allowedStatuses = [
      "UNPAID",
      "PARTIALLY_PAID",
      "PAID",
      "OVERDUE",
      "CANCELLED",
    ];

    if (!allowedStatuses.includes(status)) {
      fail("Invalid invoice status");
    }

    query.status = status;
  }

  if (academicSession) {
    if (!/^\d{4}\/\d{4}$/.test(academicSession)) {
      fail("Invalid academic session");
    }

    query.academicSession = academicSession;
  }

  if (term) {
    if (!["FIRST", "SECOND", "THIRD"].includes(term)) {
      fail("Invalid academic term");
    }

    query.term = term;
  }

  const [invoicesQuery, total] = await Promise.all([
    StudentInvoice.find(query)
      .select(
        [
          "invoiceNumber",
          "academicSession",
          "term",
          "items",
          "subtotal",
          "discountAmount",
          "totalAmount",
          "amountPaid",
          "outstandingBalance",
          "currency",
          "issuedAt",
          "dueDate",
          "status",
          "allowInstallments",
          "installmentCount",
          "notes",
          "createdAt",
        ].join(" "),
      )
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),

    StudentInvoice.countDocuments(query),
  ]);

  const invoices = invoicesQuery.map((i) => {
    const invoiceObj = i.toObject();

    return invoiceObj;
  });

  return {
    invoices,
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

export const getStudentInvoiceById = async (
  invoiceId: string | string[],
  studentId: string,
) => {
  if (!isValidObjectId(invoiceId) || !isValidObjectId(studentId)) {
    fail("Invalid invoice or student ID");
  }

  const invoiceQuery = await StudentInvoice.findOne({
    _id: invoiceId,
    studentId,
    status: { $ne: "DRAFT" },
  }).select("-__v");

  if (!invoiceQuery) {
    // Do not reveal whether another student's invoice exists.
    fail("Invoice not found", 404);
  }

  const invoiceObj = invoiceQuery.toObject();

  const invoice = invoiceObj;

  return invoice;
};

export const getStudentInvoiceSummary = async (studentId: string) => {
  if (!isValidObjectId(studentId)) {
    fail("Invalid student ID", 401);
  }

  const [summary] = await StudentInvoice.aggregate([
    {
      $match: {
        studentId: new mongoose.Types.ObjectId(studentId),
        status: { $nin: ["DRAFT", "CANCELLED"] },
      },
    },
    {
      $group: {
        _id: null,

        totalInvoices: { $sum: 1 },

        totalBilled: { $sum: "$totalAmount" },

        totalPaid: { $sum: "$amountPaid" },

        outstandingBalance: {
          $sum: "$outstandingBalance",
        },

        paidInvoices: {
          $sum: {
            $cond: [{ $eq: ["$status", "PAID"] }, 1, 0],
          },
        },

        unpaidInvoices: {
          $sum: {
            $cond: [
              {
                $in: ["$status", ["UNPAID", "PARTIALLY_PAID", "OVERDUE"]],
              },
              1,
              0,
            ],
          },
        },

        overdueInvoices: {
          $sum: {
            $cond: [{ $eq: ["$status", "OVERDUE"] }, 1, 0],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
      },
    },
  ]);

  return (
    summary ?? {
      totalInvoices: 0,
      totalBilled: 0,
      totalPaid: 0,
      outstandingBalance: 0,
      paidInvoices: 0,
      unpaidInvoices: 0,
      overdueInvoices: 0,
    }
  );
};
