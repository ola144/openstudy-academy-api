import EvaluationAttempt, {
  AttemptStatus,
} from "../models/EvaluationAttempt.ts";

export const startOfDay = (date: Date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

export const endOfDay = (date: Date) => {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
};

const now = new Date();
export const todayStart = startOfDay(now);
export const todayEnd = endOfDay(now);

export const latestProgress = async (studentIds: any) => {
  // Recent activity per student.
  return await EvaluationAttempt.aggregate([
    {
      $match: {
        studentId: { $in: studentIds },
        status: AttemptStatus.GRADED,
        gradedAt: { $exists: true, $ne: null },
      },
    },
    { $sort: { gradedAt: -1 } },
    {
      $group: {
        _id: "$studentId",
        lastActivityAt: { $first: "$gradedAt" },
      },
    },
  ]);
};

export const studentsToChekIn = (
  students: any,
  activityMap: Map<string, Date>,
  pendingReviewStudentIds: any,
) => {
  return (students as any[])
    .map((student) => {
      const lastActivity = activityMap.get(student._id.toString());

      const daysSinceActivity = lastActivity
        ? Math.floor(
            (todayStart.getTime() - startOfDay(lastActivity).getTime()) /
              (24 * 60 * 60 * 1000),
          )
        : null;

      const reasons: string[] = [];

      if (daysSinceActivity === null || daysSinceActivity >= 5) {
        reasons.push("No recent learning activity");
      }

      if (pendingReviewStudentIds.has(student._id.toString())) {
        reasons.push("Needs evaluation review");
      }

      // Recent enrollment: within the past 7 days.
      const joinedRecently =
        student.createdAt &&
        new Date(student.createdAt).getTime() >=
          todayStart.getTime() - 7 * 24 * 60 * 60 * 1000;

      if (joinedRecently) {
        reasons.push("Recently joined");
      }

      return {
        studentId: student._id,
        name: `${student.firstName} ${student.lastName}`,
        email: student.email,
        className: student.classId?.name ?? "Unassigned",
        lastActivityAt: lastActivity ?? null,
        daysSinceActivity,
        reasons,
      };
    })
    .filter((student) => student.reasons.length > 0)
    .sort((a, b) => {
      // Prioritize students needing evaluation review.
      const aNeedsReview = a.reasons.includes("Needs evaluation review");
      const bNeedsReview = b.reasons.includes("Needs evaluation review");

      if (aNeedsReview !== bNeedsReview) {
        return aNeedsReview ? -1 : 1;
      }

      return (
        (b.daysSinceActivity ?? Number.MAX_SAFE_INTEGER) -
        (a.daysSinceActivity ?? Number.MAX_SAFE_INTEGER)
      );
    })
    .slice(0, 10);
};
