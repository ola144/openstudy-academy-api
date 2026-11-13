import { Router } from "express";
import { protect } from "../../middleware/auth.ts";
import { authorize } from "../../middleware/role.ts";
import { getAllBanks } from "../../controllers/payment/paystackBankController.ts";

const router = Router();

router.use(protect, authorize("ADMIN", "TEACHER"));

router.get("/", getAllBanks);

export default router;
