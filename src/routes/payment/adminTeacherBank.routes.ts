import { Router } from "express";
import { protect } from "../../middleware/auth.ts";
import { authorize } from "../../middleware/role.ts";
import {
  listPayrollBanks,
  verifyTeacherBank,
  initiatePayrollTransfer,
  getPendingBankAccounts,
  rejectTeacherBank,
} from "../../controllers/payment/adminTeacherBankController.ts";
import { UserRole } from "../../utils/auth.type.ts";

const router = Router();

router.use(protect, authorize(UserRole.ADMIN));

router.get("/banks", listPayrollBanks);
router.get("/pending-account", getPendingBankAccounts);
router.patch("/teacher/:teacherId/verify", verifyTeacherBank);
router.patch("/teacher/:teacherId/reject", rejectTeacherBank);
router.post("/payroll/:id/transfer", initiatePayrollTransfer);

export default router;
