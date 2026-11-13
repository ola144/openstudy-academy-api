import { Router } from "express";

import {
  getTransactions,
  getTransactionSummary,
  getTransactionDetails,
  reviewTransaction,
} from "../../controllers/payment/adminTransactionController.ts";

import { protect } from "../../middleware/auth.ts";
import { authorize } from "../../middleware/role.ts";
import { UserRole } from "../../utils/auth.type.ts";

const router = Router();

router.use(protect, authorize(UserRole.ADMIN));

router.get("/summary", getTransactionSummary);

router.get("/", getTransactions);

router.get("/:id", getTransactionDetails);

router.patch("/:id/mark-reviewed", reviewTransaction);

export default router;
