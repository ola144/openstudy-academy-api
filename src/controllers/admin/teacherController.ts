import { success } from "zod";
import * as teacherService from "../../services/admin.teacher.ts";
import type { NextFunction, Request, Response } from "express";

export const createTeacher = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const teacher = await teacherService.createTeacher(req.body);

    return res.status(201).json({
      success: true,
      message: "Teacher created and invitation email sent successfully!",
      data: teacher,
    });
  } catch (error: any) {
    next(error);
    res.status(400).json({
      success: false,
      message: error.message || "Internal server error!",
    });
  }
};

export const getTeachers = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const search = req.query.search as string;

    const result = await teacherService.getTeachers({
      page,
      limit,
      search,
    });

    return res.status(200).json({
      success: true,
      data: result.teachers,
      pagination: result.pagination,
    });
  } catch (error: any) {
    next(error);
    res.status(400).json({
      success: false,
      message: error.message || "Internal server error!",
    });
  }
};

export const getTeacherById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    const teacher = await teacherService.getTeacherById(id);

    return res.status(200).json({
      success: true,
      data: {
        ...teacher,
        hasPassword: Boolean(teacher.password),
      },
    });
  } catch (error: any) {
    next(error);
    res.status(400).json({
      success: false,
      message: error.message || "Internal server error!",
    });
  }
};

export const updateTeacher = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const teacher = await teacherService.updateTeacher(req.params.id, req.body);

    return res.status(200).json({
      success: true,
      message: "Teacher updated successfully",
      data: teacher,
    });
  } catch (error: any) {
    next(error);
    res.status(400).json({
      success: false,
      message: error.message || "Internal server error!",
    });
  }
};

export const updateTeacherStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const teacher = await teacherService.updateTeacherStatus(
      req.params.id,
      req.body.isActive,
    );

    return res.status(200).json({
      success: true,
      message: teacher.isActive
        ? "Teacher activated successfully!"
        : "Teacher deactivated successfully!",
      data: teacher,
    });
  } catch (error: any) {
    next(error);
    res.status(400).json({
      success: false,
      message: error.message || "Internal server error!",
    });
  }
};

export const resendTeacherInvitation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await teacherService.resendTeacherInvitation(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Invitation email resent successfully",
    });
  } catch (error: any) {
    next(error);
    res.status(400).json({
      success: false,
      message: error.message || "Internal server error!",
    });
  }
};
