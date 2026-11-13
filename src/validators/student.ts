import { z } from "zod";

export const updateStudentSchema = z.object({
  firstName: z.string().trim().min(2).max(50).optional(),

  lastName: z.string().trim().min(2).max(50).optional(),

  classId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
});

export const studentStatusSchema = z.object({
  isActive: z.boolean(),
});
