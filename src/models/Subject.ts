import mongoose, { Schema, Document } from "mongoose";

export const SubjectCategory = {
  GENERAL: "GENERAL",
  SCIENCE: "SCIENCE",
  COMMERCIAL: "COMMERCIAL",
  ARTS: "ARTS",
} as const;

export type SubjectCategory =
  (typeof SubjectCategory)[keyof typeof SubjectCategory];

export interface ISubject extends Document {
  name: string;
  slug: string;
  description?: string;
  classId: mongoose.Types.ObjectId;
  category: SubjectCategory;
  order: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

const subjectSchema = new Schema<ISubject>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
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

    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
      index: true,
    },

    category: {
      type: String,
      enum: Object.values(SubjectCategory),
      default: SubjectCategory.GENERAL,
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

subjectSchema.index(
  {
    classId: 1,
    slug: 1,
  },
  { unique: true },
);

subjectSchema.index({ classId: 1, category: 1, order: 1 });

export default mongoose.model<ISubject>("Subject", subjectSchema);
