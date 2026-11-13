import mongoose, { Schema, Document } from "mongoose";

export const SCHEDULE_STATUSES = [
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

export interface ITimetable extends Document {
  title: string;
  teacherId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  topicId?: mongoose.Types.ObjectId;
  date: Date;
  startTime: string;
  endTime: string;
  status: ScheduleStatus;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
}

const teachingScheduleSchema = new Schema<ITimetable>(
  {
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Teacher is required!"],
      index: true,
    },
    date: {
      type: Date,
      required: [true, "Date is required!"],
      index: true,
    },
    startTime: {
      type: String,
      required: [true, "Start time is required!"],
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    endTime: {
      type: String,
      required: [true, "End time is required!"],
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    title: {
      type: String,
      required: [true, "Title time is required!"],
    },
    status: {
      type: String,
      enum: SCHEDULE_STATUSES,
      required: [true, "Status is required!"],
      default: "SCHEDULED",
      index: true,
    },
    notes: { type: String, trim: true },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: [true, "Subject is required!"],
      index: 1,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: [true, "Class is required!"],
      index: true,
    },
    topicId: {
      type: Schema.Types.ObjectId,
      ref: "Topic",
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
      transform(doc, ref: any) {
        ref._id = ref.id;
        delete ref._id;
        delete ref.__v;

        return ref;
      },
    },
    toObject: {
      transform(doc, ref: any) {
        ref._id = ref.id;
        delete ref._id;
        delete ref.__v;

        return ref;
      },
    },
  },
);

teachingScheduleSchema.index({
  teacherId: 1,
  date: 1,
  startTime: 1,
});

teachingScheduleSchema.index({
  classId: 1,
  date: 1,
  startTime: 1,
});

export default mongoose.model<ITimetable>(
  "TeachingSchedule",
  teachingScheduleSchema,
);
