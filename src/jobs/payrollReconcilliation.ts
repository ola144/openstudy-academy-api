import cron from "node-cron";
import TeacherPayroll from "../models/TeacherPayroll.ts";
import { reconcilePayrollTranser } from "../services/payment/adminTeacherPayroll.ts";

let isRunning = false;

export const reconcilePendingPayrollTransfersJob = async (): Promise<void> => {
  // Prevent overlapping executions in this Node.js process
  if (isRunning) {
    console.log("Payroll reconciliation is already running.");
    return;
  }

  isRunning = true;

  try {
    // Only reconcile transfers pending for at least 10 minutes.
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    const pendingTransfers = await TeacherPayroll.find({
      transferStatus: "PENDING",
      transferInitiatedAt: {
        $lte: tenMinutesAgo,
      },
      transferReference: { $exists: true, $ne: null },
    })
      .select("_id transferReference")
      .sort({ transferInitiatedAt: 1 })
      .limit(50)
      .lean();

    if (!pendingTransfers.length) {
      console.log("No pending payroll transfers to reconcile.");
      return;
    }

    console.log(
      `Reconciling ${pendingTransfers.length} pending payroll transfers...`,
    );

    let successful = 0;
    let failed = 0;

    // Process sequentially to avoid overwhelming Paystack
    for (const payroll of pendingTransfers) {
      try {
        await reconcilePayrollTranser(payroll._id.toString());

        successful++;
      } catch (error) {
        failed++;

        console.error(`Could not reconcile payroll ${payroll._id}:`, error);

        console.log("Payroll reconciliation completed:", {
          total: pendingTransfers.length,
          successful,
          failed,
        });
      }
    }
  } catch (error) {
    console.error("Payroll reconciliation job failed:", error);
  } finally {
    isRunning = false;
  }
};

// Run every 15 minutes using Lagos time
export const startPayrollReconciliationJob = () => {
  cron.schedule(
    "*/15 * * * *",
    async () => {
      console.log("Starting scheduled payroll reconciliation...");

      await reconcilePendingPayrollTransfersJob();
    },
    {
      timezone: "Africa/Lagos",
    },
  );

  console.log("Payroll reconciliation scheduler started.");
};
