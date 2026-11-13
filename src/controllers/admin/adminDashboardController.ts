import User, { UserRole } from "../../models/User.ts";
import Class from "../../models/Class.ts";
import Subject from "../../models/Subject.ts";
import Lesson, { LessonStatus } from "../../models/Lesson.ts";
import type { Request, Response, NextFunction } from "express";
import { fail } from "../../utils/helperFunctions.ts";
import {
  type EnrollmentPeriod,
  getStudentEnrollmentActivity,
} from "../../services/adminDashboardEnrollment.ts";

export const getAdminDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const now = new Date();

    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Student enrollment activity
    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);

    const getPart = (type: string) =>
      Number(parts.find((part) => part.type === type)!.value);

    const today = new Date(
      Date.UTC(getPart("year"), getPart("month") - 1, getPart("day")),
    );

    const daySinceMonday = (today.getUTCDay() + 6) % 7;
    today.setUTCDate(today.getUTCDate() - daySinceMonday);

    const startOfWeek = new Date(today.getTime() - 60 * 60 * 1000);
    const startOfNextWeek = new Date(
      startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000,
    );
    const startOfLastWeek = new Date(
      startOfWeek.getTime() - 7 * 24 * 60 * 60 * 1000,
    );

    const [
      studentsThisMonth,
      studentsLastMonth,
      studentsThisWeek,
      studentsLastWeek,
      teachersJoinedThisMonth,
      recentStudents,
      totalStudents,
      totalTeachers,
      activeTeachers,
      classes,
      classesLevel,
      subjectsCount,
      activeSubjectsCount,
      publishedLessonCount,
      draftLessonCount,
      // studentEnrollementActivity,
    ] = await Promise.all([
      // Monthly Students
      User.countDocuments({
        role: UserRole.STUDENT,
        createdAt: {
          $gte: startOfThisMonth,
          $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        },
      }),
      User.countDocuments({
        role: UserRole.STUDENT,
        createdAt: {
          $gte: startOfLastMonth,
          $lt: startOfThisMonth,
        },
      }),
      // Weekly Students
      User.countDocuments({
        role: UserRole.STUDENT,
        createdAt: {
          $gte: startOfWeek,
          $lt: startOfNextWeek,
        },
      }),
      User.countDocuments({
        role: UserRole.STUDENT,
        createdAt: {
          $gte: startOfLastWeek,
          $lt: startOfWeek,
        },
      }),
      // Teachers joined this month
      User.countDocuments({
        role: UserRole.TEACHER,
        createdAt: {
          $gte: startOfThisMonth,
          $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        },
      }),
      // Recent students
      User.find({
        role: UserRole.STUDENT,
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("classId"),
      User.countDocuments({ role: UserRole.STUDENT }),
      User.countDocuments({ role: UserRole.TEACHER }),
      User.countDocuments({ role: UserRole.TEACHER, isActive: true }),
      // classes
      Class.countDocuments(),
      // Classes level
      Class.distinct("level"),
      // Subjects Count
      Subject.countDocuments(),
      // Active Subjects
      Subject.countDocuments({ isActive: true }),
      //  Published Lessons
      Lesson.countDocuments({ status: LessonStatus.PUBLISHED }),
      // Draft lessons
      Lesson.countDocuments({ status: LessonStatus.DRAFT }),
      // Student Errollment Aggregation
      // User.aggregate([
      //   {
      //     $match: {
      //       role: UserRole.STUDENT,
      //       createdAt: {
      //         $gte: startOfWeek,
      //         $lt: startOfNextWeek,
      //       },
      //     },
      //   },
      //   {
      //     $group: {
      //       _id: {
      //         $dayOfWeek: {
      //           date: "$createdAt",
      //           timezone: "Africa/Lagos",
      //         },
      //       },
      //       value: { $sum: 1 },
      //     },
      //   },
      // ]),
    ]);

    const studentDifference = studentsThisMonth - studentsLastMonth;
    const studentWeekDifference = studentsThisWeek - studentsLastWeek;

    const studentPercentageChange =
      studentsLastMonth === 0
        ? 0
        : Number((studentDifference / studentsLastMonth) * 100).toFixed(2);

    const studentWeeklyPercentageChange =
      studentsLastWeek === 0
        ? 0
        : Number((studentWeekDifference / studentsLastWeek) * 100).toFixed(2);

    // const dayMap = [
    //   { day: "Mon", mongoDay: 2, value: 0 },
    //   { day: "Tue", mongoDay: 3, value: 0 },
    //   { day: "Wed", mongoDay: 4, value: 0 },
    //   { day: "Thu", mongoDay: 5, value: 0 },
    //   { day: "Fri", mongoDay: 6, value: 0 },
    //   { day: "Sat", mongoDay: 7, value: 0 },
    //   { day: "Sun", mongoDay: 1, value: 0 },
    // ];

    // studentEnrollementActivity.forEach((result) => {
    //   const day = dayMap.find((item) => item.mongoDay === result._id);

    //   if (day) day.value = result.value;
    // });

    const averageClassSize =
      classes > 0 ? Number(totalStudents / classes).toFixed(2) : 0;

    const recentStudentData = recentStudents.map((d) => {
      const studentObj = d.toObject();

      const { classId, ...studentData } = studentObj;

      return {
        ...studentData,
        class: classId ?? null,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        summary: {
          student: {
            totalStudents,
            studentDifference,
            studentPercentageChange,
            studentWeeklyPercentageChange,
            weeklyTrend: studentWeekDifference > 0 ? "increase" : "decrease",
            trend:
              studentDifference > 0
                ? "increase"
                : studentDifference < 0
                  ? "decrease"
                  : "no_change",
          },
          teacher: {
            totalTeachers,
            activeTeachers,
            teachersJoinedThisMonth,
          },
          class: {
            totalClasses: classes,
            totalClassLevel: classesLevel.length,
            averageClassSize,
          },
          subject: {
            totalSubjects: subjectsCount,
            activeSubjects: activeSubjectsCount,
          },
          lesson: {
            publishedLesson: publishedLessonCount,
            draftLesson: draftLessonCount,
          },
        },
        // entrollmentActivity: dayMap.map(({ day, value }) => ({ day, value })),
        recentStudents: recentStudentData.slice(0, 5),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getEnrollmentActivity = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const period = String(req.query.period || "weekly");

    const allowedPeriods = ["weekly", "twoWeeks", "monthly", "twoMonths"];

    if (!allowedPeriods.includes(period)) {
      fail("Invalid enrollment period.");
    }

    const result = await getStudentEnrollmentActivity(
      period as EnrollmentPeriod,
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};
