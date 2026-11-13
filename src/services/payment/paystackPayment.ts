import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

import User from "../../models/User.ts";
import StudentInvoice from "../../models/StudentInvoice.ts";
import PaymentTransaction from "../../models/PaymentTransaction.ts";
import {
  fail,
  isValidObjectId,
  paystackRequest,
} from "../../utils/helperFunctions.ts";

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const key = process.env.PAYSTACK_SECRET_KEY;

type InitializePaymentInput = {
  studentId: string;
  invoiceId: string;
  amountKobo?: number;
};

type PaystackInitializeResponse = {
  authorization_url: string;
  access_code: string;
  reference: string;
};

type PaystackVerifyResponse = {
  id: number;
  status: string;
  reference: string;
  amount: number;
  currency: string;
  paid_at?: string | null;
  gateway_response?: string | null;
};

export const initializeInvoicePayment = async ({
  studentId,
  invoiceId,
  amountKobo,
}: InitializePaymentInput) => {
  if (!isValidObjectId(studentId) || !isValidObjectId(invoiceId)) {
    fail("Invalid student or invoice ID.");
  }

  const [student, invoice] = await Promise.all([
    User.findById(studentId).select("email firstName lastName"),

    StudentInvoice.findOne({
      _id: invoiceId,
      studentId,
    }),
  ]);

  if (!student) fail("Student account not found.", 404);
  if (!student?.email) fail("Your account has no email address.");

  if (!invoice) fail("Invoice not found.", 404);

  if (["DRAFT", "CANCELLED", "PAID"].includes(invoice.status)) {
    fail("This invoice is not available for payment.");
  }

  if (invoice.outstandingBalance <= 0) {
    fail("This invoice has no outstanding balance.");
  }

  const amount =
    amountKobo === undefined ? invoice.outstandingBalance : amountKobo;

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    fail("Payment amount must be a positive whole number of kobo.");
  }

  if (amount > invoice.outstandingBalance) {
    fail("Payment amount exceeds the outstanding balance.");
  }

  if (!invoice.allowInstallments && amount !== invoice.outstandingBalance) {
    fail("This invoice requires full payment.");
  }

  // Do not create another checkout while an earlier attempt
  // for this invoice is still awaiting confirmation.
  const existingPending = await PaymentTransaction.findOne({
    studentId,
    invoiceIds: invoice._id,
    provider: "PAYSTACK",
    status: "PENDING",
  }).select("_id reference amount authorizationUrl accessCode");

  if (existingPending) {
    if (existingPending.amount === amount && existingPending.authorizationUrl) {
      return {
        reference: existingPending.reference,
        authorizationUrl: existingPending.authorizationUrl,
        accessCode: existingPending.accessCode,
        amountKobo: existingPending.amount,
        currency: "NGN",
        reused: true,
      };
    }

    fail(
      "A payment attempt is already pending for this invoice. Verify it before starting another.",
      409,
    );
  }

  const reference = `EDU-${randomUUID()}`;

  // Save a local record before calling Paystack. If the request
  // times out, the reference can still be checked later.
  const transaction = await PaymentTransaction.create({
    studentId,
    invoiceIds: [invoice._id],
    reference,
    provider: "PAYSTACK",
    status: "PENDING",
    amount,
    currency: "NGN",
    description: `Payment for invoice ${invoice.invoiceNumber}`,
  });

  try {
    const callbackUrl = process.env.PAYSTACK_CALLBACK_URL;

    const gatewayResponse = await paystackRequest<PaystackInitializeResponse>(
      "/transaction/initialize",
      PAYSTACK_BASE_URL,
      key,
      {
        method: "POST",
        body: JSON.stringify({
          email: student?.email,
          amount: String(amount),
          currency: "NGN",
          reference,
          ...(callbackUrl ? { callback_url: callbackUrl } : {}),
          metadata: {
            transactionReference: reference,
            invoiceId: String(invoice._id),
            studentId: String(student?._id),
          },
        }),
      },
    );

    transaction.authorizationUrl = gatewayResponse.authorization_url;
    transaction.accessCode = gatewayResponse.access_code;

    await transaction.save();

    return {
      reference,
      authorizationUrl: gatewayResponse.authorization_url,
      accessCode: gatewayResponse.access_code,
      amountKobo: amount,
      currency: "NGN",
      reused: false,
    };
  } catch (error) {
    // A network failure may happen after Paystack received the
    // request. Do not mark it FAILED without verifying the reference.
    throw Object.assign(
      new Error(
        "Could not initialize payment. Check the transaction status before retrying.",
      ),
      { statusCode: 502, reference },
    );
  }
};

