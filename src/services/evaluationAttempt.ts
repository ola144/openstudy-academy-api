import mongoose from "mongoose";
import Evaluation from "../models/Evaluation.ts";
import EvaluationAttempt, {
  AttemptStatus,
} from "../models/EvaluationAttempt.ts";
import Question, { QuestionType } from "../models/Question.ts";
import { UserRole } from "../models/User.ts";
import { fail } from "../utils/helperFunctions.ts";

interface GradingAnswer {
  questionId: string;
  awardedMarks: number;
  feedback?: string;
}

const safeQuestion = (question: any) => {
  return {
    id: question._id,
    prompt: question.prompt,
    type: question.type,
    options: question.options,
    marks: question.marks,
    difficulty: question.difficulty,
  };
};

const normalizeAnswer = (value: unknown) => {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ");
};

const isCorrectAnswer = (
  type: string,
  submitted: unknown,
  accepted: string[],
) => {
  const normalized = normalizeAnswer(submitted);

  if (
    type === QuestionType.MULTIPLE_CHOICE ||
    type === QuestionType.TRUE_FALSE
  ) {
    return accepted.some((answer) => normalizeAnswer(answer) === normalized);
  }

  if (type === QuestionType.SHORT_ANSWER) {
    return accepted.some((answer) => normalizeAnswer(answer) === normalized);
  }

  return false;
};

export const startAttempt = async (
  evaluationId: string | string[],
  classId: string | string[],
  userId: string | undefined,
  userClassId?: string,
) => {
  const evaluation = await Evaluation.findById(evaluationId);

  if (!evaluation || !evaluation.isPublished) {
    fail("Publised evaluation not found!", 404);
  }

  if (classId && String(evaluation.classId) !== classId) {
    fail("This evaluation is not assied to your classs", 403);
  }
  if (!userClassId || String(evaluation.classId) !== userClassId) {
    fail("This evaluation is not assigned to your class.", 403);
  }

  const now = new Date();

  if (evaluation.availableFrom && now < evaluation.availableFrom) {
    fail("This evaluation is not available yet.", 409);
  }

  if (evaluation.availableUntil && now > evaluation.availableUntil) {
    fail("This evaluation deadline has passed.", 409);
  }

  const latest = await EvaluationAttempt.findOne({
    evaluationId: evaluation._id,
    studentId: userId,
  }).sort({ attemptNumber: -1 });

  if (latest?.status === AttemptStatus.IN_PROGRESS && latest.expiresAt > now) {
    // Fetch the questions
    const questions = await Question.find({
      _id: { $in: evaluation.questionIds },
    }).select("+correctAnswers");

    // Preserve question order
    const byId = new Map(questions.map((q: any) => [String(q._id), q]));

    const ordered = evaluation.questionIds
      .map((id: any) => byId.get(String(id)))
      .filter(Boolean);

    return {
      success: true,
      message: "Resuming existing attempt.",
      data: {
        attemptId: latest._id,
        startedAt: latest.startedAt,
        expiresAt: latest.expiresAt,
        evaluation: {
          id: evaluation._id,
          title: evaluation.title,
          durationMinutes: evaluation.durationMinutes,
        },
        questions: ordered.map(safeQuestion),
      },
    };
  }

  // Count how many attempts the student has used
  const usedAttempts = await EvaluationAttempt.countDocuments({
    evaluationId: evaluation._id,
    studentId: userId,
  });

  if (usedAttempts >= evaluation.maxAttempts) {
    throw Object.assign(
      new Error("You have used all attempts for this evaluation!"),
      { statusCode: 409 },
    );
  }

  // Fetch all active evaluation questions
  const questions = await Question.find({
    _id: { $in: evaluation.questionIds },
    isActive: true,
  }).select("+correctAnswers");

  const byId = new Map(questions.map((q: any) => [String(q._id), q]));

  let ordered = evaluation.questionIds
    .map((id: any) => byId.get(String(id)))
    .filter(Boolean);

  if (ordered.length !== evaluation.questionIds.length) {
    throw Object.assign(
      new Error("Some evaluation questions are unavailable."),
      { statusCode: 409 },
    );
  }

  if (evaluation.shuffleQuestions) {
    ordered = ordered.sort(() => Math.random() - 0.5);
  }

  // Calculate the total marks
  const totalMarks = ordered.reduce((sum: number, q: any) => sum + q.marks, 0);

  const attempt = await EvaluationAttempt.create({
    evaluationId: evaluation._id,
    studentId: userId,
    attemptNumber: usedAttempts + 1,
    answers: ordered.map((q: any) => ({
      questionId: q._id,
      maxMarks: q.marks,
    })),
    totalMarks,
    startedAt: now,
    expiresAt: new Date(now.getTime() + evaluation.durationMinutes * 60_000),
  });

  return {
    data: {
      attemptId: attempt._id,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      evaluation: {
        _id: evaluation._id,
        title: evaluation.title,
        durationMinutes: evaluation.durationMinutes,
      },
      questions: ordered.map(safeQuestion),
    },
  };
};

