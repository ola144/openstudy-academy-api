import express from "express";
import { protect } from "../middleware/auth.ts";
import { authorize } from "../middleware/role.ts";
import { UserRole } from "../models/User.ts";
import {
  createClass,
  getClasses,
  updateClass,
  updateClassStatus,
} from "../controllers/admin/classController.ts";

const router = express.Router();

router.post("/", createClass);
router.patch("/:id", protect, authorize(UserRole.ADMIN), updateClass);
router.get("/", getClasses);
router.patch("/update-status/:id", updateClassStatus);

export default router;
