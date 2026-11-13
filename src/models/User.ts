import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcrypt";

export const UserRole = {
  ADMIN: "ADMIN",
  TEACHER: "TEACHER",
  STUDENT: "STUDENT",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  role: UserRole;
  profilePic?: string;
  department?: string;
  classId?: mongoose.Types.ObjectId;
  isActive: boolean;
  assignedSubjectIds: Array<mongoose.Types.ObjectId>;
  isEmailVerified: boolean;
  emailVerificationToken: string | null;
  emailVerificationExpires: Date | null;
  passwordSetupToken: string | null;
  passwordSetupExpires: Date | null;
  lastLoginAt?: Date;
  hasPassword: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  failedLoginAttempts?: number;
  loginBlockedUntil?: Date | null;
}

const userSchema = new Schema<IUser>(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },

    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    password: {
      type: String,
      select: false,
    },

    role: {
      type: String,
      enum: Object.values(UserRole),
      required: true,
      index: true,
    },

    profilePic: {
      type: String,
      default: null,
    },

    classId: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      index: true,
    },

    assignedSubjectIds: {
      type: [Schema.Types.ObjectId],
      ref: "Subject",
    },

    department: {
      type: String,
      enum: ["SCIENCE", "ARTS", "COMMERCIAL", ""],
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerificationToken: {
      type: String,
      default: null,
      select: false,
    },

    emailVerificationExpires: {
      type: Date,
      default: null,
      select: false,
    },

    passwordSetupToken: {
      type: String,
      default: null,
      select: false,
    },

    passwordSetupExpires: {
      type: Date,
      default: null,
      select: false,
    },

    lastLoginAt: Date,

    failedLoginAttempts: {
      type: Number,
      default: 0,
      select: false,
    },

    loginBlockedUntil: {
      type: Date,
      default: null,
      select: false,
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

userSchema.index({ role: 1, createdAt: -1 });

userSchema.index({ role: 1, isActive: 1 });

// Hash the password before saving the user document
userSchema.pre<IUser>("save", async function () {
  if (this.isModified("password") && this.password) {
    const saltRounds = 10;
    this.password = await bcrypt.hash(this.password, saltRounds);
  }
});

// Compare the provided password with the hashed password in the database
userSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model<IUser>("User", userSchema);
