import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ID");

export const createEvaluationSchema = z.object({
  topicId: objectId,
  subjectId: objectId,
  lessonId: objectId.optional(),
  classId: objectId,
  questionIds: z.array(objectId).min(1),
  type: z.enum(["QUIZ", "TEST", "EXAM"]),
  title: z.string().trim().min(2).max(200),
  durationMinutes: z.coerce.number().int().min(1).max(300),
  passMark: z.coerce.number().min(0).max(100),
  maxAttempts: z.coerce.number().int().min(1).max(20),
  availableFrom: z.coerce.date().optional(),
  availableUntil: z.coerce.date().optional(),
  shuffleQuestions: z.boolean().optional(),
  showResultsImmediately: z.boolean().optional(),
});

export const updateEvaluationSchema = z.object({
  topicId: objectId.optional(),
  subjectId: objectId.optional(),
  lessonId: objectId.optional(),
  classId: objectId.optional(),
  questionIds: z.array(objectId).min(1).optional(),
  type: z.enum(["QUIZ", "TEST", "EXAM"]).optional(),
  title: z.string().trim().min(2).max(200).optional(),
  durationMinutes: z.coerce.number().int().min(1).max(300).optional(),
  passMark: z.coerce.number().min(0).max(100).optional(),
  maxAttempts: z.coerce.number().int().min(1).max(20).optional(),
  availableFrom: z.coerce.date().optional(),
  availableUntil: z.coerce.date().optional(),
  shuffleQuestions: z.boolean().optional(),
  showResultsImmediately: z.boolean().optional(),
});
