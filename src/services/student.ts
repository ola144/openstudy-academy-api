import User, { UserRole } from "../models/User.ts";

interface IUpdateStudentInput {
  firstName?: string;
  lastName?: string;
  classId?: string;
}

export const getStudents = async ({
  page = 1,
  limit = 10,
  search,
  classId,
  classIds,
}: {
  page?: number;
  limit?: number;
  search?: string;
  classId?: string;
  classIds?: string[];
}) => {
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {
    role: UserRole.STUDENT,
  };

  if (classId) {
    filter.classId = classId;
  } else if (classIds) {
    filter.classId = { $in: classIds };
  }

  if (search) {
    filter.$or = [
      {
        firstName: {
          $regex: search,
          $options: "i",
        },
      },
      {
        lastName: {
          $regex: search,
          $options: "i",
        },
      },
      {
        email: {
          $regex: search,
          $options: "i",
        },
      },
    ];
  }

  const [queryStudents, total] = await Promise.all([
    User.find(filter)
      .select(
        "firstName lastName email classId isActive isEmailVerified createdAt profilePic",
      )
      .populate("classId", "name level")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),

    User.countDocuments(filter),
  ]);

  const students = queryStudents.map((s) => {
    const studentObj = s.toObject();

    const { classId, ...studentData } = studentObj;

    return {
      ...studentData,
      class: classId ?? null,
    };
  });

  return {
    students,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getStudentById = async (studentId: string | string[]) => {
  const queryStudent = await User.findOne({
    _id: studentId,
    role: UserRole.STUDENT,
  })
    .select(
      "firstName lastName email classId isActive isEmailVerified createdAt updatedAt profilePic lastLoginAt",
    )
    .populate("classId", "name level");

  if (!queryStudent) {
    throw new Error("Student not found");
  }

  const studentObj = queryStudent.toObject();

  const { classId, ...studentData } = studentObj;

  const student = {
    ...studentData,
    class: classId ?? null,
  };

  return student;
};

export const updateStudent = async (
  studentId: string | string[],
  data: IUpdateStudentInput,
) => {
  const student = await User.findOne({
    _id: studentId,
    role: UserRole.STUDENT,
  });

  if (!student) {
    throw new Error("Student not found");
  }

  if (data.firstName !== undefined) {
    student.firstName = data.firstName;
  }

  if (data.lastName !== undefined) {
    student.lastName = data.lastName;
  }

  if (data.classId !== undefined) {
    student.classId = data.classId as any;
  }

  await student.save();

  return student;
};

export const updateStudentStatus = async (
  studentId: string | string[],
  isActive: boolean,
) => {
  const student = await User.findOneAndUpdate(
    {
      _id: studentId,
      role: UserRole.STUDENT,
    },
    {
      $set: {
        isActive,
      },
    },
    {
      new: true,
    },
  );

  if (!student) {
    throw new Error("Student not found");
  }

  return student;
};
