import Evaluation, { EvaluationType } from "../models/Evaluation.ts";
import Topic from "../models/Topic.ts";
import Question from "../models/Question.ts";
import Subject from "../models/Subject.ts";
import { createSlug } from "../utils/createSlug.ts";
import mongoose from "mongoose";

export const createEvaluation = async (
  data: {
    topicId: string;
    subjectId: string;
    lessonId?: string;
    questionIds: Array<string>;
    classId: string;
    type: EvaluationType;
    durationMinutes: number;
    passMark: number;
    maxAttempts: number;
    availableFrom?: Date;
    availableUntil?: Date;
    shuffleQuestions?: boolean;
    showResultsImmediately?: boolean;
    title: string;
  },
  userId: string,
  assignedSubjectIds: string[],
) => {
  if (
    !data.title?.trim() ||
    !Array.isArray(data.questionIds) ||
    !data.questionIds.length ||
    !mongoose.isValidObjectId(data.classId) ||
    !mongoose.isValidObjectId(data.subjectId) ||
    !assignedSubjectIds.includes(data.subjectId)
  ) {
    throw Object.assign(
      new Error("title, questionIds, classId and subjectId are required."),
      { statusCode: 400 },
    );
  }

  if (!Object.values(EvaluationType).includes(data.type)) {
    throw Object.assign(new Error("Invalid evaluation type."), {
      statusCode: 400,
    });
  }

  if (
    !Number.isFinite(Number(data.durationMinutes)) ||
    data.durationMinutes < 1 ||
    data.durationMinutes > 300 ||
    !Number.isFinite(Number(data.passMark)) ||
    data.passMark < 0 ||
    data.passMark > 100 ||
    !Number.isInteger(Number(data.maxAttempts)) ||
    data.maxAttempts < 1 ||
    data.maxAttempts > 20
  ) {
    throw Object.assign(
      new Error("Invalid duration, pass mark, or max attempts."),
      { statusCode: 400 },
    );
  }

  const questions = await Question.find({
    _id: { $in: data.questionIds },
    isActive: true,
    createdBy: userId,
    subjectId: data.subjectId,
  }).select("_id subjectId createdBy");

  if (questions.length !== new Set(data.questionIds.map(String)).size) {
    throw Object.assign(
      new Error("One or more questions do not exist or are inactive!"),
      { statusCode: 400 },
    );
  }

  const [topic, subject] = await Promise.all([
    Topic.findOne({
      _id: data.topicId,
      isActive: true,
      subjectId: data.subjectId,
    }),
    Subject.findOne({
      _id: data.subjectId,
      classId: data.classId,
      isActive: true,
    }),
  ]);

  if (!topic || !subject) {
    throw Object.assign(
      new Error(
        "The selected topic and class must belong to the assigned subject.",
      ),
      { statusCode: 404 },
    );
  }

  const slug = createSlug(data.title);

  const isExisting = await Evaluation.findOne({
    topicId: data.topicId,
    slug: slug,
    createdBy: userId,
  });

  if (isExisting) {
    throw Object.assign(
      new Error("This evaluation already exists for the topic"),
      { statusCode: 409 },
    );
  }

  return await Evaluation.create({
    ...data,
    slug,
    createdBy: userId,
  });
};

export const getEvaluation = async (query: {
  page?: number;
  limit?: number;
  topicId?: string;
  search?: string;
  isPublished?: boolean;
  includeUnpublish?: boolean;
  createdBy?: string;
  classId?: string;
}) => {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 10));

  const filter: Record<string, unknown> = {};

  if (query.topicId) filter.topicId = query.topicId;
  if (query.createdBy) filter.createdBy = query.createdBy;
  if (query.classId) filter.classId = query.classId;
  if (!query.includeUnpublish) filter.isPublished = true;
  if (query.isPublished !== undefined) filter.isPublished = query.isPublished;

  if (query.search?.trim()) {
    filter.title = {
      $regex: query.search.trim(),
      $options: "i",
    };
  }

  const [queryData, total] = await Promise.all([
    Evaluation.find(filter)
      .populate("topicId", "title")
      .populate("subjectId", "name")
      .populate("classId", "name level")
      .populate("lessonId", "title")
      .populate("questionIds", "prompt type marks")
      .sort({ createdAt: -1, title: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Evaluation.countDocuments(filter),
  ]);

  const data = queryData.map((d) => {
    const evaluationObj = d.toObject();

    const {
      topicId,
      subjectId,
      classId,
      lessonId,
      questionIds,
      ...evaluationData
    } = evaluationObj;

    return {
      ...evaluationData,
      topic: topicId ?? null,
      subject: subjectId ?? null,
      class: classId ?? null,
      lesson: subjectId ?? null,
      questions: questionIds ?? null,
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

export const updateEvaluation = async (
  id: string | string[],
  data: Record<string, unknown>,
  createdBy: string,
) => {
  const updates = { ...data };

  if (typeof updates.title === "string") {
    updates.slug = createSlug(updates.title);
  }

  const evaluation = await Evaluation.findOneAndUpdate(
    { _id: id, createdBy },
    { $set: updates },
    { new: true, runValidators: true },
  );

  if (!evaluation) {
    throw Object.assign(new Error("Evaluation not found"), {
      statusCode: 404,
    });
  }

  return evaluation;
};

export const updateEvaluationStatus = async (
  evaluationId: string | string[],
  isPublished: boolean,
  createdBy: string,
) => {
  const evaluation = await Evaluation.findOneAndUpdate(
    {
      _id: evaluationId,
      createdBy,
    },
    {
      $set: {
        isPublished,
      },
    },
    {
      new: true,
    },
  );

  if (!evaluation) {
    throw new Error("Evaluation not found!");
  }

  return evaluation;
};
