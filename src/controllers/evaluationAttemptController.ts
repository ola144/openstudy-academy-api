import type { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../utils/auth.type.ts";
import * as evaluationAttemptService from "../services/evaluationAttempt.ts";

export const startAttempt = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await evaluationAttemptService.startAttempt(
      req.params.evaluationId,
      req.params.classId,
      req?.user?.id,
      req.user?.classId?.toString(),
    );

    res.status(201).json({
      success: true,
      message: "Evaluation started successfully",
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
};

export const getAttempt = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await evaluationAttemptService.getAttemt(
      req.params.attemptId,
      req.user?.id,
      req.user?.role,
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const submitAttemt = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await evaluationAttemptService.submitAttempt(
      req.body,
      req?.user?.id,
      req.params.attemptId,
    );

    res.status(200).json({
      success: true,
      message: "Evaluation submitted successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getUserAttemptHistory = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await evaluationAttemptService.myAttemptHistory(
      req.user?.id,
    );

    res.status(200).json({
      success: true,
      message: "Attempt history fetched successfully!",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const manuallyGradeAttempt = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await evaluationAttemptService.manuallyGradeAttempt(
      req.user?.id,
      req.user?.role,
      req.body.answers,
      req.params.attemptId,
    );

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
};
