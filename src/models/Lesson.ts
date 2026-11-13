import mongoose, { Schema, Document } from "mongoose";

export const LessonStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
} as const;

export type LessonStatus = (typeof LessonStatus)[keyof typeof LessonStatus];

export const ContentBlockType = {
  HEADING: "HEADING",
  TEXT: "TEXT",
  IMAGE: "IMAGE",
  VIDEO: "VIDEO",
  LIST: "LIST",
} as const;

export type ContentBlockType =
  (typeof ContentBlockType)[keyof typeof ContentBlockType];

const contentBlockSchema = new Schema(
  {
    type: {
      type: String,
      enum: Object.values(ContentBlockType),
      required: true,
    },
    text: { type: String, trim: true },
    url: { type: String, trim: true },
    caption: { type: String, trim: true },
    items: [{ type: String, trim: true }],
  },
  {
    _id: true,
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

export interface ILesson extends Document {
  title: string;
  slug: string;
  topicId: mongoose.Types.ObjectId;
  summary?: string;
  objectives: string[];
  content: Array<{
    type: ContentBlockType;
    text?: string;
    url?: string;
    caption?: string;
    items?: string[];
  }>;
  estimatedMinutes: number;
  status: LessonStatus;
  publishedAt?: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const lessonSchema = new Schema<ILesson>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    topicId: {
      type: Schema.Types.ObjectId,
      ref: "Topic",
      required: true,
    },
    summary: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    objectives: {
      type: [String],
      default: [],
      validate: {
        validator: (items: string[]) => items.length <= 20,
        message: "A lesson cannot have more than 20 objectives",
      },
    },
    content: {
      type: [contentBlockSchema],
      default: [],
    },
    estimatedMinutes: {
      type: Number,
      default: 10,
      min: 1,
      max: 600,
    },
    status: {
      type: String,
      enum: Object.values(LessonStatus),
      default: LessonStatus.DRAFT,
    },
    publishedAt: Date,
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

lessonSchema.index({ topicId: 1, slug: 1 }, { unique: true });
lessonSchema.index({ topicId: 1, status: 1 });

export default mongoose.model<ILesson>("Lesson", lessonSchema);
