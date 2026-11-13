import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ID");

const contentBlockSchema = z.object({
  type: z.enum(["HEADING", "TEXT", "IMAGE", "VIDEO", "LIST"]),
  text: z.string().trim().max(20000).optional(),
  url: z.string().url().max(2048).optional(),
  caption: z.string().trim().max(500).optional(),
  items: z.array(z.string().trim().min(1).max(2000)).max(100).optional(),
});

export const createLessonSchema = z.object({
  title: z.string().trim().min(2).max(200),
  topicId: objectId,
  summary: z.string().trim().max(2000).optional(),
  objectives: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
  content: z.array(contentBlockSchema).max(200).optional(),
  estimatedMinutes: z.coerce.number().int().min(1).max(600).optional(),
});

export const updateLessonSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  summary: z.string().trim().max(2000).optional(),
  objectives: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
  content: z.array(contentBlockSchema).max(200).optional(),
  estimatedMinutes: z.coerce.number().int().min(1).max(600).optional(),
});

export const lessonIdSchema = z.object({
  id: objectId,
});