export const getAttemt = async (
  attemptId: string | string[],
  userId: string | undefined,
  role: string | undefined,
) => {
  const attempt = await EvaluationAttempt.findById(attemptId).populate(
    "evaluationId",
    "title type passMark showResultsImmediately",
  );

  if (!attempt) fail("Attempt not found.", 404);

  if (role === UserRole.STUDENT && String(attempt.studentId) !== userId)
    fail("You cannot access this attempt.", 403);

  if (role === UserRole.TEACHER) {
    const evaluation = await Evaluation.findById(
      (attempt.evaluationId as any)._id,
    );

    if (!evaluation || String(evaluation.createdBy) !== userId)
      fail("You cannot access this attempt.", 403);
  }

  const attemptObj = attempt.toObject();
  const populatedEvaluation = attemptObj.evaluationId as any;

  const questions = await Question.find({
    _id: { $in: attempt.answers.map((answer: any) => answer.questionId) },
  });

  const questionsById = new Map(
    questions.map((question: any) => [String(question._id), question]),
  );

  attemptObj.questions = attempt.answers
    .map((answer: any) => questionsById.get(String(answer.questionId)))
    .filter(Boolean)
    .map(safeQuestion);

  if (role === UserRole.STUDENT) {
    const canSeeResults =
      populatedEvaluation?.showResultsImmediately &&
      attemptObj.status === AttemptStatus.GRADED;

    if (!canSeeResults) {
      delete attemptObj.score;
      delete attemptObj.totalMarks;
      delete attemptObj.percentage;
      delete attemptObj.passed;
      delete attemptObj.gradedAt;
    }

    attemptObj.answers = attemptObj.answers.map((a: any) => ({
      questionId: a.questionId,
      answer: a.answer,
    }));
  }

  const { evaluationId, ...attemptData } = attemptObj;

  const result = {
    ...attemptData,
    evaluation: evaluationId ?? null,
  };

  return result;
};

