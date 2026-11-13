import dotenv from "dotenv";
dotenv.config();

import {
  fail,
  isValidObjectId,
  paystackRequest,
} from "../../utils/helperFunctions.ts";
import { randomUUID } from "node:crypto";

import StudentInvoice from "../../models/StudentInvoice.ts";
import PaymentTransaction, {
  TransactionStatus,
  TransactionType,
} from "../../models/PaymentTransaction.ts";
import Refund, { RefundStatus } from "../../models/Refund.ts";
import mongoose from "mongoose";

interface PaystackRefundResponse {
  status: string;
  message: string;
  transaction: {
    reference: string;
  };
  id: number;
  amount: number;
  currency: string;
  reference: string;
  expected_at?: string;
}

interface CreatePaystackRefundParams {
  transaction: string;
  amount: number;
  currency: string;
  customerNote: string;
  merchantNote: string;
  reference: string;
}

interface InitiateRefundParams {
  invoiceId: string | string[];
  amount: number;
  reason: string;
  adminId: string;
}

interface PaystackRefundData {
  id: number;
  reference: string;
  transaction: number | string;
  amount: number;
  currency: string;
  status: string;
  refunded_at?: string | null;
  expected_at?: string | null;
  reason?: string | null;
}

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const key = process.env.PAYSTACK_SECRET_KEY;

export const createPaystackRefund = async (
  params: CreatePaystackRefundParams,
) => {
  if (!key) {
    throw new Error("PAYSTACK SECRET KEY is not configured");
  }

  // console.log("[REFUND] Refund record created:", params.reference);

  // console.log("[REFUND] About to contact Paystack");

  try {
    const gatewayResponse = await paystackRequest<PaystackRefundResponse>(
      "/refund",
      PAYSTACK_BASE_URL,
      key,
      {
        method: "POST",
        body: JSON.stringify({
          transaction: params.transaction,
          amount: params.amount,
          currency: params.currency,
          customer_note: params.customerNote,
          merchant_note: params.merchantNote,
          reference: params.reference,
        }),
      },
    );

    // console.log("[REFUND] Paystack response:", gatewayResponse);

    return gatewayResponse;
  } catch (error) {
    const err = error as Error & {
      paystackCode?: string;
      paystackData?: unknown;
    };

    if (err.paystackCode === "transaction_reversed") {
      console.error(
        "Paystack reports existing refunds for this transaction.",
        err.paystackData,
      );

      // Keep the local refund reservation.
      // Reconcile existing refunds before allowing another attempt.

      throw new Error(
        "Existing refunds were detected for this payment. Please reconcile them before initiating another refund.",
      );
    }

    throw error;
  }
};

