import express from "express";
import { protect } from "../../middleware/auth.ts";
import { validate } from "../../middleware/validate.ts";
import { authorize } from "../../middleware/role.ts";
import { UserRole } from "../../models/User.ts";
import {
  getTopics,
  getAssignedTeacherTopics,
  getTopic,
  createTopic,
  updateTopic,
  markTopicAsComplete,
} from "../../controllers/curriculum/topic.ts";
import {
  createTopicSchema,
  topicIdSchema,
  updateTopicSchema,
} from "../../validators/curriculum/topic.ts";

const router = express.Router();

router.use(protect);

router.get("/assigned", authorize(UserRole.TEACHER), getAssignedTeacherTopics);
router.get("/", getTopics);
router.get("/:id", validate(topicIdSchema, "params"), getTopic);
router.post(
  "/",
  authorize(UserRole.ADMIN),
  validate(createTopicSchema),
  createTopic,
);
router.patch(
  "/:id",
  authorize(UserRole.ADMIN),
  validate(updateTopicSchema),
  updateTopic,
);
router.patch(
  "/mark-as-completed/:id",
  authorize(UserRole.STUDENT),
  markTopicAsComplete,
);

export default router;
