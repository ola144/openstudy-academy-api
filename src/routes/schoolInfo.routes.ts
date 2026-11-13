import express from "express";
import { protect } from "../middleware/auth.ts";
import {
  createSchoolInfo,
  getSchoolInfo,
  updateSchoolInfo,
  uploadSchoolLogo,
} from "../controllers/admin/schoolInfoController.ts";
import { authorize } from "../middleware/role.ts";
import { UserRole } from "../models/User.ts";

const router = express.Router();

router.get("/", getSchoolInfo);

router.use(protect);

router.post("/", authorize(UserRole.ADMIN), createSchoolInfo);
router.patch("/:id", authorize(UserRole.ADMIN), updateSchoolInfo);
router.patch("/:id/upload-logo", authorize(UserRole.ADMIN), uploadSchoolLogo);

export default router;
