import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

export const EvaluationType = {
  QUIZ: "QUIZ",
  TEST: "TEST",
  EXAM: "EXAM",
} as const;

export type EvaluationType =
  (typeof EvaluationType)[keyof typeof EvaluationType];

const evaluationSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: {
      type: String,
    },
    description: { type: String, trim: true, maxlength: 5000 },
    type: {
      type: String,
      enum: Object.values(EvaluationType),
      required: true,
      default: EvaluationType.QUIZ,
    },
    questionIds: [
      { type: Schema.Types.ObjectId, ref: "Question", required: true },
    ],
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
      index: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },
    topicId: { type: Schema.Types.ObjectId, ref: "Topic" },
    lessonId: { type: Schema.Types.ObjectId, ref: "Lesson" },
    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
      max: 300,
      default: 30,
    },
    passMark: { type: Number, required: true, min: 0, default: 50 }, // percentage
    maxAttempts: { type: Number, required: true, min: 1, max: 20, default: 1 },
    availableFrom: { type: Date },
    availableUntil: { type: Date },
    isPublished: {
      type: Boolean,
      default: false,
      index: true,
    },
    shuffleQuestions: { type: Boolean, default: false },
    showResultsImmediately: { type: Boolean, default: true },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    publishedAt: { type: Date },
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

evaluationSchema.pre("validate", function () {
  if (!this.questionIds.length)
    this.invalidate(
      "questionIds",
      "An evaluation must contain at least one question.",
    );
  if (this.passMark > 100)
    this.invalidate(
      "passMark",
      "Pass mark must be a percentage between 0 and 100.",
    );
  if (
    this.availableFrom &&
    this.availableUntil &&
    this.availableUntil <= this.availableFrom
  ) {
    this.invalidate(
      "availableUntil",
      "availableUntil must be later than availableFrom.",
    );
  }
});

// export type IEvaluation = InferSchemaType<typeof evaluationSchema>;

const Evaluation = models.Evaluation || model("Evaluation", evaluationSchema);
export default Evaluation;
