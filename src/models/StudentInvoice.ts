import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

export const INVOICE_STATUSES = [
  "DRAFT",
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CANCELLED",
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const FEE_CATEGORIES = [
  "TUITION",
  "REGISTRATION",
  "DEVELOPMENT_LEVY",
  "EXAMINATION",
  "LEARNING_MATERIALS",
  "DIGITAL_SUBSCRIPTION",
  "OTHER",
] as const;

export type FeeCategory = (typeof FEE_CATEGORIES)[number];

const invoiceItemSchema = new Schema(
  {
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    category: {
      type: String,
      enum: FEE_CATEGORIES,
      required: true,
    },

    // Amount in the smallest currency unit: kobo for NGN.
    amount: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Item amount must be a safe integer",
      },
    },
  },
  { _id: true },
);

const studentInvoiceSchema = new Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
      index: true,
    },

    academicSession: {
      type: String,
      required: true,
      trim: true,
      // Example: 2026/2027
    },

    term: {
      type: String,
      enum: ["FIRST", "SECOND", "THIRD"],
      required: true,
    },

    items: {
      type: [invoiceItemSchema],
      required: true,
      validate: {
        validator: (items: unknown[]) => items.length > 0,
        message: "An invoice must contain at least one fee item",
      },
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Subtotal must be a safe integer",
      },
    },

    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Discount must be a safe integer",
      },
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Total amount must be a safe integer",
      },
    },

    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Amount paid must be a safe integer",
      },
    },

    outstandingBalance: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Outstanding balance must be a safe integer",
      },
    },

    currency: {
      type: String,
      default: "NGN",
      required: true,
      uppercase: true,
    },

    issuedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },

    dueDate: {
      type: Date,
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: INVOICE_STATUSES,
      default: "UNPAID",
      required: true,
      index: true,
    },

    refundedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    refundPendingAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Optional instalment plan.
    allowInstallments: {
      type: Boolean,
      default: false,
    },

    installmentCount: {
      type: Number,
      default: 1,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Installment count must be an integer",
      },
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    cancellationReason: {
      type: String,
      trim: true,
      default: null,
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

studentInvoiceSchema.index({
  studentId: 1,
  academicSession: 1,
  term: 1,
});

studentInvoiceSchema.index({
  status: 1,
  dueDate: 1,
});

// These indexes help with admin reporting and student invoice history.
studentInvoiceSchema.index({
  classId: 1,
  createdAt: -1,
});

const StudentInvoice =
  models.StudentInvoice || model("StudentInvoice", studentInvoiceSchema);

export default StudentInvoice;
