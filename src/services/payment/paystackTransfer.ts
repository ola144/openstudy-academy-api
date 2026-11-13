import dotenv from "dotenv";
dotenv.config();

import { randomUUID } from "node:crypto";
import TeacherBankAccount from "../../models/TeacherBankAccount.ts";
import TeacherPayroll from "../../models/TeacherPayroll.ts";
import {
  fail,
  isValidObjectId,
  paystackRequest,
} from "../../utils/helperFunctions.ts";
import { decryptAccountNumber } from "../../utils/bankEcryption.ts";

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const key = process.env.PAYSTACK_SECRET_KEY;

const normalizeAccountName = (value: string): string => {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
};

type ResolvedAccount = {
  account_number: string;
  account_name: string;
  bank_id: number;
};

type TransferRecipient = {
  recipient_code: string;
  name: string;
  details?: {
    account_number?: string;
    bank_code?: string;
    bank_name?: string;
    account_name?: string;
  };
};

type TransferResponse = {
  reference: string;
  transfer_code: string;
  status: string;
  amount: number;
  currency: string;
};

interface FinalizeTransferResponse {
  reference: string;
  amount: number;
  currency: string;
  status: string;
  transfer_code: string;
}

export const getPaystackBanks = () => {
  return paystackRequest<
    Array<{
      name: string;
      code: string;
      active: boolean;
      country: string;
      currency: string;
    }>
  >("/bank?country=nigeria&perPage=100", PAYSTACK_BASE_URL, key);
};

/** Admin get teachers pending banks */
export const getPendingTeacherBankAccounts = async () => {
  const bankAccountsQuery = await TeacherBankAccount.find({
    status: "PENDING",
  })
    .select(
      "teacherId bankCode bankName accountName accountNumberLast4 status createdAt",
    )
    .populate("teacherId", "firstName lastName email")
    .sort({ createdAt: 1 });

  const bankAccounts = bankAccountsQuery.map((b) => {
    const bankAccountObj = b.toObject();

    const { teacherId, ...bankAccountRest } = bankAccountObj;

    return {
      teacher: teacherId,
      ...bankAccountRest,
    };
  });

  return bankAccounts;
};

/**
 * Admin verifies a teacher's submitted account using Paystack
 * and creates the transfer recipient.
 */
export const verifyTeacherSubmittedBankAccount = async (input: {
  teacherId: string | string[];
  adminId: string;
}) => {
  if (!isValidObjectId(input.teacherId) || !isValidObjectId(input.adminId)) {
    fail("Invalid teacher or admin ID.");
  }

  const bankAccount = await TeacherBankAccount.findOne({
    teacherId: input.teacherId,
    status: "PENDING",
  }).select("+accountNumberEncrypted");

  if (!bankAccount) {
    fail("No pending bank account was found for this teacher.", 404);
  }

  const accountNumber = decryptAccountNumber(
    bankAccount.accountNumberEncrypted,
  );

  const resolved = await paystackRequest<ResolvedAccount>(
    `/bank/resolve?account_number=${encodeURIComponent(
      accountNumber,
    )}&bank_code=${encodeURIComponent(bankAccount.bankCode)}`,
    PAYSTACK_BASE_URL,
    key,
  );

  // Compare the bank's resolved account name with the name submitted
  // by the teacher. Do not silently verify a mismatched beneficiary.
  if (
    normalizeAccountName(resolved.account_name) !==
    normalizeAccountName(bankAccount.accountName)
  ) {
    return {
      verified: false,
      message: "The submitted account name does not match the bank record.",
      submittedAccountName: bankAccount.accountName,
      resolvedAccountName: resolved.account_name,
    };
  }

  const banks = await getPaystackBanks();

  const bank = banks.find((item) => item.code === bankAccount.bankCode);

  if (!bank || bank.active === false) {
    fail("The selected bank is not active on Paystack.", 422);
  }

  const recipient = await paystackRequest<TransferRecipient>(
    "/transferrecipient",
    PAYSTACK_BASE_URL,
    key,
    {
      method: "POST",
      body: JSON.stringify({
        type: "nuban",
        name: resolved.account_name,
        account_number: accountNumber,
        bank_code: bankAccount.bankCode,
        currency: "NGN",
        description: `Teacher payroll beneficiary ${input.teacherId}`,
      }),
    },
  );

  // Only mark verified after Paystack successfully creates the recipient.
  const updated = await TeacherBankAccount.findOneAndUpdate(
    {
      _id: bankAccount._id,
      status: "PENDING",
    },
    {
      $set: {
        status: "VERIFIED",
        accountName: resolved.account_name,
        bankName: bank?.name,
        recipientCode: recipient.recipient_code,
        verifiedAt: new Date(),
        verifiedBy: input.adminId,
        rejectionReason: null,
      },
    },
    { new: true, runValidators: true },
  ).select(
    "teacherId bankName bankCode accountName accountNumberLast4 status verifiedAt",
  );

  if (!updated) {
    fail(
      "The bank details changed while verification was in progress. Review them again.",
      409,
    );
  }

  return {
    verified: true,
    message: "Teacher bank account successfully verified.",
    data: updated,
  };
};

