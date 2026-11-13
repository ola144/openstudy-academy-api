import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

export const AttemptStatus = {
  IN_PROGRESS: "IN_PROGRESS",
  SUBMITTED: "SUBMITTED",
  GRADED: "GRADED",
  EXPIRED: "EXPIRED",
} as const;

export type AttemptStatus = (typeof AttemptStatus)[keyof typeof AttemptStatus];

const answerSchema = new Schema(
  {
    questionId: {
      type: Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
    answer: { type: Schema.Types.Mixed },
    awardedMarks: { type: Number, min: 0, default: 0 },
    maxMarks: { type: Number, min: 0, required: true },
    isCorrect: { type: Boolean },
    needsManualGrading: { type: Boolean, default: false },
    feedback: { type: String, trim: true },
  },
  { _id: false },
);

const attemptSchema = new Schema(
  {
    evaluationId: {
      type: Schema.Types.ObjectId,
      ref: "Evaluation",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    attemptNumber: { type: Number, required: true, min: 1 },
    answers: { type: [answerSchema], default: [] },
    status: {
      type: String,
      enum: Object.values(AttemptStatus),
      default: AttemptStatus.IN_PROGRESS,
      index: true,
    },
    startedAt: { type: Date, required: true, default: Date.now },
    submittedAt: { type: Date },
    expiresAt: { type: Date, required: true },
    score: { type: Number, min: 0, default: 0 },
    totalMarks: { type: Number, min: 0, required: true },
    percentage: { type: Number, min: 0, max: 100, default: 0 },
    passed: { type: Boolean },
    needsManualGrading: { type: Boolean, default: false },
    gradedAt: { type: Date },
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

attemptSchema.index(
  { evaluationId: 1, studentId: 1, attemptNumber: 1 },
  { unique: true },
);

const EvaluationAttempt =
  models.EvaluationAttempt || model("EvaluationAttempt", attemptSchema);

export default EvaluationAttempt;
