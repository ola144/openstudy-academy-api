import Evaluation from "../models/Evaluation.ts";
import EvaluationAttempt, {
  AttemptStatus,
} from "../models/EvaluationAttempt.ts";
import Subject from "../models/Subject.ts";
import User, { UserRole } from "../models/User.ts";
import mongoose from "mongoose";
import { fail } from "../utils/helperFunctions.ts";

export const summarize = async (
  studentId: string | undefined | string[],
  evaluationIds?: mongoose.Types.ObjectId[],
) => {
  const filter: Record<string, unknown> = {
    studentId,
    status: {
      $in: [
        AttemptStatus.GRADED,
        AttemptStatus.SUBMITTED,
        AttemptStatus.EXPIRED,
      ],
    },
  };
  if (evaluationIds) filter.evaluationId = { $in: evaluationIds };

  const attempts = await EvaluationAttempt.find(filter)
    .populate("evaluationId", "title type subjectId topicId passMark")
    .sort({ submittedAt: -1 });

  const graded = attempts.filter(
    (a) =>
      a.status === AttemptStatus.GRADED ||
      (a.status === AttemptStatus.EXPIRED && !a.needsManualGrading),
  );

  const scoreSum = graded.reduce(
    (sum: number, a: any) => sum + (a.percentage ?? 0),
    0,
  );

  const passed = graded.filter((a: any) => a.passed === true).length;

  const failed = graded.filter((a: any) => a.passed === false).length;

  const averagePercentage = graded.length
    ? Math.round((scoreSum / graded.length) * 100) / 100
    : 0;

  const pendingManualGrading = attempts.filter(
    (a: any) => a.needsManualGrading,
  ).length;

  const history = attempts.map((a: any) => ({
    attemptId: a._id,
    evaluation: a.evaluationId,
    status: a.status,
    score: a.score,
    totalMarks: a.totalMarks,
    percentage: a.percentage,
    passed: a.passed,
    needsManualGrading: a.needsManualGrading,
    startedAt: a.startedAt,
    submittedAt: a.submittedAt,
    expiresAt: a.expiresAt,
  }));

  return {
    totals: {
      attempts: attempts.length,
      gradedAttempts: graded.length,
      passed,
      failed,
      averagePercentage,
      pendingManualGrading,
    },
    history,
  };
};

export const getMyProgress = async (id: string | undefined) => {
  const progress = await summarize(id);

  return progress;
};

export const getStudentProgressForTeacher = async (
  studentId: string | string[],
  userId: string | undefined,
  role: string | undefined,
  assignedSubjectIds: string[],
) => {
  if (!userId || !mongoose.isValidObjectId(studentId)) {
    fail("A valid student is required.");
  }

  const [student] = await Promise.all([
    User.findOne({ _id: studentId, role: UserRole.STUDENT }).select("classId"),
  ]);

  if (!student?.classId) {
    fail("Student not found.", 404);
  }

  let evaluationIds;

  if (role === UserRole.TEACHER) {
    evaluationIds = await Evaluation.find({
      createdBy: userId,
      classId: student?.classId,
    }).distinct("_id");
  } else {
    evaluationIds = await Evaluation.find({
      classId: student?.classId,
    }).distinct("_id");
  }

  const progress = await summarize(studentId, evaluationIds);

  return progress;
};
