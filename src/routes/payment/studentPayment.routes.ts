import { Router } from "express";

import { protect } from "../../middleware/auth.ts";
import { authorize } from "../../middleware/role.ts";
import {
  initializePayment,
  verifyPayment,
} from "../../controllers/payment/studentPaymentController.ts";
import { UserRole } from "../../utils/auth.type.ts";

const router = Router();

router.use(protect, authorize(UserRole.STUDENT));

router.post("/initialize", initializePayment);
router.post("/verify", verifyPayment);

export default router;
