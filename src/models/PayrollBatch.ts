import mongoose, { Schema, Types } from "mongoose";

export const PayrollBatchStatus = {
  PENDING_APPROVAL: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  PARTIALLY_COMPLETED: "PARTIALLY_COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;

export type PayrollBatchStatus =
  (typeof PayrollBatchStatus)[keyof typeof PayrollBatchStatus];

export interface IPayrollBatch {
  batchNumber: string;
  period: string;
  currency: "NGN";

  payrollIds: Types.ObjectId[];

  totalEmployees: number;
  totalAmount: number;

  successfulCount: number;
  failedCount: number;
  pendingCount: number;

  status: PayrollBatchStatus;

  createdBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;

  submittedAt?: Date;
  completedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const payrollBatchSchema = new Schema<IPayrollBatch>(
  {
    batchNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    period: {
      type: String,
      required: true,
      index: true,
    },

    currency: {
      type: String,
      enum: ["NGN"],
      default: "NGN",
      required: true,
    },

    payrollIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "TeacherPayroll",
        required: true,
      },
    ],

    totalEmployees: {
      type: Number,
      required: true,
      min: 1,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 1,
    },

    successfulCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    failedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    pendingCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: Object.values(PayrollBatchStatus),
      default: PayrollBatchStatus.PENDING_APPROVAL,
      index: true,
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
    submittedAt: Date,
    completedAt: Date,
  },
  {
    timestamps: true,
    toObject: {
      transform(doc, ret: any) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toJSON: {
      transform(doc, ret: any) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

payrollBatchSchema.index({ period: 1, status: 1 });

const PayrollBatch = mongoose.model<IPayrollBatch>(
  "PayrollBatch",
  payrollBatchSchema,
);

export default PayrollBatch;