export const verifyAndApplyPayment = async (
  reference: string,
  studentId?: string,
) => {
  if (
    typeof reference !== "string" ||
    !/^[A-Za-z0-9.= -]{1,100}$/.test(reference)
  ) {
    fail("Invalid payment reference.");
  }

  const transactionQuery: Record<string, unknown> = { reference };

  if (studentId) {
    transactionQuery.studentId = studentId;
  }

  const transaction = await PaymentTransaction.findOne(transactionQuery);

  if (!transaction) fail("Payment transaction not found.", 404);

  // Idempotency: a payment already applied must never be applied again.
  if (transaction.status === "SUCCESS") {
    return {
      reference: transaction.reference,
      status: "SUCCESS",
      alreadyProcessed: true,
    };
  }

  if (transaction.provider !== "PAYSTACK") {
    fail("This transaction does not use Paystack.");
  }

  if (transaction.invoiceIds.length !== 1) {
    fail("Unexpected invoice allocation for this transaction.", 409);
  }

  const gatewayData = await paystackRequest<PaystackVerifyResponse>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    PAYSTACK_BASE_URL,
    key,
    { method: "GET" },
  );

  if (gatewayData.reference !== transaction.reference) {
    fail("Payment reference does not match.", 409);
  }

  if (
    gatewayData.amount !== transaction.amount ||
    gatewayData.currency !== transaction.currency
  ) {
    fail("Payment amount or currency does not match.", 409);
  }

  if (gatewayData.status !== "success") {
    // Do not treat pending, ongoing, abandoned, or failed gateway
    // states as a successful payment.
    if (["failed", "abandoned"].includes(gatewayData.status)) {
      await PaymentTransaction.updateOne(
        { _id: transaction._id, status: "PENDING" },
        {
          $set: {
            status: gatewayData.status === "failed" ? "FAILED" : "ABANDONED",
            failureReason: gatewayData.gateway_response || gatewayData.status,
          },
        },
      );
    }

    return {
      reference: transaction.reference,
      status: gatewayData.status.toUpperCase(),
      alreadyProcessed: false,
    };
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const currentTransaction = await PaymentTransaction.findById(
        transaction._id,
      ).session(session);

      if (!currentTransaction) {
        fail("Payment transaction not found.", 404);
      }

      // Another verification request or webhook may have finished first.
      if (currentTransaction.status === "SUCCESS") return;

      if (currentTransaction.status !== "PENDING") {
        fail("This transaction is no longer pending.", 409);
      }

      const invoice = await StudentInvoice.findOne({
        _id: currentTransaction.invoiceIds[0],
        studentId: currentTransaction.studentId,
      }).session(session);

      if (!invoice) fail("Invoice not found.", 404);

      if (invoice.status === "CANCELLED" || invoice.status === "DRAFT") {
        fail("This invoice cannot receive payment.", 409);
      }

      if (invoice.outstandingBalance < currentTransaction.amount) {
        fail(
          "Invoice balance changed. Payment requires financial review.",
          409,
        );
      }

      // UPDATE INVOICE FIELDS
      invoice.amountPaid += currentTransaction.amount;
      invoice.outstandingBalance -= currentTransaction.amount;

      if (invoice.outstandingBalance === 0) {
        invoice.status = "PAID";
      } else if (invoice.dueDate < new Date()) {
        invoice.status = "OVERDUE";
      } else {
        invoice.status = "PARTIALLY_PAID";
      }

      await invoice.save({ session });
      // UPDATE INVOICE FIELDS

      // UPDATE TRANSACTION FIELDS
      currentTransaction.status = "SUCCESS";
      currentTransaction.providerTransactionId = String(gatewayData.id);
      currentTransaction.paidAt = gatewayData.paid_at
        ? new Date(gatewayData.paid_at)
        : new Date();

      await currentTransaction.save({ session });
      // UPDATE TRANSACTION FIELDS
    });
  } finally {
    await session.endSession();
  }

  const updatedTransaction = await PaymentTransaction.findById(
    transaction._id,
  ).select("reference status amount currency paidAt");

  return {
    reference: updatedTransaction?.reference,
    status: updatedTransaction?.status,
    amountKobo: updatedTransaction?.amount,
    currency: updatedTransaction?.currency,
    paidAt: updatedTransaction?.paidAt,
    alreadyProcessed: false,
  };
};
