import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

export const BANK_ACCOUNT_STATUSES = [
  "PENDING",
  "VERIFIED",
  "REJECTED",
] as const;

export type BankAccountStatus = (typeof BANK_ACCOUNT_STATUSES)[number];

const teacherBankAccountSchema = new Schema(
  {
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    bankCode: {
      type: String,
      required: true,
      trim: true,
    },
    bankName: {
      type: String,
      required: true,
      trim: true,
    },
    accountName: {
      type: String,
      required: true,
      trim: true,
    },
    // Encrypted account number; never return this to the frontend.
    accountNumberEncrypted: {
      type: String,
      required: true,
      select: false,
    },

    status: {
      type: String,
      enum: BANK_ACCOUNT_STATUSES,
      default: "PENDING",
      required: true,
      index: true,
    },

    accountNumberLast4: {
      type: String,
      required: true,
      match: /^\d{4}$/,
    },
    recipientCode: {
      type: String,
      trim: true,
    },
    verifiedAt: {
      type: Date,
    },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
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

teacherBankAccountSchema.index({ status: 1, createdAt: -1 });

const TeacherBankAccount =
  models.TeacherBankAccount ||
  model("TeacherBankAccount", teacherBankAccountSchema);

export default TeacherBankAccount;
