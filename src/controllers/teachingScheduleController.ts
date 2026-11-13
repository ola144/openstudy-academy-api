import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

import TeachingSchedule from "../models/TeachingSchedule.ts";
import User from "../models/User.ts";
import Subject from "../models/Subject.ts";
import Topic from "../models/Topic.ts";
import type { AuthenticatedRequest } from "../utils/auth.type.ts";

const { Types } = mongoose;

const validId = (id: unknown): id is string =>
  typeof id === "string" && Types.ObjectId.isValid(id);

const validTime = (time: unknown): time is string =>
  typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);

const validDate = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));

const overlaps = (startA: string, endA: string, startB: string, endB: string) =>
  startA < endB && startB < endA;

const referenceWithId = (value: any) => {
  if (!value) return null;

  const plain =
    typeof value.toObject === "function"
      ? value.toObject({ transform: false })
      : value;

  return {
    ...plain,
    id: String(plain._id ?? plain.id),
  };
};

export const validateAssignment = async (
  teacherId: string,
  classId: string,
  subjectId: string,
  topicId?: string,
) => {
  const teacher = await User.findOne({
    _id: teacherId,
    role: "TEACHER",
  }).select("_id assignedSubjectIds assignedSubjects");

  if (!teacher) {
    throw Object.assign(new Error("The selected teacher does not exist."), {
      statusCode: 404,
    });
  }

  const subject = await Subject.findOne({
    _id: subjectId,
    classId,
    isActive: { $ne: false },
  }).select("_id classId");

  if (!subject) {
    throw Object.assign(
      new Error(
        "The subject does not belong to the selected class or is inactive.",
      ),
      { statusCode: 403 },
    );
  }

  // Supports either of the two common assignment field names.
  const assignedIds = (
    (teacher as any).assignedSubjectIds ??
    (teacher as any).assignedSubjects ??
    []
  ).map((id: any) => id.toString());

  if (!assignedIds.includes(subjectId)) {
    throw Object.assign(
      new Error("The teacher is not assigned to this subject."),
      { statusCode: 403 },
    );
  }

  if (topicId) {
    const topic = await Topic.findOne({
      _id: topicId,
      subjectId,
      classId,
      isActive: { $ne: false },
    }).select("_id");

    if (!topic) {
      throw Object.assign(
        new Error(
          "The topic does not belong to the selected subject and class.",
        ),
        { statusCode: 403 },
      );
    }
  }

  return null;
};

const findScheduleConflict = async (
  teacherId: string,
  classId: string,
  date: Date,
  startTime: string,
  endTime: string,
  excludeId?: string,
) => {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const query: any = {
    date: { $gte: dayStart, $lte: dayEnd },
    status: "SCHEDULED",
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    $or: [{ teacherId }, { classId }],
  };

  const existingSchedules = await TeachingSchedule.find(query).select(
    "teacherId classId startTime endTime",
  );

  for (const schedule of existingSchedules) {
    if (overlaps(startTime, endTime, schedule.startTime, schedule.endTime)) {
      if (schedule.teacherId.toString() === teacherId) {
        throw Object.assign(
          new Error(
            "This teacher already has a scheduled lesson during that time.",
          ),
          { statusCode: 409 },
        );
      }

      if (schedule.classId.toString() === classId) {
        throw Object.assign(
          new Error(
            "This class already has a scheduled lesson during that time.",
          ),
          { statusCode: 409 },
        );
      }
    }
  }

  return null;
};

