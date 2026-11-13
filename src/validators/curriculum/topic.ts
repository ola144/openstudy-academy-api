import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ID");

export const createTopicSchema = z.object({
  title: z.string().trim().min(2).max(150),
  subjectId: objectId,
  classId: objectId,
  term: z.enum(["FIRST", "SECOND", "THIRD"]).optional(),
  description: z.string().trim().max(1000).optional(),
  order: z.coerce.number().int().min(0).optional(),
});

export const updateTopicSchema = z.object({
  title: z.string().trim().min(2).max(150).optional(),
  subjectId: objectId,
  classId: objectId,
  description: z.string().trim().max(1000).optional(),
  order: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const topicIdSchema = z.object({
  id: objectId,
});
