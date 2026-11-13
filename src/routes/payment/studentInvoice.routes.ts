import { Router } from "express";

import {
  getMyInvoices,
  getMyInvoiceSummary,
  getMyInvoiceDetails,
} from "../../controllers/payment/studentInvoiceController.ts";

import { protect } from "../../middleware/auth.ts";
import { authorize } from "../../middleware/role.ts";
import { UserRole } from "../../utils/auth.type.ts";

const router = Router();

router.use(protect, authorize(UserRole.STUDENT));

router.get("/summary", getMyInvoiceSummary);
router.get("/", getMyInvoices);
router.get("/:id", getMyInvoiceDetails);

export default router;
