import type { Request, Response, NextFunction } from "express";
import * as topicService from "../../services/curriculum/topic.ts";

export type AuthenticatedRequest = Request & {
  user: {
    id: string;
  };
};

export const createTopic = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const topic = await topicService.createTopic(req.body, req.user.id);

    res.status(201).json({
      success: true,
      message: "Topic created successfully!",
      data: topic,
    });
  } catch (error) {
    next(error);
  }
};

export const getTopics = async (
  req: Request & {
    user?: { role?: string; classId?: { toString(): string } };
  },
  res: Response,
  next: NextFunction,
) => {
  try {
    if (req.user?.role === "STUDENT" && !req.user.classId) {
      throw Object.assign(
        new Error("A class must be assigned to your student account."),
        { statusCode: 403 },
      );
    }
    const result = await topicService.getTopics({
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 10,
      subjectId: req.query.subjectId as string,
      classId:
        req.user?.role === "STUDENT" ? req.user.classId?.toString() : undefined,
      search: req.query.search as string,
      includeInactive: req.query.includeInactive === "true",
      term: req.query.term as string,
    });

    res.status(200).json({
      success: true,
      message: "Topics fetched successfully!",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

export const getAssignedTeacherTopics = async (
  req: any,
  res: Response,
  next: NextFunction,
) => {
  try {
    const assignedSubjectIds = (req.user.assignedSubjectIds ?? []).map(
      (id: { toString: () => string }) => id.toString(),
    );
    const result = await topicService.getAssignedTeacherTopics(
      assignedSubjectIds,
      {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
        subjectId:
          typeof req.query.subjectId === "string"
            ? req.query.subjectId
            : undefined,
        search:
          typeof req.query.search === "string" ? req.query.search : undefined,
        term: typeof req.query.term === "string" ? req.query.term : undefined,
      },
    );

    return res.status(200).json({
      success: true,
      message: "Assigned topics fetched successfully!",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    return next(error);
  }
};

export const getTopic = async (
  req: Request & {
    user?: { role?: string; classId?: { toString(): string } };
  },
  res: Response,
  next: NextFunction,
) => {
  try {
    if (req.user?.role === "STUDENT" && !req.user.classId) {
      throw Object.assign(
        new Error("A class must be assigned to your student account."),
        { statusCode: 403 },
      );
    }
    const topic = await topicService.getTopicById(
      req.params.id,
      req.user?.role === "STUDENT" ? req.user.classId?.toString() : undefined,
    );

    res.status(200).json({
      success: true,
      message: "Topic fetched successfully!",
      data: topic,
    });
  } catch (error) {
    next(error);
  }
};

export const updateTopic = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const topic = await topicService.updateTopic(req.params.id, req.body);

    res.status(200).json({
      success: true,
      message: "Topic updated successfully",
      data: topic,
    });
  } catch (error) {
    next(error);
  }
};

export const markTopicAsComplete = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await topicService.markTopicAsComplete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Topic marked as completed!",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
