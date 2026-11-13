import Refund, { RefundStatus } from "../../models/Refund.ts";
import { applyRefundStatus } from "../../services/payment/paystackRefundStatus.ts";

export type PaystackRefundEventName =
  | "refund.pending"
  | "refund.processing"
  | "refund.processed"
  | "refund.failed"
  | "refund.needs-attention";

interface PaystackRefundWebhookData {
  id?: number;
  refund_reference?: string | null;
  transaction_reference?: string;
  amount: number;
  currency: string;
  reason?: string;
}

interface ProcessPaystackRefundEventInput {
  event: PaystackRefundEventName;
  data: PaystackRefundWebhookData;
}

const eventStatusMap: Record<
  PaystackRefundEventName,
  "pending" | "processing" | "processed" | "failed" | "needs-attention"
> = {
  "refund.pending": "pending",
  "refund.processing": "processing",
  "refund.processed": "processed",
  "refund.failed": "failed",
  "refund.needs-attention": "needs-attention",
};

export const processPaystackRefundEvent = async ({
  event,
  data,
}: ProcessPaystackRefundEventInput): Promise<void> => {
  const status = eventStatusMap[event];

  if (!status) {
    return;
  }

  if (
    !data ||
    !Number.isSafeInteger(Number(data.amount)) ||
    Number(data.amount) <= 0
  ) {
    throw new Error("Invalid Paystack refund amount.");
  }

  const amount = Number(data.amount);

  let refund = null;

  // 1. Find by our unique refund reference.
  if (data.refund_reference) {
    refund = await Refund.findOne({
      refundReference: data.refund_reference,
    });
  }

  // 2. Fall back to Paystack refund ID.
  if (!refund && data.id) {
    refund = await Refund.findOne({
      paystackRefundId: data.id,
    });
  }

  // 3. Fall back to original transaction reference + amount.
  // Only use this when exactly one active refund matches.
  if (!refund && data.transaction_reference) {
    const matches = await Refund.find({
      paymentReference: data.transaction_reference,
      amount,
      status: {
        $in: [
          RefundStatus.INITIATING,
          RefundStatus.PENDING,
          RefundStatus.PROCESSING,
          RefundStatus.NEEDS_ATTENTION,
        ],
      },
    }).limit(2);

    if (matches.length === 1) {
      refund = matches[0];
    }
  }

  if (!refund) {
    console.error("Unable to match Paystack refund webhook", {
      event,
      transactionReference: data.transaction_reference,
      refundReference: data.refund_reference,
      paystackRefundId: data.id,
    });

    // Leave the refund for the reconciliation service.
    return;
  }

  // Validate that the webhook belongs to this exact refund.
  if (refund.amount !== amount || refund.currency !== data.currency) {
    throw new Error(
      `Refund amount or currency mismatch for ${refund.refundReference}`,
    );
  }

  await applyRefundStatus({
    refundReference: refund.refundReference,
    status,
    paystackRefundId: data.id,
    amount,
    currency: data.currency,
    failureReason:
      status === "failed" ? data.reason || "Refund failed" : undefined,
  });

  console.log(
    `Paystack refund event processed: ${refund.refundReference} -> ${status}`,
  );
};
