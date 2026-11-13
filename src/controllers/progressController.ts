import type { Response, NextFunction, Request } from "express";
import type { AuthenticatedRequest } from "../utils/auth.type.ts";
import * as progressService from "../services/progress.ts";

export const getStudentProgress = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await progressService.getMyProgress(req?.user?.id);

    res.status(200).json({
      success: true,
      message: "Student progress fetched successfully!",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getStudentProgressForTeacher = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await progressService.getStudentProgressForTeacher(
      req.params.studentId,
      req?.user?.id,
      req?.user?.role,
      (req.user?.assignedSubjectIds ?? []).map(String),
    );

    res.status(200).json({
      success: true,
      message: "Student progress fetched successfully!",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
