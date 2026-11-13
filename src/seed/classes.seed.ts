import mongoose from "mongoose";
import dotenv from "dotenv";
import Class, { ClassLevel } from "../models/Class.ts";

dotenv.config();

const classes = [
  {
    name: "JSS 1",
    level: ClassLevel.JUNIOR,
    description: "Junior Secondary School 1",
    order: 1,
    isActive: true,
  },
  {
    name: "JSS 2",
    level: ClassLevel.JUNIOR,
    description: "Junior Secondary School 2",
    order: 2,
    isActive: true,
  },
  {
    name: "JSS 3",
    level: ClassLevel.JUNIOR,
    description: "Junior Secondary School 3",
    order: 3,
    isActive: true,
  },
  {
    name: "SS 1",
    level: ClassLevel.SENIOR,
    description: "Senior Secondary School 1",
    order: 1,
    isActive: true,
  },
  {
    name: "SS 2",
    level: ClassLevel.SENIOR,
    description: "Senior Secondary School 2",
    order: 2,
    isActive: true,
  },
  {
    name: "SS 3",
    level: ClassLevel.SENIOR,
    description: "Senior Secondary School 3",
    order: 3,
    isActive: true,
  },
];

const seedClasses = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not defined");
    }

    await mongoose.connect(process.env.MONGODB_URI);

    console.log("Connected to MongoDB");

    for (const classData of classes) {
      await Class.findOneAndUpdate({ name: classData.name }, classData, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      });

      console.log(`✓ ${classData.name} seeded`);
    }

    console.log("Classes seeded successfully");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Failed to seed classes:", error);

    await mongoose.disconnect();
    process.exit(1);
  }
};

seedClasses();
