import type { Request, Response, NextFunction } from "express";

import { type AuthenticatedRequest } from "../utils/auth.type.ts";

import Subject from "../models/Subject.ts";
import Topic from "../models/Topic.ts";
import Evaluation from "../models/Evaluation.ts";
import EvaluationAttempt from "../models/EvaluationAttempt.ts";
import { subjectWithProgress } from "../utils/subjectWithProgress.ts";

// getDayKey() converts a JavaScript Date into a string representing its calendar day.
// Example:
// const date = new Date(2026, 9, 21);

// console.log(getDayKey(date));
// "2026-9-21"
const getDayKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth()).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const calculateLearningStreak = (dates: Date[]): number => {
  if (dates.length === 0) return 0;

  // Remove duplicate calendar days
  // Normalize dates and remove duplicate learning days.
  const learningDays = new Set(dates.map((date) => getDayKey(new Date(date))));

  // Normalize today to the start of the calendar day.
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  const todayKey = getDayKey(cursor);

  const yesterday = new Date(cursor);
  yesterday.setDate(yesterday.getDate() - 1);

  const yesterdayKey = getDayKey(yesterday);

  // Find the latest learning day.
  const latestKey = [...learningDays].sort().at(-1);

  // No active streak if the latest learning day is before yesterday.
  if (latestKey !== todayKey && latestKey !== yesterdayKey) {
    return 0;
  }

  // Start from the latest learning day.
  if (latestKey === yesterdayKey) {
    cursor.setDate(cursor.getDate() - 1);
  }

  // Count consecutive days
  let streak = 0;

  while (learningDays.has(getDayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
};

export const getStudentDashboard = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const department =
      typeof req.user?.department === "string" ? req.user.department : "";

    const [subjects, evaluations, evaluationAttempts] = await Promise.all([
      Subject.find({
        classId: req.user?.classId,
        category: { $in: [department, "GENERAL"] },
        isActive: true,
      } as never),

      Evaluation.find({
        classId: req.user?.classId,
        isPublished: true,
      }).populate("subjectId", "name"),

      EvaluationAttempt.find({
        studentId: req.user?.id,
      }),
    ]);

    const subjectIds = subjects.map((subject) => subject._id);

    const term = typeof req.query.term === "string" ? req.query.term : "";

    const topics = (
      await Topic.find({
        subjectId: { $in: subjectIds },
      }).populate("subjectId", "name")
    ).filter((topic) => topic.term === term);

    const completedTopics = topics.filter((topic) => topic.isComplete);

    const learningDates = completedTopics
      .map((topic) => topic.completedAt)
      .filter((date): date is Date => date instanceof Date);

    const streak = calculateLearningStreak(learningDates);

    const subjectProgress = subjectWithProgress(topics, subjects).filter(
      (subject) => subject.completedTopics > 0,
    );

    const recentCompletedTopic = completedTopics
      .map((topic) => {
        const topicObj = topic.toObject();

        const { subjectId, ...topicRest } = topicObj;

        return {
          subject: subjectId ?? null,
          ...topicRest,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
      )
      .slice(0, 5);

    const availableEvaluation = evaluations
      .map((item) => {
        const evaluationObj = item.toObject();

        const { subjectId, ...evaluationRest } = evaluationObj;

        const attempts = evaluationAttempts.filter(
          (itemAttempt) =>
            itemAttempt.evaluationId.toString() === item._id.toString(),
        );

        const attemptsRemaining = Math.max(
          0,
          item.maxAttempts - attempts.length,
        );

        return {
          subject: subjectId,
          ...evaluationRest,
          attemptsUsed: attempts.length,
          attemptsRemaining,
          isAvailable: attemptsRemaining > 0,
        };
      })
      .filter((item) => item.isAvailable);

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalSubjects: subjectIds.length,
          totalTopics: topics.length,
          completedTopics: completedTopics.length,
          learningStreak: streak,
        },
        subjects: subjectProgress,
        recentLearning: recentCompletedTopic,
        availableEvaluation,
      },
    });
  } catch (error) {
    next(error);
  }
};
