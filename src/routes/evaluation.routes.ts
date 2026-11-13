import express from "express";
import { protect } from "../middleware/auth.ts";
import {
  createEvaluation,
  getEvaluations,
  getStudentEvaluations,
  updateEvaluation,
  updateEvaluationStatus,
} from "../controllers/evaluationController.ts";
import { authorize } from "../middleware/role.ts";
import { UserRole } from "../models/User.ts";
import { validate } from "../middleware/validate.ts";
import {
  createEvaluationSchema,
  updateEvaluationSchema,
} from "../validators/evluation.ts";

const router = express.Router();

router.use(protect);

router.post(
  "/",
  authorize(UserRole.TEACHER),
  validate(createEvaluationSchema),
  createEvaluation,
);
router.patch(
  "/:id",
  authorize(UserRole.TEACHER),
  validate(updateEvaluationSchema),
  updateEvaluation,
);
router.get("/", authorize(UserRole.TEACHER), getEvaluations);
router.get(
  "/student-evaluation",
  authorize(UserRole.STUDENT),
  getStudentEvaluations,
);
router.patch(
  "/update-status/:id",
  authorize(UserRole.TEACHER),
  updateEvaluationStatus,
);

export default router;
