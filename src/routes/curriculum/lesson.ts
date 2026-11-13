import express from "express";
import { protect } from "../../middleware/auth.ts";
import { validate } from "../../middleware/validate.ts";
import {
  createLessonSchema,
  lessonIdSchema,
  updateLessonSchema,
} from "../../validators/curriculum/lesson.ts";
import { authorize } from "../../middleware/role.ts";
import User, { UserRole } from "../../models/User.ts";
import {
  createLesson,
  getLesson,
  getLessons,
  updateLesson,
  publishLesson,
  unpublishLesson,
} from "../../controllers/curriculum/lesson.ts";

const router = express.Router();

router.use(protect);

router.get("/", getLessons);
router.get("/:id", validate(lessonIdSchema, "params"), getLesson);
router.post(
  "/",
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validate(createLessonSchema),
  createLesson,
);
router.patch(
  "/:id",
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validate(updateLessonSchema),
  updateLesson,
);
router.patch(
  "/:id/publish",
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validate(lessonIdSchema, "params"),
  publishLesson,
);
router.patch(
  "/:id/unpublish",
  authorize(UserRole.ADMIN, UserRole.TEACHER),
  validate(lessonIdSchema, "params"),
  unpublishLesson,
);

export default router;
