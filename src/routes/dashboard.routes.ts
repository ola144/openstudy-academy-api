import express from "express";
import { protect } from "../middleware/auth.ts";
import { getStudentDashboard } from "../controllers/studentDashboardController.ts";
import {
  getAdminDashboard,
  getEnrollmentActivity,
} from "../controllers/admin/adminDashboardController.ts";
import { getTeacherDashboard } from "../controllers/teacherDashboardController.ts";
import { authorize } from "../middleware/role.ts";
import { UserRole } from "../utils/auth.type.ts";

const router = express.Router();

router.use(protect);

router.get("/student", authorize(UserRole.STUDENT), getStudentDashboard);
router.get("/admin", authorize(UserRole.ADMIN), getAdminDashboard);
router.get(
  "/admin/enrollment-activity",
  authorize("ADMIN"),
  getEnrollmentActivity,
);
router.get("/teacher", authorize(UserRole.TEACHER), getTeacherDashboard);

export default router;
