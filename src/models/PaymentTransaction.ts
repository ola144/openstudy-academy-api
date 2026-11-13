import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

export const TransactionType = {
  PAYMENT: "PAYMENT",
  REFUND: "REFUND",
} as const;

export type TransactionType =
  (typeof TransactionType)[keyof typeof TransactionType];

export const TransactionStatus = {
  PENDING: "PENDING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  ABANDONED: "ABANDONED",
  REFUNDED: "REFUNDED",
  PARTIALLY_REFUNDED: "PARTIALLY_REFUNDED",
} as const;

export type TransactionStatus =
  (typeof TransactionStatus)[keyof typeof TransactionStatus];

export const PAYMENT_PROVIDERS = [
  "PAYSTACK",
  "FLUTTERWAVE",
  "BANK_TRANSFER",
  "MANUAL",
] as const;

export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

const paymentTransactionSchema = new Schema(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    invoiceIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "StudentInvoice",
      },
    ],

    reference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    providerTransactionId: {
      type: String,
      trim: true,
      default: null,
    },

    provider: {
      type: String,
      enum: PAYMENT_PROVIDERS,
      required: true,
    },

    status: {
      type: String,
      enum: Object.values(TransactionStatus),
      default: "PENDING",
      required: true,
      index: true,
    },

    // Store NGN amounts in kobo: ₦1,000 = 100000.
    amount: {
      type: Number,
      required: true,
      min: 1,
    },

    currency: {
      type: String,
      default: "NGN",
      required: true,
      uppercase: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    paidAt: {
      type: Date,
      default: null,
    },

    failureReason: {
      type: String,
      default: null,
    },

    // Admin review is not the same as gateway verification.
    reviewedAt: {
      type: Date,
      default: null,
    },

    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewNote: {
      type: String,
      trim: true,
      default: null,
    },

    authorizationUrl: {
      type: String,
      trim: true,
    },
    accessCode: {
      type: String,
      trim: true,
    },

    type: {
      type: String,
      enum: Object.values(TransactionType),
      default: TransactionType.PAYMENT,
      required: true,
    },

    refundId: {
      type: Schema.Types.ObjectId,
      ref: "Refund",
      sparse: true,
      unique: true,
    },

    originalTransactionId: {
      type: Schema.Types.ObjectId,
      ref: "PaymentTransaction",
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(doc, ref: any) {
        ref.id = ref._id;
        delete ref._id;
        delete ref.__v;

        return ref;
      },
    },
    toObject: {
      transform(doc, ref: any) {
        ref.id = ref._id;
        delete ref._id;
        delete ref.__v;

        return ref;
      },
    },
  },
);

paymentTransactionSchema.index({
  createdAt: -1,
  status: 1,
});

paymentTransactionSchema.index({
  studentId: 1,
  createdAt: -1,
});

const PaymentTransaction =
  models.PaymentTransaction ||
  model("PaymentTransaction", paymentTransactionSchema);

export default PaymentTransaction;
