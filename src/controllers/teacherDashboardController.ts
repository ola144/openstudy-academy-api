import type { Request, Response, NextFunction } from "express";

import User, { UserRole } from "../models/User.ts";
import Subject from "../models/Subject.ts";
import Topic from "../models/Topic.ts";
import Evaluation from "../models/Evaluation.ts";
import EvaluationAttempt, {
  AttemptStatus,
} from "../models/EvaluationAttempt.ts";
import type { AuthenticatedRequest } from "../utils/auth.type.ts";
import mongoose, { Types } from "mongoose";
import {
  latestProgress,
  studentsToChekIn,
} from "../utils/studentsToCheckIn.ts";

export const getTeacherDashboard = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const teacherId = req.user?.id;

    const teacher = await User.findById(teacherId).select(
      "_id firstName lastName assignedSubjectIds",
    );

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found!",
      });
    }

    const teacherObj = teacher?.toObject();

    const subjectIds = (teacherObj.assignedSubjectIds ?? []).map(
      (id: mongoose.Types.ObjectId | string) => new Types.ObjectId(id),
    );

    const [
      assignedSubjects,
      evaluations,
      // schedules
    ] = await Promise.all([
      Subject.find({
        _id: { $in: subjectIds },
        isActive: { $ne: false },
      })
        .select("_id name slug classId")
        .populate("classId", "name level"),

      Evaluation.find({
        subjectId: { $in: subjectIds },
        createdBy: teacher._id,
      }).select("_id title subjectId classId status"),

      //     TeachingSchedule.find({
      //     teacherId: teacher._id,
      //     date: { $gte: todayStart, $lte: todayEnd },
      //   })
      //     .populate("subjectId", "name")
      //     .populate("classId", "name level")
      //     .sort({ startTime: 1 })
    ]);

    const classIds = [
      ...new Set(
        assignedSubjects
          .map((subject) => subject.classId?._id.toString())
          .filter(Boolean),
      ),
    ].map((id) => new Types.ObjectId(id));

    const students = await User.find({
      role: UserRole.STUDENT,
      classId: { $in: classIds },
    })
      .select("_id firstName lastName email classId createdAt")
      .populate("classId", "name level")
      .lean();

    const studentIds = students.map((student) => student._id);

    const term =
      typeof req.query.term === "string" ? req.query.term : undefined;

    const matchingTopics = await Topic.find({
      subjectId: { $in: subjectIds },
      isActive: { $ne: false },
    })
      .select("_id subjectId term")
      .populate({
        path: "subjectId",
        select: "classId",
      })
      .lean();

    const topics = term
      ? matchingTopics.filter((topic) => String(topic.term) === term)
      : matchingTopics;

    // Per-student completion records, not Topic.isComplete.
    const gradedAttempts = await EvaluationAttempt.find({
      studentId: { $in: studentIds },
      status: AttemptStatus.GRADED,
    })
      .select("studentId evaluationId gradedAt")
      .populate({
        path: "evaluationId",
        select: "topicId",
      })
      .lean();

    // Map each student to the unique topics with graded evaluations.
    const completedByStudent = new Map<string, Set<string>>();

    for (const attempt of gradedAttempts as any[]) {
      const studentId = attempt.studentId?.toString();
      const topicId = attempt.evaluationId?.topicId?.toString();

      // Ignore attempts without a linked topic.
      if (!studentId || !topicId) continue;

      if (!completedByStudent.has(studentId)) {
        completedByStudent.set(studentId, new Set<string>());
      }

      // Set prevents multiple attempts for the same topic
      // from being counted more than once.
      completedByStudent.get(studentId)!.add(topicId);
    }

    // Build a set of topic IDs for each class.
    const topicIdsByClass = new Map<string, Set<string>>();

    for (const topic of topics as any[]) {
      const classId = topic?.subjectId.classId?.toString();

      // Skip topics whose subject or class is missing
      if (!classId) continue;

      if (!topicIdsByClass.has(classId)) {
        topicIdsByClass.set(classId, new Set<string>());
      }

      topicIdsByClass.get(classId)!.add(topic._id.toString());
    }

    // Derive the total number of topics from the sets.
    const totalTopicsByClass = new Map<string, number>();

    for (const [classId, topicIds] of topicIdsByClass) {
      totalTopicsByClass.set(classId, topicIds.size);
    }

    // Group students by class and calculate class completion.
    const classProgressMap = new Map<string, any>();

    for (const student of students as any[]) {
      const classId = student.classId?._id?.toString();

      if (!classId) continue;

      if (!classProgressMap.has(classId)) {
        classProgressMap.set(classId, {
          classId,
          className: student.classId.name,
          level: student.classId.level,
          students: [],
        });
      }

      const classTopicIds = topicIdsByClass.get(classId) ?? new Set<string>();

      const completedTopicIds =
        completedByStudent.get(student._id.toString()) ?? new Set<string>();

      const completedCount = [...completedTopicIds].filter((topicId) =>
        classTopicIds.has(topicId),
      ).length;

      const totalTopics = totalTopicsByClass.get(classId) ?? 0;

      classProgressMap.get(classId).students.push({
        studentId: student._id,
        name: `${student.firstName} ${student.lastName}`,
        completedTopics: completedCount,
        totalTopics,
        progressPercentage:
          totalTopics > 0
            ? Math.min(100, Math.round((completedCount / totalTopics) * 100))
            : 0,
      });
    }

    const classProgress = [...classProgressMap.values()].map((classItem) => {
      const classStudents = classItem.students;
      const studentCount = classStudents.length;

      const progressPercentage = studentCount
        ? Math.round(
            classStudents.reduce(
              (sum: number, student: any) => sum + student.progressPercentage,
              0,
            ) / studentCount,
          )
        : 0;

      return {
        classId: classItem.classId,
        className: classItem.className,
        level: classItem.level,
        studentCount,
        // Average of individual student completion percentages.
        progressPercentage,
      };
    });

    const activityMap = new Map<string, Date>();

    for (const activity of await latestProgress(studentIds)) {
      activityMap.set(activity._id.toString(), activity.lastActivityAt);
    }

    // Find submitted evaluations requiring manual grading.
    const evaluationIds = evaluations.map((evaluation: any) => evaluation._id);

    const pendingReviews = await EvaluationAttempt.find({
      evaluationId: { $in: evaluationIds },
      status: { $in: ["SUBMITTED", "EXPIRED"] },
      needsManualGrading: true,
    })
      .select("_id studentId evaluationId submittedAt")
      .populate("studentId", "firstName lastName email")
      .populate("evaluationId", "title")
      .sort({ submittedAt: -1 })
      .lean();

    const pendingReviewStudentIds = new Set(
      (pendingReviews as any[])
        .map((attempt) => attempt.studentId?._id?.toString())
        .filter(Boolean),
    );

    const studentsToCheckIn = studentsToChekIn(
      students,
      activityMap,
      pendingReviewStudentIds,
    );

    return res.status(200).json({
      success: true,
      message: "Teacher dashboard retrieved successfully.",
      data: {
        teacher: {
          id: teacher._id,
          name: `${teacher.firstName} ${teacher.lastName}`,
        },

        summary: {
          totalStudents: students.length,
          totalSubjects: assignedSubjects.length,
          totalClasses: classIds.length,
          totalEvaluations: evaluations.length,
          submissionsToReview: pendingReviews.length,
        },

        classProgress,

        // agenda: schedules.map((schedule: any) => ({
        //   id: schedule._id,
        //   title: schedule.title,
        //   type: schedule.type,
        //   startTime: schedule.startTime,
        //   endTime: schedule.endTime,
        //   subject: schedule.subjectId?.name ?? null,
        //   className: schedule.classId?.name ?? null,
        // })),

        studentsToCheckIn,

        pendingReviews: pendingReviews.slice(0, 10).map((attempt: any) => ({
          attemptId: attempt._id,
          student: attempt.studentId
            ? {
                id: attempt.studentId._id,
                name: `${attempt.studentId.firstName} ${attempt.studentId.lastName}`,
                email: attempt.studentId.email,
              }
            : null,
          evaluation: attempt.evaluationId
            ? {
                id: attempt.evaluationId._id,
                title: attempt.evaluationId.title,
              }
            : null,
          submittedAt: attempt.submittedAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};
