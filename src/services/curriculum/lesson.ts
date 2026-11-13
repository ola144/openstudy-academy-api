import Lesson, { ContentBlockType, LessonStatus } from "../../models/Lesson.ts";
import Topic from "../../models/Topic.ts";
import { createSlug } from "../../utils/createSlug.ts";
import { fail } from "../../utils/helperFunctions.ts";

export const createLesson = async (
  data: {
    title: string;
    topicId: string;
    summary?: string;
    objectives: string[];
    content: Array<{
      type: "HEADING" | "TEXT" | "IMAGE" | "VIDEO" | "LIST";
      text?: string;
      url?: string;
      caption?: string;
      items?: string[];
    }>;
    estimatedMinutes: number;
  },
  userId: string,
) => {
  const topic = await Topic.findOne({
    _id: data.topicId,
    isActive: true,
  });

  if (!topic) {
    fail("Active topic not found", 404);
  }

  const slug = createSlug(data.title);

  if (await Lesson.exists({ topicId: data.topicId, slug })) {
    fail("Lesson already exists in this topic", 409);
  }

  return Lesson.create({
    ...data,
    slug,
    status: LessonStatus.DRAFT,
    createdBy: userId,
  });
};

export const getLessons = async (query: {
  page?: number;
  limit?: number;
  topicId?: string;
  search?: string;
  status?: string;
  publishedOnly?: boolean;
}) => {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 10));

  const filter: Record<string, unknown> = {};

  if (query.topicId) filter.topicId = query.topicId;

  if (query.search?.trim()) {
    filter.title = {
      $regex: query.search,
      $options: "i",
    };
  }

  if (query.publishedOnly) {
    filter.status = LessonStatus.PUBLISHED;
  } else if (query.status) {
    filter.status = query.status;
  }

  const [data, total] = await Promise.all([
    Lesson.find(filter)
      .populate({
        path: "topicId",
        select: "title subjectId",
        populate: { path: "subjectId", select: "name classId" },
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Lesson.countDocuments(filter),
  ]);

  const formattedData = data.map((d) => {
    const lessonObj = d.toObject();

    const { topicId, ...lessonRest } = lessonObj;

    const { subjectId, ...topicRest } = (topicId ?? {}) as unknown as Record<
      string,
      unknown
    >;

    return {
      ...lessonRest,
      topic: topicId
        ? {
            ...topicRest,
            subject: subjectId ?? null,
          }
        : null,
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

export const getLessonById = async (id: string | string[]) => {
  const lesson = await Lesson.findById(id).populate({
    path: "topicId",
    select: "title subjectId",
    populate: { path: "subjectId", select: "name classId" },
  });

  if (!lesson) {
    fail("Lesson not found", 404);
  }

  const lessonObj = lesson!.toObject() as unknown as Record<string, unknown>;

  const { topicId, ...lessonData } = lessonObj;
  const { subjectId, ...topicData } = (topicId ?? {}) as unknown as Record<
    string,
    unknown
  >;

  const formmatedLesson = {
    ...lessonData,
    topic: topicId
      ? {
          ...topicData,
          subject: subjectId ?? null,
        }
      : null,
  };

  return formmatedLesson;
};

export const updateLesson = async (
  id: string | string[],
  data: Record<string, unknown>,
) => {
  const lesson = await Lesson.findByIdAndUpdate(
    { _id: id, status: LessonStatus.DRAFT },
    {
      $set: {
        ...data,
        ...(typeof data.title === "string"
          ? { slug: createSlug(data.title) }
          : {}),
      },
    },
    { new: true, runValidators: true },
  );

  if (!lesson) {
    throw Object.assign(
      new Error(
        "Draft lesson not found; published lessons must be unpublished before editing",
      ),
      {
        statusCode: 404,
      },
    );
  }

  return lesson;
};

export const publishLesson = async (id: string | string[]) => {
  const lesson = await Lesson.findById(id);

  if (!lesson) {
    throw Object.assign(new Error("Lesson not found"), { statusCode: 404 });
  }

  if (lesson.content.length === 0) {
    fail("Add lesson content before publishing");
  }

  lesson.status = LessonStatus.PUBLISHED;
  lesson.publishedAt = new Date();

  await lesson.save();
  return lesson;
};

export const unpublishLesson = async (id: string | string[]) => {
  const lesson = await Lesson.findByIdAndUpdate(
    id,
    {
      $set: { status: LessonStatus.DRAFT },
      $unset: { publishedAt: 1 },
    },
    { new: true, runValidators: true },
  );

  if (!lesson) {
    fail("Lesson not found", 404);
  }

  return lesson;
};
