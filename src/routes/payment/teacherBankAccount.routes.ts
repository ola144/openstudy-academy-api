import { protect } from "../../middleware/auth.ts";
import { authorize } from "../../middleware/role.ts";

import {
  submitMyBankAccount,
  getTeacherBankAccount,
} from "../../controllers/payment/teacherBankAccountController.ts";
import { Router } from "express";
import { UserRole } from "../../models/User.ts";

const router = Router();

router.use(protect, authorize(UserRole.TEACHER));

router.get("/", getTeacherBankAccount);
router.post("/", submitMyBankAccount);
router.patch("/", submitMyBankAccount);

export default router;
