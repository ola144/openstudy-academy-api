import type { Request, Response, NextFunction } from "express";

import * as classService from "../../services/class.ts";

export const createClass = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const schoolClass = await classService.createClass(req.body);

    return res.status(201).json({
      success: true,
      message: "Class created successfully",
      data: schoolClass,
    });
  } catch (error) {
    next(error);
  }
};

export const getClasses = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const classes = await classService.getClasses();

    return res.status(200).json({
      success: true,
      data: classes,
    });
  } catch (error) {
    next(error);
  }
};

export const updateClass = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const schoolClass = await classService.updateClass(req.params.id, req.body);

    return res.status(200).json({
      success: true,
      message: "Class updated successfully",
      data: schoolClass,
    });
  } catch (error) {
    next(error);
  }
};

export const updateClassStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const schoolClass = await classService.updateClassStatus(
      req.params.id,
      req.body.isActive,
    );

    return res.status(200).json({
      success: true,
      message: schoolClass.isActive
        ? "Class activated successfully"
        : "Class deactivated successfully",
      data: schoolClass,
    });
  } catch (error) {
    next(error);
  }
};