export const initiateStudentInvoiceRefund = async ({
  invoiceId,
  amount,
  reason,
  adminId,
}: InitiateRefundParams) => {
  if (!isValidObjectId(invoiceId)) {
    fail("Invalid invoice Id");
  }

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    fail("Refund amount must be a positive integer in kobo");
  }

  const invoice = await StudentInvoice.findById(invoiceId);

  if (!invoice) {
    fail("Student invoice not found", 404);
  }

  if (invoice.amountPaid <= 0) {
    fail("This invoice has no successful payment to refund");
  }

  const remainingRefundable =
    invoice.amountPaid -
    (invoice.refundedAmount ?? 0) -
    (invoice.refundPendingAmount ?? 0);

  if (amount > remainingRefundable) {
    fail(
      `Refund exceeds the remaining refundable amount of ${remainingRefundable} kobo`,
    );
  }

  // Find a successful payment associated with this invoice.
  const payment = await PaymentTransaction.findOne({
    studentId: invoice.studentId,
    invoiceIds: invoice._id,
    status: "SUCCESS",
    currency: "NGN",
  }).sort({ createdAt: -1 });

  if (!payment) {
    fail("No successful payment transaction found for this invoice");
  }

  // This implementation deliberately avoids refunding shared transactions.
  if (payment.invoiceIds.length !== 1) {
    return fail(
      "This payment covers multiple invoices. Use an invoice payment allocation ledger before refunding it.",
    );
  }

  // Calculate the amount already refunded or reserved against this payment.
  const previousRefunds = await Refund.aggregate([
    {
      $match: {
        paymentTransactionId: payment._id,
        status: {
          $in: [
            RefundStatus.INITIATING,
            RefundStatus.PENDING,
            RefundStatus.PROCESSING,
            RefundStatus.PROCESSED,
            RefundStatus.NEEDS_ATTENTION,
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" },
      },
    },
  ]);

  const alreadyRefundedOrReserved = previousRefunds[0]?.total ?? 0;

  if (alreadyRefundedOrReserved + amount > payment.amount) {
    fail("Refund amount exceeds the remaining refundable payment balance");
  }

  // Reserve the amount atomically on the invoice.
  const reservedInvoice = await StudentInvoice.findOneAndUpdate(
    {
      _id: invoice._id,
      $expr: {
        $gte: [
          {
            $subtract: [
              "$amountPaid",
              {
                $add: [
                  { $ifNull: ["$refundedAmount", 0] },
                  { $ifNull: ["$refundedPendingAmount", 0] },
                ],
              },
            ],
          },
          amount,
        ],
      },
    },
    {
      $inc: { refundPendingAmount: amount },
    },
    {
      returnDocument: "after",
    },
  );

  if (!reservedInvoice) {
    fail(
      "Unable to reserve refund amount. The invoice may have another pending refund.",
    );
  }

  // Paystack accepts refund references between 8 and 64 characters.
  const refundReference = `RF-${randomUUID()}`;

  let refund;

  try {
    refund = await Refund.create({
      invoiceId: invoice._id,
      studentId: invoice.studentId,
      paymentTransactionId: payment._id,
      paymentReference: payment.reference,
      refundReference,
      amount,
      currency: "NGN",
      reason,
      status: RefundStatus.INITIATING,
      initiatedBy: adminId,
    });
  } catch (error) {
    // No Paystack request has been made yet, so the reservation is safe to release.
    await StudentInvoice.updateOne(
      { _id: invoice._id },
      { $inc: { refundPendingAmount: -amount } },
    );

    throw error;
  }

  try {
    const paystackResponse = await createPaystackRefund({
      transaction: payment.reference,
      amount,
      currency: "NGN",
      customerNote: reason,
      merchantNote: `Student invoice refund: ${invoice._id}`,
      reference: refundReference,
    });

    const paystackRefund = paystackResponse;

    const session = await mongoose.startSession();

    refund.paystackRefundId = paystackRefund.id;

    // A successful API response means queued, not necessarily completed.
    refund.status =
      paystackRefund.status === "processed"
        ? RefundStatus.PROCESSED
        : paystackRefund.status === "failed"
          ? RefundStatus.FAILED
          : RefundStatus.PENDING;

    if (refund.status === RefundStatus.PROCESSED) {
      await StudentInvoice.updateOne(
        { _id: invoice._id },
        {
          $inc: {
            refundedAmount: amount,
            refundPendingAmount: -amount,
            amountPaid: -amount,
            outstandingBalance: amount,
          },
        },
      );

      refund.processedAt = new Date();

      // Get the original payment transaction. // Update transaction refunded
      const originalTransaction = await PaymentTransaction.findById(
        refund.paymentTransactionId,
      ).session(session);

      if (!originalTransaction) {
        return fail("Original payment transaction not found.", 404);
      }

      // Calculate the total successfully refunded amount.
      const refundSummary = await Refund.aggregate([
        {
          $match: {
            paymentTransactionId: originalTransaction._id,
            status: RefundStatus.PROCESSED,
            _id: { $ne: refund._id },
          },
        },
        {
          $group: {
            _id: null,
            totalRefunded: { $sum: "$amount" },
          },
        },
      ]).session(session);

      const previouslyRefunded = refundSummary[0]?.totalRefunded ?? 0;

      // Include the refund currently being processed.
      const totalRefunded = previouslyRefunded + refund.amount;

      const transactionStatus =
        totalRefunded >= originalTransaction.amount
          ? TransactionStatus.REFUNDED
          : TransactionStatus.PARTIALLY_REFUNDED;

      await PaymentTransaction.updateOne(
        { _id: originalTransaction._id },
        {
          $set: {
            status: transactionStatus,
          },
        },
        { session },
      );
    } else if (refund.status === RefundStatus.FAILED) {
      await StudentInvoice.updateOne(
        { _id: refund.invoiceId },
        {
          $inc: {
            refundPendingAmount: -refund.amount,
          },
        },
      );
    }

    await refund.save();

    return {
      refund,
      message: paystackResponse.message,
    };
  } catch (error) {
    /*
     * Important:
     * Do not automatically release the reservation here.
     *
     * A network timeout can happen after Paystack has received the request.
     * The refund might exist on Paystack even though your server did not
     * receive its response. Reconcile using refundReference before retrying.
     */

    throw error;
  }
};

export const fetchPaystackRefundByReference = async (
  reference: string,
): Promise<PaystackRefundData | null> => {
  if (!key) {
    fail("Paystack secret key is not configured");
  }

  const url = new URL(`/refund`, PAYSTACK_BASE_URL);

  url.searchParams.set("reference", reference);

  const response = await paystackRequest<PaystackRefundData[]>(
    `${url.pathname}${url.search}`,
    PAYSTACK_BASE_URL,
    key,
    {
      method: "GET",
    },
  );

  // console.log("[REFUND] Lookup result:", JSON.stringify(response, null, 2));

  return (
    response.find(
      (refund) => refund.reference.toLowerCase() === reference.toLowerCase(),
    ) ?? null
  );
};
