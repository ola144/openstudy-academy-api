import type { Request, Response, NextFunction } from "express";
import * as lessonService from "../../services/curriculum/lesson.ts";

export type AuthenticatedRequest = Request & {
  user: {
    id: string;
    role: string;
  };
};

export const createLesson = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const lesson = await lessonService.createLesson(req.body, req.user.id);

    res.status(201).json({
      success: true,
      message: "Lesson created successfully!",
      data: lesson,
    });
  } catch (error) {
    next(error);
  }
};

export const getLessons = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const publishedOnly = req.user?.role === "STUDENT";

    const result = await lessonService.getLessons({
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 10,
      topicId: req.query.topicId as string,
      search: req.query.search as string,
      status: publishedOnly ? undefined : (req.query.status as string),
      publishedOnly,
    });

    res.status(200).json({
      success: true,
      message: "Lessons fetched successfully!",
      data: result.formattedData,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

export const getLesson = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const lesson = await lessonService.getLessonById(req.params.id);

    res.status(200).json({
      success: true,
      message: "Lesson fetched successfully!",
      data: lesson,
    });
  } catch (error) {
    next(error);
  }
};

export const updateLesson = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const lesson = await lessonService.updateLesson(req.params.id, req.body);

    res.status(200).json({
      success: true,
      message: "Draft lesson updated successfully",
      data: lesson,
    });
  } catch (error) {
    next(error);
  }
};

export const publishLesson = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const lesson = await lessonService.publishLesson(req.params.id);

    res.status(200).json({
      success: true,
      message: "Lesson published successfully",
      data: lesson,
    });
  } catch (error) {
    next(error);
  }
};

export const unpublishLesson = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const lesson = await lessonService.unpublishLesson(req.params.id);

    res.status(200).json({
      success: true,
      message: "Lesson unpublished successfully",
      data: lesson,
    });
  } catch (error) {
    next(error);
  }
};
