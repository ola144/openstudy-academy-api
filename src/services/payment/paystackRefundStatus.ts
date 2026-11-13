import dotenv from "dotenv";
dotenv.config();

import { fail } from "../../utils/helperFunctions.ts";
import StudentInvoice from "../../models/StudentInvoice.ts";
import Refund, { RefundStatus } from "../../models/Refund.ts";
import PaymentTransaction, {
  TransactionStatus,
} from "../../models/PaymentTransaction.ts";
import mongoose from "mongoose";

type RefundProviderStatus =
  | "pending"
  | "processing"
  | "needs-attention"
  | "processed"
  | "failed";

const statusMap: Record<string, string> = {
  pending: RefundStatus.PENDING,
  processing: RefundStatus.PROCESSING,
  "needs-attention": RefundStatus.NEEDS_ATTENTION,
  processed: RefundStatus.PROCESSED,
  failed: RefundStatus.FAILED,
};

const activeRefundStatuses = [
  RefundStatus.INITIATING,
  RefundStatus.PENDING,
  RefundStatus.PROCESSING,
  RefundStatus.NEEDS_ATTENTION,
];

interface ApplyRefundStatusParams {
  refundReference: string;
  status: RefundProviderStatus;
  paystackRefundId?: number;
  amount?: number;
  currency?: string;
  failureReason?: string;
}

export const applyRefundStatus = async ({
  refundReference,
  status,
  paystackRefundId,
  amount,
  currency,
  failureReason,
}: ApplyRefundStatusParams) => {
  const newStatus = statusMap[status];

  if (!newStatus) {
    fail(`Unsupported Paystack refund status: ${status}`);
  }

  const session = await mongoose.startSession();

  try {
    let result: {
      updated: boolean;
      status: string;
    } | null = null;

    await session.withTransaction(async () => {
      const refund = await Refund.findOne({
        refundReference,
      }).session(session);

      if (!refund) {
        return fail(`Refund not found: ${refundReference}`, 404);
      }

      // Verify the webhook/API data against our own record.
      if (amount !== undefined && refund.amount !== amount) {
        fail("Refund amount does not match our database");
      }

      if (
        currency &&
        refund.currency.toUpperCase() !== currency.toUpperCase()
      ) {
        fail("Refund currency does not match our database");
      }

      // A final state must never be overwritten by an older event.
      if (
        refund.status === RefundStatus.PROCESSED ||
        refund.status === RefundStatus.FAILED
      ) {
        result = {
          updated: false,
          status: refund.status,
        };
        return;
      }

      const update: Record<string, unknown> = {
        status: newStatus,
        lastPaystackStatus: status,
        lastReconciledAt: new Date(),
      };

      if (paystackRefundId !== undefined) {
        update.paystackRefundId = paystackRefundId;
      }

      if (failureReason) {
        update.failureReason = failureReason;
      }

      if (status === "processed") {
        update.processedAt = new Date();
      }

      // Conditional update prevents duplicate finalization.
      const updatedRefund = await Refund.findOneAndUpdate(
        {
          _id: refund._id,
          status: { $in: activeRefundStatuses },
        },
        { $set: update },
        {
          returnDocument: "after",
          session,
        },
      );

      if (!updatedRefund) {
        result = {
          updated: false,
          status: refund.status,
        };
        return;
      }

      if (status === "processed") {
        const invoiceUpdate = await StudentInvoice.updateOne(
          {
            _id: refund.invoiceId,
            refundPendingAmount: { $gte: refund.amount },
            amountPaid: { $gte: refund.amount },
          },
          {
            $inc: {
              refundedAmount: refund.amount,
              refundPendingAmount: -refund.amount,
              amountPaid: -refund.amount,
              outstandingBalance: refund.amount,
            },
          },
          { session },
        );

        if (invoiceUpdate.modifiedCount !== 1) {
          fail("Could not update invoice balances for processed refund");
        }

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
      }

      if (status === "failed") {
        const invoiceUpdate = await StudentInvoice.updateOne(
          {
            _id: refund.invoiceId,
            refundPendingAmount: { $gte: refund.amount },
          },
          {
            $inc: {
              refundPendingAmount: -refund.amount,
            },
          },
          { session },
        );

        if (invoiceUpdate.modifiedCount !== 1) {
          fail("Could not release the pending invoice refund amount");
        }
      }

      result = {
        updated: true,
        status: newStatus,
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
};
