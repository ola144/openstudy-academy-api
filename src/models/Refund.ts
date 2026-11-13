import mongoose, { Schema, Types } from "mongoose";

export const RefundStatus = {
  INITIATING: "INITIATING",
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  PROCESSED: "PROCESSED",
  FAILED: "FAILED",
  NEEDS_ATTENTION: "NEEDS_ATTENTION",
} as const;

export type RefundStatusType = (typeof RefundStatus)[keyof typeof RefundStatus];

export interface IRefund {
  invoiceId: Types.ObjectId;
  studentId: Types.ObjectId;
  paymentTransactionId: Types.ObjectId;
  paymentReference: string;
  refundReference: string;
  paystackRefundId?: number;
  amount: number;
  currency: string;
  reason?: string;
  status: RefundStatusType;
  initiatedBy: Types.ObjectId;
  processedAt?: Date;
  failureReason?: string;
  lastPaystackStatus?: string;
  lastReconciledAt?: Date;
}

const refundSchema = new Schema<IRefund>(
  {
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: "StudentInvoice",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    paymentTransactionId: {
      type: Schema.Types.ObjectId,
      ref: "PaymentTransaction",
      required: true,
      index: true,
    },
    paymentReference: { type: String, required: true },
    refundReference: {
      type: String,
      required: true,
      unique: true,
    },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true, default: "NGN" },
    reason: String,
    status: {
      type: String,
      enum: Object.values(RefundStatus),
      default: RefundStatus.INITIATING,
      index: true,
    },
    initiatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    paystackRefundId: {
      type: Number,
      index: true,
    },
    lastPaystackStatus: String,
    lastReconciledAt: Date,
    processedAt: Date,
    failureReason: String,
  },
  {
    timestamps: true,
    toObject: {
      transform(doc, ret: any) {
        ret.id = ret._id;
        delete ret.__v;
        delete ret._id;
        return ret;
      },
    },
    toJSON: {
      transform(doc, ret: any) {
        ret.id = ret._id;
        delete ret.__v;
        delete ret._id;
        return ret;
      },
    },
  },
);

refundSchema.index({ invoiceId: 1, createdAt: -1 });
refundSchema.index({ paymentTransactionId: 1, status: 1 });

const Refund = mongoose.model<IRefund>("Refund", refundSchema);

export default Refund;
