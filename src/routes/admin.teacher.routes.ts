import express from "express";
import { protect } from "../middleware/auth.ts";
import { authorize } from "../middleware/role.ts";
import { UserRole } from "../models/User.ts";
import {
  createTeacherSchema,
  updateTeacherSchema,
} from "../validators/teacher.ts";
import { validate } from "../middleware/validate.ts";
import {
  createTeacher,
  updateTeacher,
  getTeachers,
  getTeacherById,
  updateTeacherStatus,
} from "../controllers/admin/teacherController.ts";

const router = express.Router();

router.use(protect, authorize(UserRole.ADMIN));

router.post("/", validate(createTeacherSchema), createTeacher);
router.patch("/:id", validate(updateTeacherSchema), updateTeacher);
router.get("/", getTeachers);
router.get("/:id", getTeacherById);
router.patch("/update-status/:id", updateTeacherStatus);

export default router;
