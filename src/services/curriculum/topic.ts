import Subject from "../../models/Subject.ts";
import Topic from "../../models/Topic.ts";
import { createSlug } from "../../utils/createSlug.ts";
import { fail } from "../../utils/helperFunctions.ts";

export const createTopic = async (
  data: {
    title: string;
    subjectId: string;
    term?: "FIRST" | "SECOND" | "THIRD";
    description?: string;
    order?: number;
  },
  userId: string,
) => {
  const subject = await Subject.findOne({
    _id: data.subjectId,
    isActive: true,
  });

  if (!subject) {
    fail("Active subject not found", 404);
  }

  const slug = createSlug(data.title);

  if (await Topic.exists({ subjectId: data.subjectId, slug })) {
    fail("Topic already exists in this subject", 409);
  }

  return Topic.create({
    ...data,
    slug,
    createdBy: userId,
  });
};

export const getTopics = async (query: {
  page?: number;
  limit?: number;
  subjectId?: string;
  classId?: string;
  search?: string;
  includeInactive?: boolean;
  term?: string;
}) => {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 10));

  const filter: Record<string, unknown> = {};

  if (query.classId) {
    const subjectIds = await Subject.find({
      classId: query.classId,
      isActive: true,
    }).distinct("_id");
    filter.subjectId = query.subjectId
      ? { $in: subjectIds, $eq: query.subjectId }
      : { $in: subjectIds };
  } else if (query.subjectId) {
    filter.subjectId = query.subjectId;
  }
  if (query.search?.trim()) {
    filter.title = {
      $regex: query.search,
      $options: "i",
    };
  }

  if (!query.includeInactive) filter.isActive = true;

  if (query.term?.trim()) filter.term = query.term;

  const [queryData, total] = await Promise.all([
    Topic.find(filter)
      .populate([{ path: "subjectId", select: "name level" }])
      .sort({ order: 1, title: 1 })
      .skip((page - 1) * limit)
      .limit(limit),

    Topic.countDocuments(filter),
  ]);

  const data = queryData.map((d) => {
    const topicObj = d.toObject();

    const { subjectId, ...topicData } = topicObj;

    return {
      ...topicData,
      subject: subjectId ?? null,
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

export const getAssignedTeacherTopics = async (
  assignedSubjectIds: string[],
  query: {
    page?: number;
    limit?: number;
    subjectId?: string;
    search?: string;
    term: string;
  },
) => {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 10));

  const subjectFilter: Record<string, unknown> = {
    $in: assignedSubjectIds,
  };
  if (query.subjectId) subjectFilter.$eq = query.subjectId;

  const filter: Record<string, unknown> = {
    subjectId: subjectFilter,
    isActive: true,
  };

  if (query.search?.trim()) {
    filter.title = {
      $regex: query.search.trim(),
      $options: "i",
    };
  }

  if (query.term.trim()) {
    filter.term = query.term;
  }

  const [queryData, total] = await Promise.all([
    Topic.find(filter)
      .populate([{ path: "subjectId", select: "name level classId" }])
      .sort({ subjectId: 1, order: 1, title: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Topic.countDocuments(filter),
  ]);

  const data = queryData.map((d) => {
    const topicObj = d.toObject();

    const { subjectId, ...topicData } = topicObj;

    return {
      ...topicData,
      subject: subjectId ?? null,
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

export const getTopicById = async (id: string | string[], classId?: string) => {
  const queryTopic = await Topic.findById(id).populate({
    path: "subjectId",
    select: "name classId",
    populate: { path: "classId", select: "name level" },
  });
  if (!queryTopic) {
    throw Object.assign(new Error("Topic not found"), {
      statusCode: 404,
    });
  }

  if (
    classId &&
    !(await Subject.exists({
      _id: queryTopic.subjectId,
      classId,
      isActive: true,
    }))
  ) {
    fail("Topic not found", 404);
  }

  const topicObj = queryTopic.toObject();

  const { subjectId, ...topicData } = topicObj;
  const { classId: topicClassId, ...subjectData } = (subjectId ??
    {}) as unknown as Record<string, unknown>;

  const topic = {
    ...topicData,
    subject: subjectId
      ? {
          ...subjectData,
          class: topicClassId,
        }
      : null,
  };

  return topic;
};

export const updateTopic = async (
  id: string | string[],
  data: Record<string, unknown>,
) => {
  const updates = { ...data };

  if (typeof updates.title === "string") {
    updates.slug = createSlug(updates.title);
  }

  const topic = await Topic.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true, runValidators: true },
  );

  if (!topic) {
    fail("Topic not found", 404);
  }

  return topic;
};

export const markTopicAsComplete = async (id: string | string[]) => {
  const topic = await Topic.findByIdAndUpdate(
    { _id: id },
    {
      isComplete: true,
      completedAt: new Date(),
    },
  );

  if (!topic) {
    fail("Topic not found", 404);
  }
  return topic;
};
