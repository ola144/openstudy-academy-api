import dotenv from "dotenv";
dotenv.config();

import app from "./app.ts";
import { startOverdueInvoiceJob } from "./jobs/overdueInvoiceJob.ts";
import connectDB from "./config/db.ts";
import { startPayrollReconciliationJob } from "./jobs/payrollReconcilliation.ts";

const PORT = process.env.PORT || 7070;

const startServer = async () => {
  try {
    await connectDB();

    // Run once on startup to catch overdue invoices
    // missed while the server was offline.
    const { syncOverdueInvoices } =
      await import("./services/payment/overdueInvoice.ts");

    await syncOverdueInvoices();

    // Continue with you existing server setup
    startOverdueInvoiceJob();

    startPayrollReconciliationJob();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
