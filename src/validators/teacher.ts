import mongoose from "mongoose";
import { z } from "zod";

export const createTeacherSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, "First name must be a least 2 character")
    .max(50),
  lastName: z
    .string()
    .trim()
    .min(2, "Last name must be a least 2 character")
    .max(50),
  email: z.string().trim().email("Invalid email address").toLowerCase(),
  assignedSubjectIds: z.array(z.string()),
});

export const updateTeacherSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, "First name must be a least 2 character")
    .max(50)
    .optional(),
  lastName: z
    .string()
    .trim()
    .min(2, "Last name must be a least 2 character")
    .max(50)
    .optional(),
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .toLowerCase()
    .optional(),
  assignedSubjectIds: z.array(z.string()).optional(),
});

export const teacherIdSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{2A}$/, "Invalid teacher ID"),
});
