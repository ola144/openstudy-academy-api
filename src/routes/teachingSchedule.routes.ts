import express from "express";
import { protect } from "../middleware/auth.ts";
import { authorize } from "../middleware/role.ts";
import { UserRole } from "../models/User.ts";
import {
  cancelSchedule,
  createSchedule,
  getAllSchedules,
  getStudentSchedules,
  getTeacherSchedules,
  updateSchedule,
} from "../controllers/teachingScheduleController.ts";

const router = express.Router();

router.use(protect);

router.post("/", authorize(UserRole.ADMIN), createSchedule);
router.patch("/:id", authorize(UserRole.ADMIN), updateSchedule);
router.patch("/:id/cancel", authorize(UserRole.ADMIN), cancelSchedule);
router.get("/all-schedules", authorize(UserRole.ADMIN), getAllSchedules);
router.get(
  "/teacher-schedules",
  authorize(UserRole.TEACHER),
  getTeacherSchedules,
);
router.get(
  "/student-schedules",
  authorize(UserRole.STUDENT),
  getStudentSchedules,
);

export default router;
