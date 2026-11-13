import express from "express";
import { protect } from "../../middleware/auth.ts";
import { validate } from "../../middleware/validate.ts";
import {
  createSubjectSchema,
  subjectIdSchema,
  updateSubjectSchema,
} from "../../validators/curriculum/subject.ts";
import { authorize } from "../../middleware/role.ts";
import { UserRole } from "../../models/User.ts";
import {
  createSubject,
  getSubject,
  getSubjects,
  getAssignedTeacherSubjects,
  getStudentSubjects,
  getStudentSubject,
  updateSubject,
  updateSubjectStatus,
} from "../../controllers/curriculum/subject.ts";

const router = express.Router();

router.use(protect);

router.get("/assigned", authorize(UserRole.TEACHER), getAssignedTeacherSubjects);
router.get("/student-assigned", authorize(UserRole.STUDENT), getStudentSubjects);
router.get(
  "/student-assigned/:id",
  authorize(UserRole.STUDENT),
  validate(subjectIdSchema, "params"),
  getStudentSubject,
);
router.get("/", getSubjects);
router.get("/:id", validate(subjectIdSchema, "params"), getSubject);
router.post(
  "/",
  authorize(UserRole.ADMIN),
  validate(createSubjectSchema),
  createSubject,
);
router.patch(
  "/:id",
  authorize(UserRole.ADMIN),
  validate(updateSubjectSchema),
  updateSubject,
);
router.patch(
  "/update-status/:id",
  authorize(UserRole.ADMIN),
  updateSubjectStatus,
);

export default router;