// ADMIN: Create a schedule.
export const createSchedule = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      title,
      teacherId,
      classId,
      subjectId,
      topicId,
      date,
      startTime,
      endTime,
      notes,
    } = req.body;

    if (
      !title?.trim() ||
      !validId(teacherId) ||
      !validId(classId) ||
      !validId(subjectId) ||
      !validDate(date) ||
      !validTime(startTime) ||
      !validTime(endTime)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Provide valid title, teacher, class, subject, date and times.",
      });
    }

    if (endTime <= startTime) {
      return res.status(400).json({
        success: false,
        message: "End time must be later than start time.",
      });
    }

    if (topicId && !validId(topicId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid topic ID.",
      });
    }

    const assignmentError = await validateAssignment(
      teacherId,
      classId,
      subjectId,
      topicId,
    );

    if (assignmentError) {
      return res.status(400).json({
        success: false,
        message: assignmentError,
      });
    }

    const scheduleDate = new Date(date);
    const conflict = await findScheduleConflict(
      teacherId,
      classId,
      scheduleDate,
      startTime,
      endTime,
    );

    if (conflict) {
      return res.status(409).json({
        success: false,
        message: conflict,
      });
    }

    const schedule = await TeachingSchedule.create({
      title: title.trim(),
      teacherId,
      classId,
      subjectId,
      ...(topicId ? { topicId } : {}),
      date: scheduleDate,
      startTime,
      endTime,
      notes,
      createdBy: req.user!.id,
    });

    return res.status(201).json({
      success: true,
      message: "Teaching schedule created successfully.",
      data: schedule,
    });
  } catch (error) {
    next(error);
  }
};

// ADMIN: Get all schedules, optionally filtered.
export const getAllSchedules = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { teacherId, classId, subjectId, status, from, to } = req.query;

    const filter: any = {};

    for (const [key, value] of Object.entries({
      teacherId,
      classId,
      subjectId,
    })) {
      if (value) {
        if (!validId(value)) {
          return res.status(400).json({
            success: false,
            message: `Invalid ${key}.`,
          });
        }
        filter[key] = value;
      }
    }

    if (status) filter.status = status;

    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(String(from));
      if (to) filter.date.$lte = new Date(String(to));
    }

    const schedulesQuery = await TeachingSchedule.find(filter)
      .populate("teacherId", "firstName lastName email")
      .populate("classId", "name level")
      .populate("subjectId", "name")
      .populate("topicId", "title")
      .sort({ date: 1, startTime: 1 });

    const schedules = schedulesQuery.map((schedule) => {
      const scheduleObj = schedule.toObject();

      const { classId, subjectId, topicId, teacherId, ...scheduleRest } =
        scheduleObj;

      return {
        class: referenceWithId(schedule.classId),
        subject: referenceWithId(schedule.subjectId),
        teacher: referenceWithId(schedule.teacherId),
        topic: referenceWithId(schedule.topicId),
        ...scheduleRest,
        id: schedule._id.toString(),
      };
    });

    return res.status(200).json({
      success: true,
      count: schedules.length,
      data: schedules,
    });
  } catch (error) {
    next(error);
  }
};

// ADMIN: Update a schedule.
export const updateSchedule = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid schedule ID.",
      });
    }

    const current = await TeachingSchedule.findById(id);

    if (!current) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found.",
      });
    }

    const body = req.body;

    const teacherId = body.teacherId ?? current.teacherId.toString();
    const classId = body.classId ?? current.classId.toString();
    const subjectId = body.subjectId ?? current.subjectId.toString();
    const topicId =
      body.topicId === undefined
        ? current.topicId?.toString()
        : body.topicId || undefined;
    const date = body.date === undefined ? current.date : new Date(body.date);
    const startTime = body.startTime ?? current.startTime;
    const endTime = body.endTime ?? current.endTime;

    if (
      !validId(teacherId) ||
      !validId(classId) ||
      !validId(subjectId) ||
      (topicId && !validId(topicId)) ||
      Number.isNaN(new Date(date).getTime()) ||
      !validTime(startTime) ||
      !validTime(endTime) ||
      endTime <= startTime
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid schedule details.",
      });
    }

    if (
      body.status &&
      !["SCHEDULED", "COMPLETED", "CANCELLED"].includes(body.status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid schedule status.",
      });
    }

    const assignmentError = await validateAssignment(
      teacherId,
      classId,
      subjectId,
      topicId,
    );

    if (assignmentError) {
      return res.status(400).json({
        success: false,
        message: assignmentError,
      });
    }

    if ((body.status ?? current.status) === "SCHEDULED") {
      const conflict = await findScheduleConflict(
        teacherId,
        classId,
        new Date(date),
        startTime,
        endTime,
        id,
      );

      if (conflict) {
        return res.status(409).json({
          success: false,
          message: conflict,
        });
      }
    }

    current.set({
      title: body.title ?? current.title,
      teacherId,
      classId,
      subjectId,
      topicId,
      date,
      startTime,
      endTime,
      notes: body.notes ?? current.notes,
      status: body.status ?? current.status,
    });

    await current.save();

    return res.status(200).json({
      success: true,
      message: "Schedule updated successfully.",
      data: current,
    });
  } catch (error) {
    next(error);
  }
};

