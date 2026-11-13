import TeacherPayroll from "../../models/TeacherPayroll.ts";
import { fail, isValidObjectId } from "../../utils/helperFunctions.ts";

export const getMyTeacherPayrollHistory = async (
  teacherId: string,
  page = 1,
  limit = 10,
) => {
  if (!isValidObjectId(teacherId)) fail("Invalid teacher ID.");

  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50
  ) {
    fail("Invalid pagination values.");
  }

  const filter = {
    teacherId,
    status: { $in: ["APPROVED", "TRANSFER_PENDING", "PAID", "REVERSED"] },
  };

  const [payrollsQuery, total] = await Promise.all([
    TeacherPayroll.find(filter)
      .select(
        "period baseSalary allowances deductions netAmount currency status approvedAt paidAt paymentReference paymentMethod transferStatus transferReference transferCode transferFailureReason transferInitiatedAt transferCompletedAt transferReversedAt createdAt",
      )
      .sort({ period: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),

    TeacherPayroll.countDocuments(filter),
  ]);

  const payrolls = payrollsQuery.map((p) => {
    const payrollObj = p.toObject();

    return payrollObj;
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

export const getMyTeacherPayrollDetails = async (
  teacherId: string,
  payrollId: string | string[],
) => {
  if (!isValidObjectId(teacherId) || !isValidObjectId(payrollId)) {
    fail("Invalid teacher or payroll ID.");
  }

  const payrollQuery = await TeacherPayroll.findOne({
    _id: payrollId,
    teacherId,
    status: { $in: ["APPROVED", "TRANSFER_PENDING", "PAID", "REVERSED"] },
  }).select(
    "period baseSalary allowances deductions netAmount currency status approvedAt paidAt paymentReference paymentMethod transferStatus transferReference transferCode transferFailureReason transferInitiatedAt transferCompletedAt transferReversedAt createdAt",
  );

  if (!payrollQuery) {
    fail("Payroll record not found.", 404);
  }

  const payrollObj = payrollQuery.toObject();

  const payroll = payrollObj;

  return payroll;
};
