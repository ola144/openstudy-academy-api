import mongoose from "mongoose";
import User, { UserRole } from "../models/User.ts";
import Subject from "../models/Subject.ts";
import { sendInvitationEmail } from "../utils/email.ts";
import { generateRandomToken, hashToken } from "../utils/token.ts";

interface ICreateTeacherInput {
  firstName: string;
  lastName: string;
  email: string;
  assignedSubjectIds: Array<mongoose.Types.ObjectId>;
}

interface IUpdateTeacherInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  assignedSubjectIds?: Array<mongoose.Types.ObjectId>;
}

interface ICreatePasswordData {
  token: string;
  password: string;
  confirmPassword: string;
}

export const createTeacher = async (data: ICreateTeacherInput) => {
  const email = data.email.toLowerCase().trim();

  const existingTeacher = await User.findOne({ email });

  if (existingTeacher) {
    throw new Error("A user with this email already exists");
  }

  const rawToken = generateRandomToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const teacher = await User.create({
    firstName: data.firstName,
    lastName: data.lastName,
    assignedSubjectIds: data.assignedSubjectIds,
    email,
    role: UserRole.TEACHER,
    isActive: true,
    passwordSetupToken: tokenHash,
    passwordSetupExpires: expiresAt,
    isEmailVerified: true,
  });

  await sendInvitationEmail(
    email,
    `${teacher.firstName} ${teacher.lastName}`,
    rawToken,
  );

  return teacher;
};

export const getTeachers = async ({
  page = 1,
  limit = 10,
  search,
}: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {
    role: UserRole.TEACHER,
  };

  if (search?.trim()) {
    const searchTerm = search.trim();
    filter.$or = [
      {
        firstName: {
          $regex: searchTerm,
          $options: "i",
        },
        lastName: {
          $regex: searchTerm,
          $options: "i",
        },
        email: {
          $regex: searchTerm,
          $options: "i",
        },
      },
    ];
  }

  const [teachers, total] = await Promise.all([
    User.find(filter)
      .select(
        "firstName lastName email role isActive isEmailVerified lastLoginAt createdAt assignedSubjectIds profilePic",
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),

    User.countDocuments(filter),
  ]);

  return {
    teachers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getTeacherById = async (teacherId: string | string[]) => {
  const queryTeacher = await User.findOne({
    _id: teacherId,
    role: UserRole.TEACHER,
  }).select(
    "firstName lastName email role isActive isEmailVerified lastLoginAt createdAt assignedSubjectIds profilePic password",
  );

  if (!queryTeacher) {
    throw new Error("Teahcer not found");
  }

  const subjectsQuery = await Subject.find({
    _id: { $in: queryTeacher.assignedSubjectIds },
  }).populate("classId", "name level");

  const subjects = subjectsQuery.map((sub) => {
    const subjectObj = sub.toObject();

    const { classId, ...subjectRest } = subjectObj;

    return {
      class: classId,
      ...subjectRest,
    };
  });

  const teacherObj = queryTeacher.toObject();

  const teacher = {
    ...teacherObj,
    assignedSubjects: subjects,
  };

  delete (teacherObj as any).assignedSubjectIds;

  return teacher;
};

export const updateTeacher = async (
  teacherId: string | string[],
  data: IUpdateTeacherInput,
) => {
  const teacher = await User.findOne({
    _id: teacherId,
    role: UserRole.TEACHER,
  });

  if (!teacher) {
    throw new Error("Teacher not found");
  }

  //   if (data.email && data.email.toLowerCase() !== teacher.email) {
  //     const emailExists = await User.findOne({
  //       email: data.email.toLowerCase(),
  //       id: { $ne: teacherId },
  //     });

  //     if (emailExists) {
  //       throw new Error("Another user already has this email");
  //     }

  //     teacher.email = data.email.toLowerCase();
  //     teacher.isEmailVerified = false;
  //   }

  if (data.firstName !== undefined) {
    teacher.firstName = data.firstName;
  }

  if (data.lastName !== undefined) {
    teacher.lastName = data.lastName;
  }

  if (data.assignedSubjectIds?.length) {
    teacher.assignedSubjectIds = data.assignedSubjectIds;
  }

  await teacher.save();

  return teacher;
};

export const updateTeacherStatus = async (
  teacherId: string | string[],
  isActive: boolean,
) => {
  const teacher = await User.findOneAndUpdate(
    {
      _id: teacherId,
      role: UserRole.TEACHER,
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

  if (!teacher) {
    throw new Error("Teacher not found!");
  }

  return teacher;
};

export const createPassword = async (data: ICreatePasswordData) => {
  const { token, password, confirmPassword } = data;

  if (!token || !password || !confirmPassword) {
    throw Object.assign(
      new Error("Token, password and confimation are required"),
      {
        statusCode: 400,
      },
    );
  }

  if (password !== confirmPassword) {
    throw Object.assign(new Error("Passwords do not match!"), {
      statusCode: 400,
    });
  }

  if (password.length < 8) {
    throw Object.assign(new Error("Password must be at least 8 characters!"), {
      statusCode: 400,
    });
  }

  const hashedToken = hashToken(token);

  const teacher = await User.findOne({
    passwordSetupToken: hashedToken,
    passwordSetupExpires: {
      $gt: new Date(),
    },
  }).select("+passwordSetupToken +passwordSetupExpires +password");

  if (!teacher) {
    throw new Error("The password setup link is invalid or has expired!");
  }

  teacher.password = password;
  teacher.hasPassword = true;

  teacher.passwordSetupToken = null;
  teacher.passwordSetupExpires = null;

  await teacher.save();

  return teacher;
};

export const resendTeacherInvitation = async (teacherId: string | string[]) => {
  const teacher = await User.findOne({
    _id: teacherId,
    role: UserRole.TEACHER,
  });

  if (!teacher) {
    throw new Error("Teacher not found");
  }

  if (teacher.hasPassword) {
    throw new Error("Teacher already set password");
  }

  const rawToken = generateRandomToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  teacher.passwordSetupToken = tokenHash;
  teacher.passwordSetupExpires = expiresAt;

  await teacher.save();

  await sendInvitationEmail(
    teacher.email,
    `${teacher.firstName} ${teacher.lastName}`,
    rawToken,
  );

  return teacher;
};
