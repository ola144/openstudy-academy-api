import TeacherPayroll from "../../models/TeacherPayroll.ts";
import { fail } from "../../utils/helperFunctions.ts";

export const getAdminPayrollSummary = async (period: string) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    fail("Period must use YYYY-MM format.");
  }

  const rows = await TeacherPayroll.aggregate([
    { $match: { period } },
    {
      $group: {
        _id: null,
        payrollRecords: { $sum: 1 },
        totalDraft: {
          $sum: {
            $cond: [{ $eq: ["$status", "DRAFT"] }, "$netAmount", 0],
          },
        },
        totalApprovedUnpaid: {
          $sum: {
            $cond: [{ $eq: ["$status", "TRANSFER_PENDING"] }, "$netAmount", 0],
          },
        },
        totalPaid: {
          $sum: {
            $cond: [{ $eq: ["$status", "PAID"] }, "$netAmount", 0],
          },
        },
        totalReversed: {
          $sum: {
            $cond: [{ $eq: ["$status", "REVERSED"] }, "$netAmount", 0],
          },
        },
        totalCancelled: {
          $sum: {
            $cond: [{ $eq: ["$status", "CANCELLED"] }, "$netAmount", 0],
          },
        },
        teachersPaid: {
          $sum: { $cond: [{ $eq: ["$status", "PAID"] }, 1, 0] },
        },
        teachersAwaitingPayment: {
          $sum: {
            $cond: [
              { in: ["$status", ["APPROVED", "TRANSFER_PENDING"]] },
              1,
              0,
            ],
          },
        },
        baseSalaryTotal: { $sum: "$baseSalary" },
        allowanceTotal: { $sum: "$allowances" },
        deductionTotal: { $sum: "$deductions" },
      },
    },
  ]);

  const result = rows[0] ?? {
    payrollRecords: 0,
    totalDraft: 0,
    totalApprovedUnpaid: 0,
    totalTransferPending: 0,
    totalPaid: 0,
    totalReversed: 0,
    totalCancelled: 0,
    teachersPaid: 0,
    teachersAwaitingPayment: 0,
    baseSalaryTotal: 0,
    allowanceTotal: 0,
    deductionTotal: 0,
  };

  delete result._id;

  return {
    period,
    currency: "NGN",
    unit: "kobo",
    ...result,
  };
};
