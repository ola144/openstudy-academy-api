import mongoose, { Schema, Document } from "mongoose";

export const AcademicTerm = {
  FIRST: "FIRST",
  SECOND: "SECOND",
  THIRD: "THIRD",
} as const;

export type AcademicTerm = (typeof AcademicTerm)[keyof typeof AcademicTerm];

export interface ITopic extends Document {
  title: string;
  slug: string;
  description?: string;
  subjectId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  term: AcademicTerm;
  order: number;
  isActive: boolean;
  isComplete: boolean;
  completedAt: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const topicSchema = new Schema<ITopic>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    term: {
      type: String,
      enum: ["FIRST", "SECOND", "THIRD"],
      required: true,
    },
    order: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isComplete: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
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

topicSchema.index({ subjectId: 1, term: 1, slug: 1 }, { unique: true });

topicSchema.index({
  subjectId: 1,
  term: 1,
  order: 1,
});

export default mongoose.model<ITopic>("Topic", topicSchema);
