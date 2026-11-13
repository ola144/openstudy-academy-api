import type { Request } from "express";

export const UserRole = {
  ADMIN: "ADMIN",
  TEACHER: "TEACHER",
  STUDENT: "STUDENT",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
    classId?: string;
    department?: string;
    assignedSubjectIds?: Array<string | { toString(): string }>;
  };
}