export const submitAttempt = async (
  data: { answers: any },
  userId: string | undefined,
  attemptId: string | string[],
) => {
  const attempt = await EvaluationAttempt.findById(attemptId);

  if (!attempt) fail("Attempt not found.", 404);

  if (String(attempt.studentId) !== userId)
    throw Object.assign(
      new Error("You cannot submit another student's attempt!"),
      { statusCode: 403 },
    );

  if (attempt.status !== AttemptStatus.IN_PROGRESS)
    fail("This attempt has already been submitted.", 409);

  // Find the evaluation
  const evaluation = await Evaluation.findById(attempt.evaluationId);

  if (!evaluation) fail("Evaluation not found.", 404);

  // Check whether the attempt has timed out
  const timedOut = new Date() > attempt.expiresAt;

  // Extract answers from request body
  const submittedAnswers = data.answers;

  if (!timedOut && !Array.isArray(submittedAnswers))
    throw Object.assign(
      new Error(`Answers must be an array of {questionId, answer}.`),
      { statusCode: 400 },
    );

  // Create an answer map
  const answerMap = new Map<string, unknown>();

  if (Array.isArray(submittedAnswers)) {
    for (const item of submittedAnswers) {
      if (item?.questionId && mongoose.isValidObjectId(item.questionId))
        answerMap.set(String(item.questionId), item.answer);
    }
  }

  // Fetch the questions and correct answers
  const questions = await Question.find({
    _id: { $in: attempt.answers.map((a: any) => a.questionId) },
  }).select("+correctAnswers");

  const questionMap = new Map(questions.map((q: any) => [String(q._id), q]));

  //Initialize the grading variables
  let score = 0;
  let needsManualGrading = false;

  // Grade each answer
  for (const answer of attempt.answers as any[]) {
    // Find the question
    const question: any = questionMap.get(String(answer.questionId));

    if (!question) continue;

    const submitted = answerMap.get(String(answer.questionId));

    answer.answer = submitted;
    answer.awardedMarks = 0;
    answer.needsManualGrading = false;

    if (question.type === QuestionType.ESSAY) {
      answer.needsManualGrading = true;
      needsManualGrading = true;
    } else if (
      isCorrectAnswer(question.type, submitted, question.correctAnswers ?? [])
    ) {
      answer.isCorrect = true;
      answer.awardedMarks = question.marks;
      score += question.marks;
    } else {
      answer.isCorrect = false;
    }
  }

  attempt.score = score;
  attempt.percentage = attempt.totalMarks
    ? Math.round((score / attempt.totalMarks) * 10000) / 100
    : 0;
  attempt.passed = attempt.percentage >= evaluation.passMark;
  attempt.needsManualGrading = needsManualGrading;
  attempt.submittedAt = new Date();
  attempt.status = timedOut
    ? AttemptStatus.EXPIRED
    : needsManualGrading
      ? AttemptStatus.SUBMITTED
      : AttemptStatus.GRADED;
  if (!needsManualGrading) attempt.gradedAt = new Date();

  await attempt.save();

  const response: any = {
    attemptId: attempt._id,
    status: attempt.status,
    submittedAt: attempt.submittedAt,
    needsManualGrading: attempt.needsManualGrading,
  };

  if (evaluation.showResultsImmediately && !needsManualGrading && !timedOut) {
    response.score = attempt.score;
    response.totalMarks = attempt.totalMarks;
    response.percentage = attempt.percentage;
    response.passed = attempt.passed;
  }

  return response;
};

export const myAttemptHistory = async (userId: string | undefined) => {
  const attempts = await EvaluationAttempt.find({ studentId: userId })
    .populate("evaluationId", "title type passMark subjectId topicId")
    .sort({ createdAt: -1 });

  return attempts;
};

