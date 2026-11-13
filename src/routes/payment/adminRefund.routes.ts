import { Router } from "express";

import {
  getAdminRefunds,
  getAdminRefundDetails,
  reconcileAdminRefund,
} from "../../controllers/payment/adminRefundController.ts";

import { protect } from "../../middleware/auth.ts";
import { authorize } from "../../middleware/role.ts";

const router = Router();

router.use(protect, authorize("ADMIN"));

// GET /api/v1/admin/refunds
router.get("/", getAdminRefunds);

// GET /api/v1/admin/refunds/:id
router.get("/:id", getAdminRefundDetails);

// POST /api/v1/admin/refunds/:id/reconcile
router.post("/:id/reconcile", reconcileAdminRefund);

export default router;
