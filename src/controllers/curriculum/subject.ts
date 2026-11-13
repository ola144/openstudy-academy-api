import type { Request, Response, NextFunction } from "express";
import * as subjectService from "../../services/curriculum/subject.ts";

export type AuthenticatedRequest = Request & {
  user: {
    id: string;
  };
};

export const createSubject = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const subject = await subjectService.createSubject(req.body, req.user.id);

    res.status(201).json({
      success: true,
      message: "Subject created successfully!",
      data: subject,
    });
  } catch (error) {
    next(error);
  }
};

export const getSubjects = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await subjectService.getSjubjects({
      page: Number(req.query.page) || 0,
      limit: Number(req.query.limit) || 10,
      classId: req.query.classId as string,
      search: req.query.search as string,
      includeInactive: req.query.includeInactive === "true",
    });

    res.status(200).json({
      success: true,
      message: "Subjects fetched successfully!",
      data: result.formattedData,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

export const getAssignedTeacherSubjects = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await subjectService.getAssignedTeacherSubjects(
      req.user.assignedSubjectIds ?? [],
      {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
        search:
          typeof req.query.search === "string" ? req.query.search : undefined,
      },
    );

    return res.status(200).json({
      success: true,
      message: "Assigned subjects fetched successfully!",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    return next(error);
  }
};

export const getStudentSubjects = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const department =
      req.user.department === "ARTS"
        ? "ARTS"
        : req.user.department === "SCIENCE"
          ? "SCIENCE"
          : req.user.department === "COMMERCIAL"
            ? "COMMERCIAL"
            : "";

    const result = await subjectService.getStudentSubjects(
      req.user.classId?.toString(),
      {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
        search:
          typeof req.query.search === "string" ? req.query.search : undefined,
      },
      department,
    );

    return res.status(200).json({
      success: true,
      message: "Student subjects fetched successfully!",
      data: result.formattedData,
      pagination: result.pagination,
    });
  } catch (error) {
    return next(error);
  }
};

export const getStudentSubject = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const subject = await subjectService.getStudentSubjectById(
      req.params.id,
      req.user.classId?.toString(),
    );

    return res.status(200).json({
      success: true,
      message: "Student subject fetched successfully!",
      data: subject,
    });
  } catch (error) {
    return next(error);
  }
};

export const getSubject = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const subject = await subjectService.getSubjectById(req.params.id);

    res.status(200).json({
      success: true,
      message: "Subject fetched successfully!",
      data: subject,
    });
  } catch (error) {
    next(error);
  }
};

export const updateSubject = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const subject = await subjectService.updateSubject(req.params.id, req.body);

    res.status(200).json({
      success: true,
      message: "Subject updated successfully",
      data: subject,
    });
  } catch (error) {
    next(error);
  }
};

export const updateSubjectStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const subject = await subjectService.updateSubjectStatus(
      req.params.id,
      req.body.isActive,
    );

    res.status(200).json({
      success: true,
      message: subject.isActive
        ? "Subject activated successfully!"
        : "Subject deactivated successfully!",
      data: subject,
    });
  } catch (error) {
    next(error);
  }
};
