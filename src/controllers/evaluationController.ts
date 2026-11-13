import type { Response, NextFunction } from "express";
import * as evaluationService from "../services/evaluation.ts";
import type { AuthenticatedRequest } from "../utils/auth.type.ts";

export const createEvaluation = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const evaluation = await evaluationService.createEvaluation(
      req.body,
      req.user.id,
      (req.user.assignedSubjectIds ?? []).map(String),
    );

    res.status(201).json({
      success: true,
      message: "Evaluation created successfully!",
      data: evaluation,
    });
  } catch (error) {
    next(error);
  }
};

export const getEvaluations = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await evaluationService.getEvaluation({
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 10,
      topicId: typeof req.query.topicId === "string" ? req.query.topicId : "",
      classId: typeof req.query.classId === "string" ? req.query.classId : "",
      search:
        typeof req.query.search === "string" ? req.query.search : undefined,
      isPublished:
        req.query.status === "published"
          ? true
          : req.query.status === "draft"
            ? false
            : undefined,
      includeUnpublish: true,
      createdBy: req.user?.id,
    });

    return res.status(200).json({
      success: true,
      message: "Evaluation fetched successfully!",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    return next(error);
  }
};

export const getStudentEvaluations = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await evaluationService.getEvaluation({
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 10,
      topicId: typeof req.query.topicId === "string" ? req.query.topicId : "",
      search:
        typeof req.query.search === "string" ? req.query.search : undefined,
      includeUnpublish: false,
      classId: String(req?.user?.classId),
    });

    return res.status(200).json({
      success: true,
      message: "Evaluation fetched successfully!",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateEvaluation = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const evaluation = await evaluationService.updateEvaluation(
      req.params.id,
      req.body,
      req.user!.id,
    );

    res.status(200).json({
      success: true,
      message: "Evaluation updated successfully",
      data: evaluation,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateEvaluationStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const evaluation = await evaluationService.updateEvaluationStatus(
      req.params.id,
      req.body.isPublished,
      req.user!.id,
    );

    res.status(200).json({
      success: true,
      message: evaluation.isPublished
        ? "Evaluation published successfully!"
        : "Evaluation unpublished successfully!",
      data: evaluation,
    });
  } catch (error) {
    next(error);
  }
};
