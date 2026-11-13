import Subject from "../../models/Subject.ts";
import Class from "../../models/Class.ts";
import { createSlug } from "../../utils/createSlug.ts";
import mongoose from "mongoose";
import { fail } from "../../utils/helperFunctions.ts";

export const createSubject = async (
  data: {
    name: string;
    classId: string;
    description?: string;
    order?: number;
  },
  userId: string,
) => {
  const schoolClass = await Class.findOne({
    _id: data.classId,
    isActive: true,
  });

  if (!schoolClass) {
    fail("Active class not found", 404);
  }

  const slug = createSlug(data.name);

  const existing = await Subject.findOne({
    classId: data.classId,
    slug,
  });

  if (existing) {
    fail("This subject already exists for the class", 409);
  }

  return Subject.create({
    ...data,
    slug,
    createdBy: userId,
  });
};

export const getSjubjects = async (query: {
  page?: number;
  limit?: number;
  classId?: string;
  search?: string;
  includeInactive?: boolean;
}) => {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 10));

  const filter: Record<string, unknown> = {};

  if (query.classId) filter.classId = query.classId;
  if (!query.includeInactive) filter.isActive = true;

  if (query.search?.trim()) {
    filter.name = {
      $regex: query.search.trim(),
      $options: "i",
    };
  }

  const [data, total] = await Promise.all([
    Subject.find(filter)
      .populate("classId", "name level")
      .sort({ order: 1, name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Subject.countDocuments(filter),
  ]);

  const formattedData = data.map((d) => {
    const subject = d.toObject();

    return {
      ...subject,
      class: subject.classId,
      classId: undefined,
    };
  });

  return {
    formattedData,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getStudentSubjects = async (
  classId: string | undefined,
  query: { page?: number; limit?: number; search?: string },
  department?: string,
) => {
  if (!classId) {
    fail("A class must be assigned to your student account.", 403);
  }

  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 10));
  const filter: Record<string, unknown> = {
    classId,
    isActive: true,
  };
  if (query.search?.trim()) {
    filter.name = { $regex: query.search.trim(), $options: "i" };
  }

  if (department?.trim) {
    filter.category = { $in: ["GENERAL", department] };
  }

  const [data, total] = await Promise.all([
    Subject.find(filter)
      .populate("classId", "name level")
      .sort({ order: 1, name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Subject.countDocuments(filter),
  ]);

  const formattedData = data.map((d) => {
    const subject = d.toObject();

    return {
      ...subject,
      class: subject.classId,
      classId: undefined,
    };
  });

  return {
    formattedData,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const getStudentSubjectById = async (
  id: string | string[],
  classId: string | undefined,
) => {
  if (!classId) {
    throw Object.assign(
      new Error("A class must be assigned to your student account."),
      { statusCode: 403 },
    );
  }

  const subject = await Subject.findOne({
    _id: id,
    classId,
    isActive: true,
  }).populate("classId", "name level");

  if (!subject) {
    fail("Subject not found", 404);
  }

  const dataObj = subject?.toObject();

  const { classId: subjectClassId, ...subjectData } = dataObj ?? {};

  const formattedStubject = {
    ...subjectData,
    class: subjectClassId ?? null,
  };

  return formattedStubject;
};

export const getAssignedTeacherSubjects = async (
  assignedSubjectIds: mongoose.Types.ObjectId[],
  query: { page?: number; limit?: number; search?: string },
) => {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 10));

  const filter: Record<string, unknown> = {
    _id: { $in: assignedSubjectIds },
    isActive: true,
  };

  if (query.search?.trim()) {
    filter.name = {
      $regex: query.search.trim(),
      $options: "i",
    };
  }

  const [subjects, total] = await Promise.all([
    Subject.find(filter)
      .populate("classId", "name level")
      .sort({ order: 1, name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Subject.countDocuments(filter),
  ]);

  const data = subjects.map((d) => {
    const topicObj = d.toObject();

    const { classId, ...subjectData } = topicObj;

    return {
      ...subjectData,
      class: classId ?? null,
    };
  });

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getSubjectById = async (id: string | string[]) => {
  const subject = await Subject.findById(id).populate("classId", "name level");
  if (!subject) {
    fail("Subject not found", 404);
  }

  return subject;
};

export const updateSubject = async (
  id: string | string[],
  data: Record<string, unknown>,
) => {
  const updates = { ...data };

  if (typeof updates.name === "string") {
    updates.slug = createSlug(updates.name);
  }

  const subject = await Subject.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true, runValidators: true },
  );

  if (!subject) {
    fail("Subject not found", 404);
  }

  return subject;
};

export const updateSubjectStatus = async (
  subjectId: string | string[],
  isActive: boolean,
) => {
  const subject = await Subject.findOneAndUpdate(
    {
      _id: subjectId,
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

  if (!subject) {
    throw new Error("Subject not found!");
  }

  return subject;
};
