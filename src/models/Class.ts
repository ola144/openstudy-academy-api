import mongoose, { Schema, Document } from "mongoose";

export const ClassLevel = {
  JUNIOR: "JUNIOR",
  SENIOR: "SENIOR",
} as const;

export type ClassLevel = (typeof ClassLevel)[keyof typeof ClassLevel];

export interface IClass extends Document {
  name: string;
  level: ClassLevel;
  description?: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const classSchema = new Schema<IClass>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },

    level: {
      type: String,
      enum: ["JUNIOR", "SENIOR"],
      required: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    order: {
      type: Number,
      required: true,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
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

classSchema.index(
  {
    level: 1,
    order: 1,
  },
  {
    unique: true,
  },
);

export default mongoose.model<IClass>("Class", classSchema);
