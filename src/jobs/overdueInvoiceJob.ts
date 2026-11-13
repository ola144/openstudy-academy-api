import cron from "node-cron";
import { syncOverdueInvoices } from "../services/payment/overdueInvoice.ts";

export const startOverdueInvoiceJob = () => {
  const task = cron.schedule(
    "0 0 * * *",
    async () => {
      try {
        await syncOverdueInvoices();
      } catch (error) {
        console.error("[Overdue Invoice Job] Failed:", error);
      }
    },
    {
      timezone: "Africa/Lagos",
      noOverlap: true,
    },
  );

  console.log("Overdue invoice job scheduled for midnight Africa/Lagos.");

  return task;
};
