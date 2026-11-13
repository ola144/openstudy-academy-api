import mongoose, { Types } from "mongoose";

const { Schema, model, models } = mongoose;

export const PAYROLL_STATUSES = [
  "DRAFT",
  "APPROVED",
  "TRANSFER_PENDING",
  "PAID",
  "FAILED",
  "REVERSED",
  "CANCELLED",
] as const;

export type PayrollStatus = (typeof PAYROLL_STATUSES)[number];

export const PAYROLL_TRANSFER_STATUSES = [
  "NOT_STARTED",
  "PENDING",
  "OTP_REQUIRED",
  "SUCCESS",
  "FAILED",
  "REVERSED",
] as const;

export type PayrollTransferStatus = (typeof PAYROLL_TRANSFER_STATUSES)[number];

interface ITeacherPayroll {
  teacherId: Types.ObjectId;
  period: string;
  currency: string;
  baseSalary: number;
  allowances: number;
  deductions: number;
  netAmount: number;
  status: PayrollStatus;
  notes: string;
  createdBy: Types.ObjectId;
  approvedBy: Types.ObjectId;
  approvedAt: Date;
  paidBy: Types.ObjectId;
  paidAt: Date;
  paymentReference: string;
  paymentMethod: string;
  cancellationReason: string;
  cancelledBy: Types.ObjectId;
  cancelledAt: Date;
  transferRecipientCode: string;
  transferReference: string;
  transferCode: string;
  transferStatus: PayrollTransferStatus;
  transferInitiatedAt: Date;
  transferCompletedAt: Date;
  transferFailureReason: string;
  transferReversedAt: Date;
  transferOtpResendAvailableAt: Date;
  payrollBatchId: Types.ObjectId;
}

const payrollSchema = new Schema<ITeacherPayroll>(
  {
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    period: {
      type: String,
      required: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
    },

    currency: {
      type: String,
      enum: ["NGN"],
      default: "NGN",
      required: true,
    },

    baseSalary: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },

    allowances: {
      type: Number,
      default: 0,
      min: 0,
      validate: Number.isSafeInteger,
    },

    deductions: {
      type: Number,
      default: 0,
      min: 0,
      validate: Number.isSafeInteger,
    },

    netAmount: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },

    status: {
      type: String,
      enum: PAYROLL_STATUSES,
      default: "DRAFT",
      required: true,
      index: true,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    approvedAt: Date,

    paidBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    paidAt: Date,

    paymentReference: {
      type: String,
      trim: true,
    },

    paymentMethod: {
      type: String,
      enum: ["BANK_TRANSFER", "PAYSTACK", "MANUAL"],
    },

    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    cancelledAt: Date,
    transferRecipientCode: {
      type: String,
      trim: true,
    },
    transferReference: {
      type: String,
      trim: true,
    },
    transferCode: {
      type: String,
      trim: true,
    },
    transferStatus: {
      type: String,
      enum: PAYROLL_TRANSFER_STATUSES,
      default: "NOT_STARTED",
      required: true,
    },
    transferInitiatedAt: Date,
    transferCompletedAt: Date,
    transferFailureReason: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    transferReversedAt: Date,
    transferOtpResendAvailableAt: {
      type: Date,
      default: null,
    },

    payrollBatchId: {
      type: Schema.Types.ObjectId,
      ref: "PayrollBatch",
      index: true,
      default: null,
    },
  },
  {
    timestamps: true,
    toObject: {
      transform(doc, ref: any) {
        ref.id = ref._id;
        delete ref._id;
        delete ref.__v;
        return ref;
      },
    },
    toJSON: {
      transform(doc, ref: any) {
        ref.id = ref._id;
        delete ref._id;
        delete ref.__v;
        return ref;
      },
    },
  },
);

// A teacher should have only one payroll record per month.
payrollSchema.index({ teacherId: 1, period: 1 }, { unique: true });

payrollSchema.index(
  { transferReference: 1 },
  {
    unique: true,
    partialFilterExpression: {
      transferReference: { $type: "string" },
    },
  },
);

payrollSchema.index({ period: 1, status: 1 });

payrollSchema.index({
  payrollBatchId: 1,
  transferStatus: 1,
});

const TeacherPayroll = model<ITeacherPayroll>("TeacherPayroll", payrollSchema);

export default TeacherPayroll;
