import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ID");

export const createSubjectSchema = z.object({
  name: z.string().trim().min(2).max(100),
  classId: objectId,
  category: z.string(),
  description: z.string().trim().max(1000).optional(),
  order: z.coerce.number().int().min(0).optional(),
});

export const updateSubjectSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  classId: objectId,
  category: z.string(),
  description: z.string().trim().max(1000).optional(),
  order: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const subjectIdSchema = z.object({
  id: objectId,
});
