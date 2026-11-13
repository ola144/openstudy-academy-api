import mongoose, { Schema } from "mongoose";

const studentProgressSchema = new Schema(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    topicId: {
      type: Schema.Types.ObjectId,
      ref: "Topic",
      required: true,
      index: true,
    },

    startedAt: Date,

    completedAt: Date,

    isCompleted: {
      type: Boolean,
      default: false,
    },

    bestScore: {
      type: Number,
      default: 0,
    },

    attempts: {
      type: Number,
      default: 0,
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

studentProgressSchema.index(
  {
    studentId: 1,
    topicId: 1,
  },
  {
    unique: true,
  },
);

// export default mongoose.model("StudentProgress", studentProgressSchema);
