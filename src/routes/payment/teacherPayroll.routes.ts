import { Router } from "express";

import { protect } from "../../middleware/auth.ts";
import { authorize } from "../../middleware/role.ts";
import { UserRole } from "../../models/User.ts";
import {
  getMyPayrollHistory,
  getMyPayrollDetails,
} from "../../controllers/payment/teacherPayrollController.ts";
import { downloadMyPayslip } from "../../controllers/payment/teacherPayslipController.ts";

const router = Router();

router.use(protect, authorize(UserRole.TEACHER));

router.get("/", getMyPayrollHistory);
router.get("/:id", getMyPayrollDetails);
router.get("/:id/payslip", downloadMyPayslip);

export default router;
