import mongoose from "mongoose";
import Question, {
  QuestionDifficulty,
  QuestionType,
} from "../models/Question.ts";
import Topic from "../models/Topic.ts";
import Lesson from "../models/Lesson.ts";
import { fail, isValidObjectId } from "../utils/helperFunctions.ts";

export const isValidQuestionType = (value: unknown) =>
  typeof value === "string" &&
  Object.values(QuestionType).includes(value as never);

export const isValidDifficulty = (value: unknown) =>
  typeof value === "string" &&
  Object.values(QuestionDifficulty).includes(value as never);

export const createQuestion = async (
  data: {
    prompt: string;
    type: string;
    options: Array<{ label: string; value: string }>;
    correctAnswers: string[];
    explanation?: string;
    marks: number;
    difficulty: string;
    subjectId: string;
    topicId?: string;
    lessonId?: string;
  },
  userId: string | undefined,
  assignedSubjectIds: string[],
) => {
  if (
    !data.prompt?.trim() ||
    !isValidQuestionType(data.type) ||
    !isValidObjectId(data.subjectId) ||
    (data.topicId !== undefined && !isValidObjectId(data.topicId)) ||
    (data.lessonId !== undefined && !isValidObjectId(data.lessonId)) ||
    (data.lessonId !== undefined && data.topicId === undefined) ||
    !userId ||
    !assignedSubjectIds.includes(data.subjectId)
  ) {
    fail(
      "Prompt, a valid question type, and an assigned subject are required.",
    );
  }

  if (!Array.isArray(data.options) || !Array.isArray(data.correctAnswers)) {
    fail("Options and correctAnswers must be arrays.");
  }

  if (data.topicId) {
    const topic = await Topic.findOne({
      _id: data.topicId,
      subjectId: data.subjectId,
      isActive: true,
    });

    if (!topic) {
      fail("The selected topic is not in this subject.");
    }
  }

  if (data.lessonId) {
    const lesson = await Lesson.findOne({
      _id: data.lessonId,
      topicId: data.topicId,
    });
    if (!lesson) {
      fail("The selected lesson is not in this topic.");
    }
  }

  if (
    !isValidDifficulty(data.difficulty) ||
    !Number.isFinite(data.marks) ||
    Number(data.marks) < 1
  ) {
    fail("Invalid difficulty or marks.");
  }

  if (
    data.type === QuestionType.MULTIPLE_CHOICE &&
    (data.options.length < 2 ||
      data.correctAnswers.length !== 1 ||
      !data.options.some((option) => option.value === data.correctAnswers[0]))
  ) {
    fail(
      "Multiple-choice questions need at least two options and one matching correct answer.",
    );
  }

  if (
    data.type === QuestionType.TRUE_FALSE &&
    (data.correctAnswers.length !== 1 ||
      !["true", "false"].includes(String(data.correctAnswers[0]).toLowerCase()))
  ) {
    fail("Choose true or false as the correct answer.");
  }

  if (
    data.type === QuestionType.SHORT_ANSWER &&
    !data.correctAnswers.some(
      (answer) => typeof answer === "string" && answer.trim(),
    )
  ) {
    fail("Add at least one accepted answer.");
  }

  const question = await Question.create({
    ...data,
    createdBy: userId,
  });

  return question;
};

export const getQuestions = async (query: {
  page: number;
  limit: number;
  subjectId?: string;
  topicId?: string;
  lessonId?: string;
  type?: string;
  difficulty?: string;
  createdBy?: string;
  search?: string;
}) => {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 10));

  const filter: Record<string, unknown> = {};

  if (query.topicId) filter.topicId = query.topicId;
  if (query.subjectId) filter.subjectId = query.subjectId;
  if (query.lessonId) filter.lessonId = query.lessonId;
  if (query.type) filter.type = query.type;
  if (query.difficulty) filter.difficulty = query.difficulty;
  if (query.createdBy) filter.createdBy = query.createdBy;
  if (query.createdBy) filter.isActive = true;
  if (query.search?.trim()) {
    filter.prompt = { $regex: query.search.trim(), $options: "i" };
  }

  const [queryData, total] = await Promise.all([
    Question.find(filter)
      .select(query.createdBy ? "+correctAnswers" : "-correctAnswers")
      .populate([
        { path: "topicId", select: "title" },
        { path: "subjectId", select: "name" },
        { path: "lessonId", select: "title" },
      ])
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Question.countDocuments(filter),
  ]);

  const data = queryData.map((d) => {
    const questionObj = d.toObject();

    const { topicId, subjectId, lessonId, ...questionData } = questionObj;

    return {
      ...questionData,
      topic: topicId ?? null,
      subject: subjectId ?? null,
      lesson: lessonId ?? null,
    };
  });

  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getQuestionById = async (
  id: string | string[],
  createdBy?: string,
) => {
  const filter: Record<string, unknown> = { _id: id };
  if (createdBy) filter.createdBy = createdBy;

  const queryQuestion = await Question.findOne(filter).populate([
    { path: "topicId", select: "title" },
    { path: "subjectId", select: "name" },
    { path: "lessonId", select: "title" },
  ]);

  if (!queryQuestion) {
    fail("Question not found!", 404);
  }

  const questionObj = queryQuestion.toObject();

  const { topicId, subjectId, lessonId, ...questionData } = questionObj;

  const question = {
    ...questionData,
    topic: topicId ?? null,
    subject: subjectId ?? null,
    lesson: lessonId ?? null,
  };

  return question;
};

export const updateQuestion = async (
  id: string | string[],
  data: Record<string, unknown>,
  createdBy: string,
) => {
  const updates = { ...data };
  delete updates.createdBy;
  delete updates.isActive;

  const question = await Question.findOneAndUpdate(
    { _id: id, createdBy },
    { $set: updates },
    { new: true, runValidators: true },
  );

  if (!question) {
    fail("Question not found", 404);
  }

  return question;
};

export const updateQuestionStatus = async (
  id: string | string[],
  isActive: boolean,
  createdBy: string,
) => {
  const question = await Question.findOneAndUpdate(
    {
      _id: id,
      createdBy,
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

  if (!question) {
    fail("Question not found", 404);
  }

  return question;
};
