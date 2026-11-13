import { Router } from "express";

import { protect } from "../../middleware/auth.ts";
import { authorize } from "../../middleware/role.ts";
import { UserRole } from "../../models/User.ts";
import {
  approvePayroll,
  cancelPayroll,
  createPayroll,
  finalizePayrollTransfer,
  getPayrollDetails,
  getPayrolls,
  reconcilePayrollPendingTranster,
  resendTeacherPayrollOTP,
} from "../../controllers/payment/adminTeacherPayrollController.ts";
import { getPayrollSummary } from "../../controllers/payment/adminPayrollSummaryController.ts";
import {
  approvedPayrollBatchController,
  generatePayrollBatchController,
  getBatchPayrollDetails,
  getBatchPayrolls,
  initiateBulkPayrollTranferController,
  reconcilePayrollBulkTransferController,
} from "../../controllers/payment/payrollBatch/payrollBatchController.ts";

const router = Router();

router.use(protect, authorize(UserRole.ADMIN));

router.post("/", createPayroll);
router.post("/batches", generatePayrollBatchController);

router.get("/", getPayrolls);
router.get("/batches", getBatchPayrolls);

router.get("/summary", getPayrollSummary);

router.get("/:id", getPayrollDetails);
router.get("/batches/:batchId", getBatchPayrollDetails);

router.patch("/:id/approve", approvePayroll);
router.patch("/batches/:batchId/approve", approvedPayrollBatchController);

router.patch(
  "/batches/:batchId/transfer",
  initiateBulkPayrollTranferController,
);
router.post(
  "/batches/:batchId/reconcile",
  reconcilePayrollBulkTransferController,
);

router.patch("/:id/cancel", cancelPayroll);
router.patch("/:id/authorize-transfer", finalizePayrollTransfer);
router.post("/:id/resend-otp", resendTeacherPayrollOTP);
router.post("/:id/verify", reconcilePayrollPendingTranster);

export default router;
