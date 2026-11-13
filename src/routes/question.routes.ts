import express from "express";
import { protect } from "../middleware/auth.ts";
import {
  createQuestion,
  getQuestionById,
  getQuestions,
  updateQuestion,
  updateQuestionStatus,
} from "../controllers/questionController.ts";
import { authorize } from "../middleware/role.ts";
import { UserRole } from "../models/User.ts";

const router = express.Router();

router.use(protect);

router.post("/", authorize(UserRole.TEACHER), createQuestion);
router.patch("/:id", authorize(UserRole.TEACHER), updateQuestion);
router.get("/", getQuestions);
router.get("/:id", getQuestionById);
router.patch(
  "/update-status/:id",
  authorize(UserRole.TEACHER),
  updateQuestionStatus,
);

export default router;
