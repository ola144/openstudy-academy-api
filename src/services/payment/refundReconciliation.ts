import Refund, { RefundStatus } from "../../models/Refund.ts";
import { fail } from "../../utils/helperFunctions.ts";
import { applyRefundStatus } from "../../services/payment/paystackRefundStatus.ts";
import { fetchPaystackRefundByReference } from "../../services/payment/paystackRefund.ts";

const supportedStatuses = [
  "pending",
  "processing",
  "needs-attention",
  "processed",
  "failed",
] as const;

type SupportedStatus = (typeof supportedStatuses)[number];

export const reconcileRefund = async (refundId: string | string[]) => {
  const refund = await Refund.findById(refundId);

  if (!refund) {
    return fail("Refund not found", 404);
  }

  // Don't need to reconcile a refund already finalized.
  if (
    refund.status === RefundStatus.PROCESSED ||
    refund.status === RefundStatus.FAILED
  ) {
    return {
      updated: false,
      message: "Refund has already reached a final status",
      refund,
    };
  }

  const paystackRefund = await fetchPaystackRefundByReference(
    refund.refundReference,
  );

  if (!paystackRefund) {
    return fail(
      "Refund was not found on Paystack. Check its reference and environment.",
      404,
    );
  }

  if (
    paystackRefund.amount !== refund.amount ||
    paystackRefund.currency.toUpperCase() !== refund.currency.toUpperCase()
  ) {
    return fail("Paystack refund details do not match the local refund record");
  }

  if (!supportedStatuses.includes(paystackRefund.status as SupportedStatus)) {
    return fail(`Unsupported Paystack refund status: ${paystackRefund.status}`);
  }

  const result = await applyRefundStatus({
    refundReference: refund.refundReference,
    status: paystackRefund.status as SupportedStatus,
    paystackRefundId: paystackRefund.id,
    amount: paystackRefund.amount,
    currency: paystackRefund.currency,
    failureReason:
      paystackRefund.status === "failed"
        ? paystackRefund.reason || "Refund failed"
        : undefined,
  });

  const updatedRefund = await Refund.findById(refundId);

  return {
    updated:
      (result as unknown as { updated?: boolean } | null | undefined)
        ?.updated ?? false,
    message: "Refund reconciliation completed",
    paystackStatus: paystackRefund.status,
    refund: updatedRefund,
  };
};
