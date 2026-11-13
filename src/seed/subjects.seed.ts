import mongoose from "mongoose";
import dotenv from "dotenv";
import Subject, { SubjectCategory } from "../models/Subject.ts";
import User from "../models/User.ts";
import Class from "../models/Class.ts";
import { createSlug } from "../utils/createSlug.ts";

dotenv.config();

const CREATED_BY = "6ac62ef39d388499b8f1f7ca";

const CLASSES = {
  JSS1: "6ac52119adcf29609cb7bdd7",
  JSS2: "6ac5211aadcf29609cb7bdd8",
  JSS3: "6ac5211aadcf29609cb7bdd9",
  SS1: "6ac5211aadcf29609cb7bdda",
  SS2: "6ac5211aadcf29609cb7bddb",
  SS3: "6ac5211badcf29609cb7bddc",
} as const;

type SeedSubject = {
  name: string;
  category: SubjectCategory;
};

const juniorSubjects: SeedSubject[] = [
  { name: "English Language", category: "GENERAL" },
  { name: "Mathematics", category: "GENERAL" },
  { name: "Basic Science", category: "GENERAL" },
  { name: "Basic Technology", category: "GENERAL" },
  { name: "Computer Studies", category: "GENERAL" },
  { name: "Social Studies", category: "GENERAL" },
  { name: "Civic Education", category: "GENERAL" },
  { name: "Business Studies", category: "GENERAL" },
  { name: "Agricultural Science", category: "GENERAL" },
  { name: "Home Economics", category: "GENERAL" },
  {
    name: "Cultural and Creative Arts",
    category: "GENERAL",
  },
  {
    name: "Physical and Health Education",
    category: "GENERAL",
  },
  { name: "Christian Religious Studies", category: "GENERAL" },
  { name: "Islamic Religious Studies", category: "GENERAL" },
  { name: "French", category: "GENERAL" },
  { name: "Nigerian Language", category: "GENERAL" },
  { name: "History", category: "GENERAL" },
  { name: "Security Education", category: "GENERAL" },
  { name: "Music", category: "GENERAL" },
  { name: "Literature", category: "GENERAL" },
];

const seniorSubjects: SeedSubject[] = [
  // Shared / general subjects
  { name: "English Language", category: "GENERAL" },
  { name: "Mathematics", category: "GENERAL" },
  { name: "Civic Education", category: "GENERAL" },
  { name: "Computer Studies", category: "GENERAL" },
  { name: "Agricultural Science", category: "GENERAL" },
  { name: "Physical and Health Education", category: "GENERAL" },

  // Science subjects
  { name: "Biology", category: "SCIENCE" },
  { name: "Chemistry", category: "SCIENCE" },
  { name: "Physics", category: "SCIENCE" },
  { name: "Further Mathematics", category: "SCIENCE" },
  { name: "Geography", category: "SCIENCE" },
  { name: "Technical Drawing", category: "SCIENCE" },
  { name: "Health Science", category: "SCIENCE" },

  // Commercial subjects
  { name: "Economics", category: "COMMERCIAL" },
  { name: "Commerce", category: "COMMERCIAL" },
  { name: "Financial Accounting", category: "COMMERCIAL" },
  { name: "Marketing", category: "COMMERCIAL" },
  { name: "Insurance", category: "COMMERCIAL" },
  { name: "Office Practice", category: "COMMERCIAL" },
  { name: "Business Studies", category: "COMMERCIAL" },

  // Arts / humanities subjects
  { name: "Literature in English", category: "ARTS" },
  { name: "Government", category: "ARTS" },
  { name: "History", category: "ARTS" },
  { name: "Christian Religious Studies", category: "ARTS" },
  { name: "Islamic Religious Studies", category: "ARTS" },
  { name: "French", category: "ARTS" },
  { name: "Visual Arts", category: "ARTS" },
  { name: "Music", category: "ARTS" },
  { name: "Nigerian Language", category: "ARTS" },
];

const classGroups = [
  {
    name: "JSS 1",
    id: CLASSES.JSS1,
    subjects: juniorSubjects,
  },
  {
    name: "JSS 2",
    id: CLASSES.JSS2,
    subjects: juniorSubjects,
  },
  {
    name: "JSS 3",
    id: CLASSES.JSS3,
    subjects: juniorSubjects,
  },
  {
    name: "SS 1",
    id: CLASSES.SS1,
    subjects: seniorSubjects,
  },
  {
    name: "SS 2",
    id: CLASSES.SS2,
    subjects: seniorSubjects,
  },
  {
    name: "SS 3",
    id: CLASSES.SS3,
    subjects: seniorSubjects,
  },
];

async function seedSubjects() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined in your .env file");
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  try {
    // Validate the supplied IDs before seeding.
    const validIds = [CREATED_BY, ...Object.values(CLASSES)].every((id) =>
      mongoose.isValidObjectId(id),
    );

    if (!validIds) {
      throw new Error("One or more supplied MongoDB IDs are invalid");
    }

    // Verify the creator exists.
    const creatorExists = await User.exists({
      _id: CREATED_BY,
    });

    if (!creatorExists) {
      throw new Error(`Creator user ${CREATED_BY} does not exist`);
    }

    // Confirm all six classes exist before writing anything.
    const existingClasses = await Class.countDocuments({
      _id: { $in: Object.values(CLASSES) },
    });

    if (existingClasses !== 6) {
      throw new Error(
        `Expected 6 classes, but found ${existingClasses}. Check the supplied class IDs.`,
      );
    }

    let totalSeeded = 0;

    for (const schoolClass of classGroups) {
      const operations = schoolClass.subjects.map((subject, index) => {
        const slug = createSlug(subject.name);

        return {
          updateOne: {
            filter: {
              classId: schoolClass.id,
              slug,
            },
            update: {
              $set: {
                name: subject.name,
                category: subject.category,
                order: index + 1,
                isActive: true,
              },
              $setOnInsert: {
                classId: new mongoose.Types.ObjectId(schoolClass.id),
                slug,
                createdBy: new mongoose.Types.ObjectId(CREATED_BY),
                description: `${subject.name} for ${schoolClass.name}`,
              },
            },
            upsert: true,
          },
        };
      });

      const result = await Subject.bulkWrite(operations);

      totalSeeded += result.upsertedCount + result.modifiedCount;

      console.log(
        `✓ ${schoolClass.name}: ` +
          `${result.upsertedCount} created, ` +
          `${result.modifiedCount} updated`,
      );
    }

    console.log(
      `\nSubject seeding completed. ` +
        `${totalSeeded} subjects created or updated.`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

seedSubjects().catch((error) => {
  console.error("Subject seeding failed:", error);
  process.exitCode = 1;
});
