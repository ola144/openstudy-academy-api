import mongoose from "mongoose";

import User from "../../models/User.ts";
import TeacherPayroll from "../../models/TeacherPayroll.ts";
import { fail, isValidObjectId } from "../../utils/helperFunctions.ts";
import {
  processPayrollTransferEvent,
  verifyTransfer,
} from "./paystackPayrollWebhook.ts";
import TeacherBankAccount from "../../models/TeacherBankAccount.ts";

const validateMoney = (value: unknown, field: string) => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    fail(`${field} must be a non-negative whole number of kobo.`);
  }

  return value;
};

export const validatePeriod = (period: string) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    fail("Period must use YYYY-MM format.");
  }
};

type CreatePayrollInput = {
  teacherId: string;
  period: string;
  baseSalary: number;
  allowances?: number;
  deductions?: number;
  notes?: string;
};

export const createTeacherPayroll = async (
  input: CreatePayrollInput,
  adminId: string,
) => {
  if (!isValidObjectId(input.teacherId) || !isValidObjectId(adminId)) {
    fail("Invalid teacher or admin ID.");
  }

  validatePeriod(input.period);

  const baseSalary = validateMoney(input.baseSalary, "baseSalary");
  const allowances = validateMoney(input.allowances ?? 0, "allowances");
  const deductions = validateMoney(input.deductions ?? 0, "deductions");

  const netAmount =
    Number(baseSalary) + Number(allowances) - Number(deductions);

  if (!Number.isSafeInteger(netAmount) || netAmount < 0) {
    fail("Deductions cannot exceed salary plus allowances.");
  }

  if (input.notes !== undefined && typeof input.notes !== "string") {
    fail("Notes must be a string.");
  }

  if ((input.notes?.length ?? 0) > 1000) {
    fail("Notes cannot exceed 1000 characters.");
  }

  const teacher = await User.findOne({
    _id: input.teacherId,
    role: "TEACHER",
  }).select("_id firstName lastName email");

  if (!teacher) {
    return fail("Teacher account not found.", 404);
  }

  const bankAccount = await TeacherBankAccount.findOne({
    teacherId: teacher._id,
    status: "VERIFIED",
  });

  if (!bankAccount?.recipientCode) {
    return fail(`Teacher ${teacher._id} has no verified Paystack recipient.`);
  }

  try {
    const payroll = await TeacherPayroll.create({
      teacherId: teacher?._id,
      period: input.period,
      baseSalary: Number(baseSalary),
      allowances: Number(allowances),
      deductions: Number(deductions),
      netAmount,
      notes: input.notes?.trim(),
      transferRecipientCode: bankAccount.recipientCode,
      createdBy: adminId,
      status: "DRAFT",
    });

    return TeacherPayroll.findById(payroll._id)
      .populate("teacherId", "firstName lastName email")
      .populate("createdBy", "firstName lastName email")
      .lean();
  } catch (error) {
    if (
      error instanceof mongoose.Error &&
      error.name === "MongoServerError" &&
      (error as mongoose.mongo.MongoServerError).code === 11000
    ) {
      fail("Payroll already exists for this teacher and period.", 409);
    }

    throw error;
  }
};

type PayrollListInput = {
  page?: number;
  limit?: number;
  period?: string;
  status?: string;
  teacherId?: string;
};