export async function rejectTeacherBankAccount(input: {
  teacherId: string | string[];
  adminId: string;
  reason: string;
}) {
  if (!isValidObjectId(input.teacherId) || !isValidObjectId(input.adminId)) {
    fail("Invalid teacher or admin ID.");
  }

  if (!input.reason?.trim()) {
    fail("Please provide a rejection reason.");
  }

  const result = await TeacherBankAccount.findOneAndUpdate(
    {
      teacherId: input.teacherId,
      status: "PENDING",
    },
    {
      $set: {
        status: "REJECTED",
        rejectionReason: input.reason.trim(),
        verifiedBy: input.adminId,
        verifiedAt: null,
        recipientCode: null,
      },
    },
    { new: true },
  ).select(
    "teacherId bankName bankCode accountName accountNumberLast4 status rejectionReason",
  );

  if (!result) {
    fail("No pending bank account was found.", 404);
  }

  return result;
}

const RESEND_COOLDOWN_SECONDS = 60;

export const initiateTeacherPayrollTransfer = async (input: {
  payrollId: any;
  adminId: string;
}) => {
  const { payrollId, adminId } = input;

  // 1. Validate IDs
  if (!isValidObjectId(payrollId) || !isValidObjectId(adminId)) {
    fail("Invalid payroll or admin ID.", 400);
  }

  // 2. Get payroll
  const payroll = await TeacherPayroll.findById(payrollId);

  if (!payroll) {
    return fail("Payroll record not found.", 404);
  }

  if (payroll.status !== "APPROVED") {
    fail("Only approved payroll can be transferred.", 409);
  }

  if (!Number.isSafeInteger(payroll.netAmount) || payroll.netAmount <= 0) {
    fail("Payroll amount must be a positive integer in kobo.", 400);
  }

  // 3. Get teacher's verified bank account
  const bankAccount = await TeacherBankAccount.findOne({
    teacherId: payroll.teacherId,
    status: "VERIFIED",
  }).select("+recipientCode");

  if (!bankAccount) {
    fail("The teacher has no verified bank account.", 409);
  }

  if (!bankAccount.recipientCode || !bankAccount.recipientCode.trim()) {
    fail(
      "The teacher's verified bank account has no Paystack recipient code. Please verify the bank account again.",
      409,
    );
  }

  // 4. Generate a unique transfer reference
  const reference = `payroll-${payroll._id}-${randomUUID()}`.toLowerCase();

  const now = new Date();

  // Reserve the resend cooldown atomically.
  const nextResendAvailableAt = new Date(
    now.getTime() + RESEND_COOLDOWN_SECONDS * 1000,
  );

  // 5. Atomically reserve the payroll
  const reserved = await TeacherPayroll.findOneAndUpdate(
    {
      _id: payroll._id,
      status: "APPROVED",
      transferStatus: "NOT_STARTED",
    },
    {
      $set: {
        status: "TRANSFER_PENDING",
        transferStatus: "PENDING",
        transferReference: reference,
        transferRecipientCode: bankAccount.recipientCode,
        transferOtpResendAvailableAt: nextResendAvailableAt,
        transferInitiatedAt: new Date(),
        transferFailureReason: null,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!reserved) {
    // Check whether the record still exists and inspect its latest state.

    return fail(
      "Unable to reserve payroll. Check its current transfer status.",
      409,
    );
  }

  // 6. Initiate transfer with Paystack
  // If this request times out, leave the payroll pending.
  // Reconcile using the same reference before attempting another transfer.
  const transfer = await paystackRequest<TransferResponse>(
    "/transfer",
    PAYSTACK_BASE_URL,
    key,
    {
      method: "POST",
      body: JSON.stringify({
        source: "balance",
        amount: reserved.netAmount,
        recipient: bankAccount.recipientCode,
        reference,
        currency: "NGN",
        reason: `Teacher salary for ${reserved.period}`,
      }),
    },
  );

  // 7. Validate Paystack response
  if (
    transfer.reference !== reference ||
    transfer.amount !== reserved.netAmount ||
    transfer.currency !== "NGN"
  ) {
    fail(
      "Paystack returned transfer details that do not match the payroll. Reconciliation is required.",
      502,
    );
  }

  if (!transfer.transfer_code) {
    fail(
      "Paystack did not return a transfer code. Reconciliation is required.",
      502,
    );
  }

  // 8. Explicitly map Paystack transfer statuses
  let normalizedStatus: "OTP_REQUIRED" | "PENDING" = "PENDING";

  switch (transfer.status?.toLowerCase()) {
    case "otp":
      normalizedStatus = "OTP_REQUIRED";
      break;

    case "pending":
      normalizedStatus = "PENDING";
      break;

    default:
      fail(
        `Unexpected Paystack transfer status: ${transfer.status}. Reconciliation is required.`,
        502,
      );
  }

  // 9. Save Paystack response
  const updateResult = await TeacherPayroll.updateOne(
    {
      _id: reserved._id,
      transferReference: reference,
      status: "TRANSFER_PENDING",
    },
    {
      $set: {
        transferCode: transfer.transfer_code,
        transferStatus: normalizedStatus,
      },
    },
  );

  // A webhook may have updated the payroll while this request was running.
  // Check the latest state instead of assuming the update failed.
  if (updateResult.modifiedCount === 0) {
    const latestPayroll = await TeacherPayroll.findById(reserved._id);

    if (latestPayroll?.transferReference !== reference) {
      return fail(
        "The payroll transfer state changed unexpectedly. Please reconcile this transfer.",
        409,
      );
    }

    if (
      latestPayroll.status === "PAID" &&
      latestPayroll.transferStatus === "SUCCESS"
    ) {
      return {
        payrollId: String(latestPayroll._id),
        reference,
        transferCode: transfer.transfer_code,
        transferStatus: "SUCCESS",
        message: "The payroll transfer has been confirmed.",
      };
    }

    if (latestPayroll.status !== "TRANSFER_PENDING") {
      fail(
        "The payroll transfer state changed. Please check its current status.",
        409,
      );
    }
  }

  // 10. Return result
  return {
    payrollId: String(reserved._id),
    reference,
    transferCode: transfer.transfer_code,
    transferStatus: normalizedStatus,
    message:
      normalizedStatus === "OTP_REQUIRED"
        ? "Paystack requires transfer authorization. Complete the OTP authorization process."
        : "Transfer initiated successfully. Await Paystack confirmation.",
  };
};

export const finalizeTeacherPayrollTransfer = async (input: {
  payrollId: string | string[];
  adminId: string | undefined;
  otp: string;
}) => {
  const { payrollId, adminId, otp } = input;

  if (!isValidObjectId(payrollId) || !isValidObjectId(adminId)) {
    fail("Invalid payroll or admin ID.", 400);
  }

  if (!/^\d{4,8}$/.test(otp)) {
    fail("Please provide a valid OTP.", 400);
  }

  // Find payroll
  const payroll = await TeacherPayroll.findById(payrollId);

  if (!payroll) {
    return fail("Payroll record not found.", 404);
  }

  if (payroll.status !== "TRANSFER_PENDING") {
    fail("This payroll is not awaiting transfer authorization.", 409);
  }

  if (payroll.transferStatus !== "OTP_REQUIRED") {
    fail("This payroll is not awaiting OTP authorization.", 409);
  }

  if (!payroll.transferCode || !payroll.transferReference) {
    fail("Transfer code or reference is missing.", 409);
  }

  // Verify that this transfer belongs to the expected payroll
  const expectedReference = payroll.transferReference;
  const expectedAmount = payroll.netAmount;

  // Finalize with Paystack
  const result = await paystackRequest<FinalizeTransferResponse>(
    "/transfer/finalize_transfer",
    PAYSTACK_BASE_URL,
    key,
    {
      method: "POST",
      body: JSON.stringify({
        transfer_code: payroll.transferCode,
        otp,
      }),
    },
  );

  // Validate response
  if (
    result.reference !== expectedReference ||
    result.amount !== expectedAmount ||
    result.currency !== "NGN" ||
    result.transfer_code !== payroll.transferCode
  ) {
    fail(
      "Paystack returned transfer details that do not match this payroll.",
      502,
    );
  }

  // Do not mark PAID here.
  // Webhook/verification must confirm the final transfer result.
  await TeacherPayroll.updateOne(
    {
      _id: payroll._id,
      status: "TRANSFER_PENDING",
      transferStatus: "OTP_REQUIRED",
      transferReference: expectedReference,
    },
    {
      $set: {
        transferStatus: "PENDING",
      },
    },
  );

  return {
    payrollId: String(payroll._id),
    reference: expectedReference,
    transferStatus: "PENDING",
    message:
      "OTP accepted. Paystack is processing the transfer. Await confirmation.",
  };
};

interface ResendTransferOTPResponse {
  status: boolean;
  message: string;
}

export const resendPaystackTransferOTP = async (
  transferCode: string,
): Promise<ResendTransferOTPResponse> => {
  const response = await paystackRequest<ResendTransferOTPResponse>(
    "/transfer/resend_otp",
    PAYSTACK_BASE_URL,
    key,
    {
      method: "POST",
      body: JSON.stringify({
        transfer_code: transferCode,
        reason: "transfer",
      }),
    },
  );

  return response;
};
