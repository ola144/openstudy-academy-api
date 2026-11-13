import dotenv from "dotenv";
dotenv.config();

import crypto from "node:crypto";
import type { Request, Response } from "express";
import { processPayrollTransferEvent } from "../../services/payment/paystackPayrollWebhook.ts";
import { processPaystackRefundEvent } from "../../services/payment/paystackRefundWebhook.ts";

export const verifyPaystackSignature = (req: Request): boolean => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const signature = req.headers["x-paystack-signature"];

  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

  if (!secret || typeof signature !== "string" || !rawBody) {
    return false;
  }

  const expected = crypto.createHmac("sha512", secret).update(rawBody).digest();

  const received = Buffer.from(signature, "hex");

  if (
    received.length !== expected.length ||
    !crypto.timingSafeEqual(received, expected)
  ) {
    return false;
  }

  return true;
};

export const paystackWebhook = async (req: Request, res: Response) => {
  try {
    // Verify the signature once for all event types.
    if (!verifyPaystackSignature(req)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Paystack webhook signature.",
      });
    }

    const { event, data } = req.body ?? {};

    if (!event || !data) {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook payload.",
      });
    }

    if (event.startsWith("transfer.")) {
      await processPayrollTransferEvent({
        event,
        reference: data.reference,
      });
    }

    switch (event) {
      // PAYROLL TRANSFER EVENTS
      case "transfer.success":
      case "transfer.failed":
      case "transfer.reversed": {
        if (typeof data.reference !== "string") {
          return res.status(400).json({
            success: false,
            message: "Invalid transfer reference.",
          });
        }

        await processPayrollTransferEvent({
          event,
          reference: data.reference,
        });

        break;
      }

      // REFUND EVENTS
      case "refund.pending":
      case "refund.processing":
      case "refund.processed":
      case "refund.failed":
      case "refund.needs-attention": {
        await processPaystackRefundEvent({
          event,
          data,
        });

        break;
      }

      default: {
        console.log("Unhandled Paystack webhook event:", event);
        break;
      }
    }

    return res.status(200).json({
      success: true,
      received: true,
    });
  } catch (error) {
    console.error("Paystack webhook error:", error);

    if (res.headersSent) return;

    return res.sendStatus(500);
  }
};
