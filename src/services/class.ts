import Class, { ClassLevel } from "../models/Class.ts";

export const createClass = async (data: {
  name: string;
  level: ClassLevel;
  description?: string;
  order?: number;
}) => {
  const existingClass = await Class.findOne({
    name: data.name,
  });

  if (existingClass) {
    throw new Error("A class with this name already exists");
  }

  return Class.create({
    name: data.name,
    level: data.level,
    description: data.description,
    order: data.order,
  });
};

export const getClasses = async () => {
  return Class.find().sort({
    level: 1,
    order: 1,
  });
};

export const getClassById = async (classId: string) => {
  const schoolClass = await Class.findById(classId);

  if (!schoolClass) {
    throw new Error("Class not found");
  }

  return schoolClass;
};

export const updateClass = async (
  classId: string | string[],
  data: Partial<{
    name: string;
    level: "JUNIOR" | "SENIOR";
    description: string;
    order: number;
  }>,
) => {
  const schoolClass = await Class.findByIdAndUpdate(
    classId,
    {
      $set: data,
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!schoolClass) {
    throw new Error("Class not found");
  }

  return schoolClass;
};

export const updateClassStatus = async (
  classId: string | string[],
  isActive: boolean,
) => {
  const schoolClass = await Class.findByIdAndUpdate(
    classId,
    {
      $set: {
        isActive: isActive,
      },
    },
    {
      returnDocument: "after",
    },
  );

  if (!schoolClass) {
    throw new Error("Class not found");
  }

  return schoolClass;
};
