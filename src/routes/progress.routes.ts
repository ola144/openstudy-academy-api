import express from "express";
import { protect } from "../middleware/auth.ts";
import { authorize } from "../middleware/role.ts";
import { UserRole } from "../models/User.ts";
import { validate } from "../middleware/validate.ts";
import { z } from "zod";
import {
  getStudentProgress,
  getStudentProgressForTeacher,
} from "../controllers/progressController.ts";

const router = express.Router();

router.use(protect);

router.get("/student-progress", getStudentProgress);
router.get(
  "/student-progress/:studentId",
  authorize(UserRole.TEACHER, UserRole.ADMIN),
  validate(
    z.object({ studentId: z.string().regex(/^[0-9a-fA-F]{24}$/) }),
    "params",
  ),
  getStudentProgressForTeacher,
);

export default router;
