import type { Request, Response, NextFunction } from "express";
import * as studentService from "../../services/student.ts";
import Subject from "../../models/Subject.ts";

export const getStudents = async (
  req: Request & {
    user?: {
      role?: string;
      assignedSubjectIds?: Array<{ toString(): string }>;
    };
  },
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const search =
      typeof req.query.search === "string" ? req.query.search : undefined;

    let classId =
      typeof req.query.classId === "string" ? req.query.classId : undefined;

    let classIds: string[] | undefined;

    if (req.user?.role === "TEACHER") {
      const assignedSubjectIds = (req.user.assignedSubjectIds ?? []).map((id) =>
        id.toString(),
      );

      classIds = assignedSubjectIds.length
        ? (
            await Subject.find({
              _id: { $in: assignedSubjectIds },
              isActive: true,
            }).distinct("classId")
          ).map(String)
        : [];

      classId = undefined;
    }

    const result = await studentService.getStudents({
      page,
      limit,
      search,
      classId,
      classIds,
    });

    return res.status(200).json({
      success: true,
      data: result.students,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

// export const getTeacherStudents = async (
//   req: Request & {
//     user?: {
//       role?: string;
//       assignedSubjectIds?: Array<{ toString(): string }>;
//     };
//   },
//   res: Response,
//   next: NextFunction,
// ) => {
//   try {
//     const page = Number(req.query.page) || 1;
//     const limit = Number(req.query.limit) || 20;

//     const search =
//       typeof req.query.search === "string" ? req.query.search : undefined;

//     let classId =
//       typeof req.query.classId === "string" ? req.query.classId : undefined;

//     let classIds: string[] | undefined;
//     if (req.user?.role === "TEACHER") {
//       const assignedSubjectIds = (req.user.assignedSubjectIds ?? []).map(
//         (id) => id.toString(),
//       );
//       classIds = assignedSubjectIds.length
//         ? (
//             await Subject.find({
//               _id: { $in: assignedSubjectIds },
//               isActive: true,
//             }).distinct("classId")
//           ).map(String)
//         : [];
//       classId = undefined;
//     }

//     const result = await studentService.getStudents({
//       page,
//       limit,
//       search,
//       classId,
//       classIds,
//     });

//     return res.status(200).json({
//       success: true,
//       data: result.students,
//       pagination: result.pagination,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

export const getStudent = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const student = await studentService.getStudentById(req.params.id);

    return res.status(200).json({
      success: true,
      data: student,
    });
  } catch (error) {
    next(error);
  }
};

export const updateStudent = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const student = await studentService.updateStudent(req.params.id, req.body);

    return res.status(200).json({
      success: true,
      message: "Student updated successfully",
      data: student,
    });
  } catch (error) {
    next(error);
  }
};

export const updateStudentStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const student = await studentService.updateStudentStatus(
      req.params.id,
      req.body.isActive,
    );

    return res.status(200).json({
      success: true,
      message: student.isActive
        ? "Student activated successfully"
        : "Student deactivated successfully",
      data: student,
    });
  } catch (error) {
    next(error);
  }
};
