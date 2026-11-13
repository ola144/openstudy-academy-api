import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

export const QuestionType = {
  MULTIPLE_CHOICE: "MULTIPLE_CHOICE",
  TRUE_FALSE: "TRUE_FALSE",
  SHORT_ANSWER: "SHORT_ANSWER",
  ESSAY: "ESSAY",
} as const;

export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType];

export const QuestionDifficulty = {
  EASY: "EASY",
  MEDIUM: "MEDIUM",
  HARD: "HARD",
} as const;

export type QuestionDifficulty =
  (typeof QuestionDifficulty)[keyof typeof QuestionDifficulty];

const questionOptionSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const questionSchema = new Schema(
  {
    prompt: { type: String, required: true, trim: true, maxlength: 5000 },
    type: {
      type: String,
      enum: Object.values(QuestionType),
      required: true,
    },
    options: { type: [questionOptionSchema], default: [] },
    // Store a single option value, "true"/"false", or a list of accepted short answers.
    correctAnswers: { type: [String], default: [], select: false },
    explanation: { type: String, trim: true, maxlength: 5000 },
    marks: { type: Number, required: true, min: 1, default: 1 },
    difficulty: {
      type: String,
      enum: Object.values(QuestionDifficulty),
      default: QuestionDifficulty.MEDIUM,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },
    topicId: { type: Schema.Types.ObjectId, ref: "Topic", index: true },
    lessonId: { type: Schema.Types.ObjectId, ref: "Lesson", index: true },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret: any) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;

        return ret;
      },
    },

    toObject: {
      transform(doc, ret: any) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;

        return ret;
      },
    },
  },
);

questionSchema.pre("validate", function () {
  const correctAnswers = this.correctAnswers ?? [];
  const options = this.options ?? [];

  // MULTIPLE CHOICE
  if (this.type === QuestionType.MULTIPLE_CHOICE) {
    const optionValues = options.map((option) => option.value);

    if (optionValues.length < 2)
      this.invalidate(
        "options",
        "Multiple-choice questions require at least two options.",
      );

    if (new Set(optionValues).size !== optionValues.length) {
      this.invalidate(
        "options",
        "Multiple-choice option values must be unique.",
      );
    }

    if (correctAnswers.length !== 1)
      this.invalidate(
        "correctAnswers",
        "Multiple-choice questions require exactly one correct answer value.",
      );

    if (correctAnswers.some((answer) => !optionValues.includes(answer))) {
      this.invalidate(
        "correctAnswers",
        "The correct answer must match one of the option values.",
      );
    }
    // TRUE / FALSE
  } else if (this.type === QuestionType.TRUE_FALSE) {
    const answer = String(correctAnswers[0] ?? "").toLowerCase();

    if (correctAnswers.length !== 1 || !["true", "false"].includes(answer)) {
      this.invalidate(
        "correctAnswers",
        'True/false questions require one correct answer: "true" or "false".',
      );
    }
    // SHORT ANSWER
  } else if (this.type === QuestionType.SHORT_ANSWER) {
    if (
      correctAnswers.length < 1 ||
      correctAnswers.some((answer) => !String(answer).trim())
    )
      this.invalidate(
        "correctAnswers",
        "Short-answer questions require at least one accepted answer.",
      );
  }
});

const Question = models.Question || model("Question", questionSchema);

export default Question;
