import { Router } from "express";

import {
  createInvoice,
  generateInvoicesForClass,
  getInvoices,
  getInvoiceDetails,
  updateInvoiceDraft,
  cancelInvoice,
  createInvoiceDraft,
  issueInvoicesForClass,
  issueInvoice,
  unissuedInvoice,
  refundStudentInvoice,
} from "../../controllers/payment/adminInvoiceController.ts";

import { protect } from "../../middleware/auth.ts";
import { authorize } from "../../middleware/role.ts";
import { UserRole } from "../../utils/auth.type.ts";

const router = Router();

router.use(protect, authorize(UserRole.ADMIN));

router.post("/", createInvoice);
router.post("/drafts", createInvoiceDraft);
router.post("/generate-class", generateInvoicesForClass);

router.get("/", getInvoices);
router.get("/:id", getInvoiceDetails);

router.patch("/:id", updateInvoiceDraft);
router.patch("/:id/cancel", cancelInvoice);

router.post("/issue-class", issueInvoicesForClass);
router.post("/:id/issued", issueInvoice);
router.post("/:id/unissued", unissuedInvoice);

router.post("/:invoiceId/refund", refundStudentInvoice);

export default router;

//I recommend a payment allocation ledger and a MongoDB transaction for reserving both invoice and payment balances.