// ADMIN: Cancel a schedule without deleting its history.
export const cancelSchedule = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid schedule ID.",
      });
    }

    const schedule = await TeachingSchedule.findByIdAndUpdate(
      id,
      { $set: { status: "CANCELLED" } },
      { new: true, runValidators: true },
    );

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Schedule cancelled successfully.",
      data: schedule,
    });
  } catch (error) {
    next(error);
  }
};

// TEACHER: View only their own timetable.
export const getTeacherSchedules = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { from, to, status } = req.query;

    const filter: any = { teacherId: req.user!.id };

    if (status) filter.status = status;

    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(String(from));
      if (to) filter.date.$lte = new Date(String(to));
    }

    const schedulesQuery = await TeachingSchedule.find(filter)
      .populate("classId", "name level")
      .populate("subjectId", "name")
      .populate("topicId", "title")
      .sort({ date: 1, startTime: 1 });

    const schedules = schedulesQuery.map((schedule) => {
      const scheduleObj = schedule.toObject();

      const { classId, subjectId, topicId, ...scheduleRest } = scheduleObj;

      return {
        class: referenceWithId(schedule.classId),
        subject: referenceWithId(schedule.subjectId),
        topic: referenceWithId(schedule.topicId),
        ...scheduleRest,
        id: schedule._id.toString(),
      };
    });

    return res.status(200).json({
      success: true,
      count: schedules.length,
      data: schedules,
    });
  } catch (error) {
    next(error);
  }
};

// STUDENT: View timetable for their current class.
export const getStudentSchedules = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const student = await User.findOne({
      _id: req.user!.id,
      role: "STUDENT",
    }).select("classId");

    if (!student?.classId) {
      return res.status(400).json({
        success: false,
        message: "Please select your current class in your profile.",
      });
    }

    const { from, to, status } = req.query;

    const filter: any = { classId: student.classId };

    // Students normally should see scheduled lessons, not cancelled ones.
    filter.status = status === "COMPLETED" ? "COMPLETED" : "SCHEDULED";

    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(String(from));
      if (to) filter.date.$lte = new Date(String(to));
    }

    const schedulesQuery = await TeachingSchedule.find(filter)
      .populate("teacherId", "firstName lastName")
      .populate("subjectId", "name")
      .populate("topicId", "title")
      .sort({ date: 1, startTime: 1 });

    const schedules = schedulesQuery.map((schedule) => {
      const scheduleObj = schedule.toObject();

      const { subjectId, topicId, teacherId, ...scheduleRest } = scheduleObj;

      return {
        subject: referenceWithId(schedule.subjectId),
        teacher: referenceWithId(schedule.teacherId),
        topic: referenceWithId(schedule.topicId),
        ...scheduleRest,
        id: schedule._id.toString(),
      };
    });

    return res.status(200).json({
      success: true,
      count: schedules.length,
      data: schedules,
    });
  } catch (error) {
    next(error);
  }
};
