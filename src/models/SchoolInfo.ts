import mongoose, { type Document, Schema } from "mongoose";

export const Terms = {
  FIRST: "FIRST",
  SECOND: "SECOND",
  THIRD: "THIRD",
} as const;

export type Terms = (typeof Terms)[keyof typeof Terms];

export interface ISchoolInfo extends Document {
  name: string;
  term: Terms;
  address: string;
  email: string;
  logo?: string;
  phoneNumber: string;
}

const schoolInfoSchema = new Schema<ISchoolInfo>(
  {
    name: {
      type: String,
      required: [true, "School name is required!"],
    },
    term: {
      type: String,
      enum: ["FIRST", "SECOND", "THIRD"],
      required: [true, "Current term is required!"],
      default: "FIRST",
    },
    address: {
      type: String,
      required: [true, "School address is required"],
    },
    email: {
      type: String,
      required: [true, "School email address is required!"],
    },
    logo: {
      type: String,
      default: null,
    },
    phoneNumber: {
      type: String,
      required: [true, "School phone number is required!"],
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

const SchoolInfo = mongoose.model<ISchoolInfo>("SchoolInfo", schoolInfoSchema);

export default SchoolInfo;
