import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../utils/auth.type.ts";
import * as questionService from "../services/questions.ts";
import { UserRole } from "../models/User.ts";

export const createQuestion = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await questionService.createQuestion(
      req.body,
      req.user?.id,
      (req.user?.assignedSubjectIds ?? []).map(String),
    );

    res.status(201).json({
      success: true,
      message: "Question created successfully!",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

export const getQuestions = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await questionService.getQuestions({
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 10,
      topicId: typeof req.query.topicId === "string" ? req.query.topicId : "",
      subjectId:
        typeof req.query.subjectId === "string" ? req.query.subjectId : "",
      lessonId:
        typeof req.query.lessonId === "string" ? req.query.lessonId : "",
      type: typeof req.query.type === "string" ? req.query.type : "",
      difficulty:
        typeof req.query.difficulty === "string" ? req.query.difficulty : "",
      search: typeof req.query.search === "string" ? req.query.search : "",
      createdBy: req.user?.role === UserRole.TEACHER ? req.user.id : undefined,
    });

    return res.status(200).json({
      success: true,
      message: "Question fetched successfully!",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    return next(error);
  }
};

export const getQuestionById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const question = await questionService.getQuestionById(
      req.params.id,
      req.user?.role === UserRole.TEACHER ? req.user.id : undefined,
    );

    res.status(200).json({
      success: true,
      message: "Question fetched successfully.",
      data: question,
    });
  } catch (error) {
    next(error);
  }
};

export const updateQuestion = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const question = await questionService.updateQuestion(
      req.params.id,
      req.body,
      req.user!.id,
    );

    res.status(200).json({
      success: true,
      message: "Question updated successfully",
      data: question,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateQuestionStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const question = await questionService.updateQuestionStatus(
      req.params.id,
      req.body.isActive,
      req.user!.id,
    );

    res.status(200).json({
      success: true,
      message: question.isActive
        ? "Question activated successfully!"
        : "Question unactivated successfully!",
      data: question,
    });
  } catch (error) {
    return next(error);
  }
};