export const manuallyGradeAttempt = async (
  userId: string | undefined,
  role: string | undefined,
  answers: GradingAnswer[],
  attemptId: string | string[],
) => {
  if (!userId) {
    fail("Authentication is required!", 401);
  }

  // Validate request data
  if (!mongoose.isValidObjectId(attemptId)) {
    fail("Invalid attempt ID!");
  }

  if (!Array.isArray(answers) || answers.length === 0) {
    fail("Provide at least one answer to grade!");
  }

  const attempt = await EvaluationAttempt.findById(attemptId);

  if (!attempt) {
    fail("Evaluation attempt not found", 404);
  }

  // Allow pending manual grading, including expired attempts
  // that still contain essay answers.
  const allowedStatuses = [AttemptStatus.SUBMITTED, AttemptStatus.EXPIRED];

  if (
    !allowedStatuses.includes(attempt.status) ||
    !attempt.needsManualGrading
  ) {
    throw Object.assign(
      new Error("This attempt is not awaiting manual grading."),
      {
        statusCode: 409,
      },
    );
  }

  const evaluation = await Evaluation.findById(attempt.evaluationId);

  if (!evaluation) {
    fail("Evaluation not found", 404);
  }

  const questionIds = attempt.answers.map((answer: any) => answer.questionId);

  const questions = await Question.find({
    _id: { $in: questionIds },
  }).select("-correctAnswers");

  const questionMap = new Map(
    questions.map((question) => [String(question._id), question]),
  );

  //  Validate every grading entry before changing anything.
  const seenIds = new Set<string>();

  for (const item of answers) {
    if (!item?.questionId || !mongoose.isValidObjectId(item.questionId)) {
      throw Object.assign(
        new Error("Every grading entry needs a valid question ID."),
        { statusCode: 400 },
      );
    }

    const questionId = String(item.questionId);

    if (seenIds.has(questionId)) {
      throw Object.assign(
        new Error("Duplicate question IDs are not allowed!"),
        { statusCode: 400 },
      );
    }

    seenIds.add(questionId);

    const question = questionMap.get(questionId);

    if (!question) {
      throw Object.assign(
        new Error("A question does not belong to this attempt!"),
        { statusCode: 400 },
      );
    }

    if (question.type !== QuestionType.ESSAY) {
      throw Object.assign(
        new Error("Only essay questions can be manually graded!"),
        { statusCode: 400 },
      );
    }

    const marks = item.awardedMarks;

    if (
      typeof marks !== "number" ||
      !Number.isFinite(marks) ||
      marks < 0 ||
      marks > question.marks
    ) {
      throw Object.assign(
        new Error(`Marks must be between 0 and ${question.marks}.`),
        { statusCode: 400 },
      );
    }

    if (item.feedback !== undefined && typeof item.feedback !== "string") {
      fail("Feedback must be a string");
    }
  }

  for (const item of answers) {
    const answerRecord = (attempt.answers as any[]).find(
      (answer) => String(answer.questionId) === String(item.questionId),
    );

    if (!answerRecord) {
      throw Object.assign(
        new Error("A question does not belong to this attempt!"),
        { statusCode: 400 },
      );
    }

    answerRecord.awardedMarks = item.awardedMarks;
    answerRecord.needsManualGrading = false;
    if (item.feedback !== undefined) answerRecord.feedback = item.feedback;
  }

  // Determine whether any questions still need grading.
  const essayQuestions = questions.filter(
    (question: any) => question.type === QuestionType.ESSAY,
  );

  const allEssaysGraded = essayQuestions.every((question: any) => {
    const answerRecord = (attempt.answers as any[]).find(
      (answer) => String(answer.questionId) === String(question._id),
    );

    return answerRecord && answerRecord.needsManualGrading === false;
  });

  attempt.needsManualGrading = !allEssaysGraded;

  // Recalculate the score from all answer records.
  attempt.score = (attempt.answers as any[]).reduce(
    (total, answer) => total + (answer.awardedMarks ?? 0),
    0,
  );

  attempt.percentage = attempt.totalMarks
    ? Math.round((attempt.score / attempt.totalMarks) * 10000) / 100
    : 0;

  attempt.passed = attempt.percentage >= evaluation.passMark;

  // Finalize the grading status when every essay is graded.
  if (allEssaysGraded) {
    // Preserve EXPIRED if the student exceeded the time limit.
    if (attempt.status !== AttemptStatus.EXPIRED) {
      attempt.status = AttemptStatus.GRADED;
    }

    attempt.gradedAt = new Date();
  }

  await attempt.save();

  return {
    message: allEssaysGraded
      ? "Manual grading completed successfully."
      : "Grading saved. Some answers still need review.",
    data: {
      attemptId: attempt._id,
      status: attempt.status,
      needsManualGrading: attempt.needsManualGrading,
      score: attempt.score,
      totalMarks: attempt.totalMarks,
      percentage: attempt.percentage,
      passed: attempt.passed,
      gradedAt: attempt.gradedAt,
      answers: (attempt.answers as any[]).map((answer) => ({
        questionId: answer.questionId,
        awardedMarks: answer.awardedMarks,
        maxMarks: answer.maxMarks,
        needsManualGrading: answer.needsManualGrading,
        feedback: answer.feedback,
      })),
    },
  };
};