export const getAdminTeacherPayrolls = async ({
  page = 1,
  limit = 10,
  period,
  status,
  teacherId,
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
        "DRAFT",
        "APPROVED",
        "TRANSFER_PENDING",
        "PAID",
        "REVERSED",
        "CANCELLED",
      ].includes(status)
    ) {
      fail("Invalid payroll status.");
    }

    filter.status = status;
  }

  if (teacherId) {
    if (!isValidObjectId(teacherId)) fail("Invalid teacher ID.");
    filter.teacherId = teacherId;
  }

  const [payrollsQuery, total] = await Promise.all([
    TeacherPayroll.find(filter)
      .populate("teacherId", "firstName lastName email")
      .populate("approvedBy", "firstName lastName")
      .populate("paidBy", "firstName lastName")
      .sort({ period: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),

    TeacherPayroll.countDocuments(filter),
  ]);

  const payrolls = payrollsQuery.map((p) => {
    const payrollObj = p.toObject();

    const { teacherId, approvedBy, paidBy, ...payrollRest } = payrollObj;

    return {
      teacher: teacherId,
      approvedBy,
      paidBy,
      ...payrollRest,
    };
  });

  return {
    payrolls,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getAdminTeacherPayrollById = async (id: string | string[]) => {
  if (!isValidObjectId(id)) fail("Invalid payroll ID.");

  const payrollQuery = await TeacherPayroll.findById(id)
    .populate("teacherId", "firstName lastName email")
    .populate("createdBy", "firstName lastName")
    .populate("approvedBy", "firstName lastName")
    .populate("paidBy", "firstName lastName");

  if (!payrollQuery) {
    return fail("Payroll record not found.", 404);
  }

  const payrollObj = payrollQuery.toObject();

  const { teacherId, createdBy, approvedBy, paidBy, ...payrollRest } =
    payrollObj;

  const payroll = {
    teacher: teacherId,
    createdBy,
    approvedBy,
    paidBy,
    ...payrollRest,
  };

  return payroll;
};

export const approveTeacherPayroll = async (
  payrollId: string | string[],
  adminId: string,
) => {
  if (!isValidObjectId(payrollId) || !isValidObjectId(adminId)) {
    fail("Invalid payroll or admin ID.");
  }

  const payroll = await TeacherPayroll.findOneAndUpdate(
    { _id: payrollId, status: "DRAFT" },
    {
      $set: {
        status: "APPROVED",
        approvedBy: adminId,
        approvedAt: new Date(),
      },
    },
    { new: true, runValidators: true },
  )
    .populate("teacherId", "firstName lastName email")
    .lean();

  if (!payroll) {
    fail("Payroll not found or it is no longer a draft.", 409);
  }

  return payroll;
};

type RecordPayrollPaymentInput = {
  payrollId: string | string[];
  adminId: string;
  paymentReference: string;
  paymentMethod: "BANK_TRANSFER" | "PAYSTACK" | "MANUAL";
};

// export const recordTeacherPayrollPayment = async ({
//   payrollId,
//   adminId,
//   paymentReference,
//   paymentMethod,
// }: RecordPayrollPaymentInput) => {
//   if (!isValidObjectId(payrollId) || !isValidObjectId(adminId)) {
//     fail("Invalid payroll or admin ID.");
//   }

//   if (
//     typeof paymentReference !== "string" ||
//     !paymentReference.trim() ||
//     paymentReference.length > 150
//   ) {
//     fail("A valid payment reference is required.");
//   }

//   if (!["BANK_TRANSFER", "PAYSTACK", "MANUAL"].includes(paymentMethod)) {
//     fail("Invalid payment method.");
//   }

//   const payroll = await TeacherPayroll.findOneAndUpdate(
//     { _id: payrollId, status: "APPROVED" },
//     {
//       $set: {
//         status: "PAID",
//         paidBy: adminId,
//         paidAt: new Date(),
//         paymentReference: paymentReference.trim(),
//         paymentMethod,
//       },
//     },
//     { new: true, runValidators: true },
//   )
//     .populate("teacherId", "firstName lastName email")
//     .lean();

//   if (!payroll) {
//     fail("Payroll not found or it has not been approved.", 409);
//   }

//   return payroll;
// };

export const cancelTeacherPayroll = async (
  payrollId: string | string[],
  adminId: string,
  reason: string,
) => {
  if (!isValidObjectId(payrollId) || !isValidObjectId(adminId)) {
    fail("Invalid payroll or admin ID.");
  }

  if (!reason?.trim() || reason.trim().length > 500) {
    fail("A cancellation reason of at most 500 characters is required.");
  }

  const payroll = await TeacherPayroll.findOneAndUpdate(
    {
      _id: payrollId,
      status: { $in: ["DRAFT", "APPROVED"] },
    },
    {
      $set: {
        status: "CANCELLED",
        cancellationReason: reason.trim(),
        cancelledBy: adminId,
        cancelledAt: new Date(),
      },
    },
    { new: true, runValidators: true },
  ).lean();

  if (!payroll) {
    fail("Payroll not found or cannot be cancelled in its current state.", 409);
  }

  return payroll;
};

export const reconcilePayrollTranser = async (payrollId: string | string[]) => {
  const payroll = await TeacherPayroll.findById(payrollId);

  if (!payroll) {
    return fail("Payrall record not found!", 404);
  }

  // Only reconcile transfers that are still pending.
  if (!["PENDING", "OTP_REQUIRED"].includes(payroll.transferStatus)) {
    return payroll;
  }

  if (!payroll.transferReference) {
    fail("Transfer reference not found", 404);
  }

  const transfer = await verifyTransfer(payroll.transferReference);

  // Ensure the response belongs to the expected transfer
  if (
    transfer.reference !== payroll.transferReference ||
    transfer.amount !== payroll.netAmount ||
    transfer.currency !== "NGN"
  ) {
    fail("Paystack transfer details do not match payroll.");
  }

  let event:
    | "transfer.success"
    | "transfer.failed"
    | "transfer.reversed"
    | null = null;

  switch (transfer.status.toLowerCase()) {
    case "success":
      event = "transfer.success";
      break;

    case "failed":
      event = "transfer.failed";
      break;

    case "reversed":
      event = "transfer.reversed";
      break;

    case "pending":
    case "otp":
    case "processing":
      return payroll;

    default:
      console.warn(`Unrecognized Paystack transfer status: ${transfer.status}`);
      return payroll;
  }

  await processPayrollTransferEvent({
    event,
    reference: transfer.reference,
  });

  return TeacherPayroll.findById(payroll._id);
};
