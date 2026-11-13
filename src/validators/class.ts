import { z } from "zod";

export const createClassSchema = z.object({
  name: z.string().trim().min(2).max(50),

  level: z.enum(["JUNIOR", "SENIOR"]),

  description: z.string().trim().max(500).optional(),

  order: z.number().int().min(0).optional(),
});

export const updateClassSchema = createClassSchema.partial();

export const classStatusSchema = z.object({
  isActive: z.boolean(),
});
