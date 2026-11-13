import { Router } from "express";

import { protect } from "../../middleware/auth.ts";
import { authorize } from "../../middleware/role.ts";

import {
  getMyPaymentHistory,
  getMyPaymentDetails,
  downloadMyPaymentReceipt,
} from "../../controllers/payment/studentPaymentHistoryController.ts";
import { UserRole } from "../../utils/auth.type.ts";

const router = Router();

router.use(protect, authorize(UserRole.STUDENT));

router.get("/", getMyPaymentHistory);
router.get("/:id/receipt", downloadMyPaymentReceipt);
router.get("/:id", getMyPaymentDetails);

export default router;
