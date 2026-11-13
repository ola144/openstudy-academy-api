import express from "express";
import { protect } from "../middleware/auth.ts";
import { authorize } from "../middleware/role.ts";
import { UserRole } from "../models/User.ts";
import {
  getAttempt,
  getUserAttemptHistory,
  manuallyGradeAttempt,
  startAttempt,
  submitAttemt,
} from "../controllers/evaluationAttemptController.ts";

const router = express.Router();

router.use(protect);

router.post(
  "/start-evaluation/:evaluationId/:classId",
  authorize(UserRole.STUDENT),
  startAttempt,
);
router.get("/attempt-history", getUserAttemptHistory);
router.get("/:attemptId", getAttempt);
router.patch("/submit-evaluation/:attemptId", submitAttemt);
router.patch(
  "/:attemptId/manual-grade",
  authorize(UserRole.TEACHER, UserRole.ADMIN),
  manuallyGradeAttempt,
);

export default router;
