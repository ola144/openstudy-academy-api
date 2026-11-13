import { Router } from "express";
import { paystackWebhook } from "../../controllers/payment/paystackWebhookControler.ts";

const router = Router();

router.post("/", paystackWebhook);

export default router;
