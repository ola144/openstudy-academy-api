import express from "express";
import { protect } from "../middleware/auth.ts";
import { authorize } from "../middleware/role.ts";
import { UserRole } from "../models/User.ts";
import {
  getStudent,
  getStudents,
  updateStudentStatus,
} from "../controllers/admin/studentController.ts";
import { updateStudent } from "../controllers/userController.ts";

const router = express.Router();

router.use(protect);

router.get(
  "/",
  authorize(UserRole.ADMIN, UserRole.STUDENT, UserRole.TEACHER),
  getStudents,
);
router.get(
  "/:id",
  authorize(UserRole.ADMIN, UserRole.STUDENT, UserRole.TEACHER),
  getStudent,
);
router.patch("/:id/update-student", authorize(UserRole.ADMIN), updateStudent);
router.patch(
  "/update-status/:id",
  authorize(UserRole.ADMIN),
  updateStudentStatus,
);

export default router;
