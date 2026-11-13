import mongoose from "mongoose";
import TeacherBankAccount from "../../models/TeacherBankAccount.ts";
import User from "../../models/User.ts";
import { encryptAccountNumber } from "../../utils/bankEcryption.ts";
import { fail, isValidObjectId } from "../../utils/helperFunctions.ts";

interface BankAccountInput {
  bankCode: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
}

const validateBankDetails = (input: BankAccountInput) => {
  if (
    typeof input.bankCode !== "string" ||
    !/^\d+$/.test(input.bankCode.trim())
  ) {
    fail("Please select a valid bank.");
  }

  if (typeof input.bankName !== "string" || !input.bankName.trim()) {
    fail("Bank name is required.");
  }

  if (
    typeof input.accountNumber !== "string" ||
    !/^\d{10}$/.test(input.accountNumber.trim())
  ) {
    fail("Account number must contain exactly 10 digits.");
  }

  if (
    typeof input.accountName !== "string" ||
    input.accountName.trim().length < 3
  ) {
    fail("Please provide a valid account holder name.");
  }
};

export const submitTeacherBankAccount = async (
  teacherId: string | undefined,
  input: BankAccountInput,
) => {
  if (!isValidObjectId(teacherId)) {
    fail("Invalid teacher id");
  }
  validateBankDetails(input);

  const teacher = await User.findOne({
    _id: teacherId,
    role: "TEACHER",
  }).select("_id");

  if (!teacher) {
    fail("Teacher account not found.", 404);
  }

  const accountNumber = input.accountNumber.trim();

  const bankAccount = await TeacherBankAccount.findOneAndUpdate(
    { teacherId },
    {
      $set: {
        bankCode: input.bankCode.trim(),
        bankName: input.bankName.trim(),
        accountNumberEncrypted: encryptAccountNumber(accountNumber),
        accountNumberLast4: accountNumber.slice(-4),
        accountName: input.accountName.trim(),

        // Every submission or change requires admin verification again.
        status: "PENDING",
        verifiedAt: null,
        verifiedBy: null,
        rejectionReason: null,

        // Remove the old recipient so it cannot be used for a new payout.
        recipientCode: null,
        updatedBy: teacherId,
      },
      $setOnInsert: {
        teacherId,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  ).select(
    "teacherId bankCode bankName accountName accountNumberLast4 status verifiedAt rejectionReason createdAt updatedAt",
  );

  return bankAccount;
};

export const getMyBankAccount = async (teacherId: string | undefined) => {
  if (!isValidObjectId(teacherId)) {
    fail("Invalid teacher id");
  }

  const bankAccountQuery = await TeacherBankAccount.findOne({
    teacherId,
  }).select(
    "teacherId bankCode bankName accountName accountNumberLast4 status verifiedAt rejectionReason createdAt updatedAt",
  );

  if (!bankAccountQuery) {
    return null;
  }

  const bankAccountObj = bankAccountQuery;

  const bankAccount = bankAccountObj;

  return bankAccount;
};
