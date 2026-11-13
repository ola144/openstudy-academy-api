import "dotenv/config";
import mongoose from "mongoose";
import Topic from "../models/Topic.ts";
import Subject from "../models/Subject.ts";
import Lesson, { ContentBlockType, LessonStatus } from "../models/Lesson.ts";
import { createSlug } from "../utils/createSlug.ts";

const CREATED_BY = "6ac62ef39d388499b8f1f7ca";
const DEFAULT_ESTIMATED_MINUTES = 35;

type TopicSeed = {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  description?: string;
  subjectId: mongoose.Types.ObjectId;
  term: "FIRST" | "SECOND" | "THIRD";
  order?: number;
};

type SubjectSeed = {
  _id: mongoose.Types.ObjectId;
  name: string;
  classId?: mongoose.Types.ObjectId;
};

type ContentBlock = {
  type: (typeof ContentBlockType)[keyof typeof ContentBlockType];
  text?: string;
  caption?: string;
  items?: string[];
};

function classLabel(classId?: mongoose.Types.ObjectId): string {
  // Optional mapping can be extended if your Class model uses different IDs.
  const id = String(classId ?? "");
  const known: Record<string, string> = {
    "6ac52119adcf29609cb7bdd7": "JSS 1",
    "6ac5211aadcf29609cb7bdd8": "JSS 2",
    "6ac5211aadcf29609cb7bdd9": "JSS 3",
    "6ac5211aadcf29609cb7bdda": "SS 1",
    "6ac5211aadcf29609cb7bddb": "SS 2",
    "6ac5211badcf29609cb7bddc": "SS 3",
  };
  return known[id] ?? "secondary school";
}

function subjectApproach(
  subjectName: string,
  title: string,
): {
  explanation: string;
  example: string;
  activity: string;
  application: string;
} {
  const s = `${subjectName} ${title}`.toLowerCase();

  if (
    /mathematics|further mathematics|algebra|fraction|equation|geometry|trigonometry|statistics|probability|number|mensuration|ratio|indices|graph/.test(
      s,
    )
  ) {
    return {
      explanation: `Begin by identifying the mathematical terms and symbols in “${title}”. Explain what each term means, state any relevant rule or formula, and show how the rule is used step by step. Encourage learners to write each stage of a calculation clearly and check whether the answer is reasonable.`,
      example: `Worked approach: (1) write down the information given; (2) identify the rule or formula that applies; (3) substitute the known values; (4) calculate carefully; and (5) check the result using estimation or the reverse operation. Use simple numbers first, then increase the difficulty.`,
      activity: `Learners solve three guided questions on “${title}”: one introductory question, one routine application, and one word problem. They compare methods in pairs and explain why each step is valid.`,
      application: `Connect the concept to everyday situations such as shopping and change, measuring a room or field, sharing quantities, interpreting school data, or planning a budget, depending on the topic.`,
    };
  }
  if (
    /biology|basic science|health science|agricultural science|living|plant|animal|human body|reproduction|matter|energy|environment|soil|water|air|disease|hygiene|ecology|organism/.test(
      s,
    )
  ) {
    return {
      explanation: `Introduce “${title}” using familiar examples from the home, school, farm, or local environment. Define the main scientific terms, describe the relevant process or characteristics in sequence, and distinguish observations from explanations. Where appropriate, explain the relationship between structure, function, and the environment.`,
      example: `Example investigation: ask learners to observe a safe, familiar object or living thing related to the topic. Record what is seen, group the observations, suggest an explanation, and state one way the explanation could be checked. Emphasise safety, accurate recording, and respect for living things.`,
      activity: `In small groups, learners draw and label a relevant diagram or create a table with the key terms, descriptions, and examples for “${title}”. Each group presents one observation and explains its importance.`,
      application: `Relate the lesson to health, sanitation, farming, safe use of resources, conservation, or understanding the natural world as appropriate to the topic.`,
    };
  }
  if (
    /physics|chemistry|force|motion|electric|machine|power|chemical|atom|element|compound|mixture|reaction|heat|light|sound|magnet|pressure/.test(
      s,
    )
  ) {
    return {
      explanation: `Explain “${title}” by defining the important terms and describing the underlying principle. Identify the materials, quantities, or conditions involved and explain how changing one factor may affect the outcome. Distinguish a scientific observation from an inference and introduce any formula or symbol required by the topic.`,
      example: `Demonstration: use a simple, safe classroom example to illustrate the principle. Ask learners to predict what will happen, observe the result, record it, and compare the result with their prediction. Do not carry out electrical, chemical, heating, or mechanical demonstrations without appropriate supervision and safety procedures.`,
      activity: `Learners prepare a labelled diagram or observation table for “${title}”, identify the principle shown, and answer questions that ask them to explain both what happened and why.`,
      application: `Discuss where the principle appears in household equipment, transport, building, energy use, communication, or other familiar technology relevant to the lesson.`,
    };
  }
  if (
    /english|language|grammar|speech|oral|comprehension|vocabulary|essay|writing|letter|sentence|clause|verb|tenses|concord|literature|poetry|prose|drama|figure of speech/.test(
      s,
    )
  ) {
    return {
      explanation: `Explain “${title}” and introduce its key terms with clear examples. Model the skill before asking learners to practise independently. Where language is involved, draw attention to meaning, organisation, audience, grammar, punctuation, and appropriate word choice. Invite learners to explain how the examples demonstrate the concept.`,
      example: `Model example: present a short passage, sentence, paragraph, or oral example related to “${title}”. Work through it with the class, identify the important features, and revise one weak example together to show how clarity and correctness can improve.`,
      activity: `Learners complete a short individual task related to “${title}”, exchange work with a partner, and use a checklist to identify strengths and one improvement. Invite a few learners to share their answers and explain their choices.`,
      application: `Explain how the skill helps learners communicate clearly at school, at home, in the community, and in formal or informal situations.`,
    };
  }
  if (
    /computer|information technology|digital|internet|programming|algorithm|database|spreadsheet|word processing|presentation|cybersecurity|file management/.test(
      s,
    )
  ) {
    return {
      explanation: `Introduce “${title}” and explain the purpose of the relevant computer concept, tool, or process. Define the key terms, identify the main components, and demonstrate the correct sequence of steps. Emphasise responsible use of devices, protection of personal information, and saving work safely.`,
      example: `Demonstration: show a simple task related to “${title}”, explaining each step and the expected result. If devices are unavailable, use a labelled drawing, printed screenshots, or a paper-based simulation. Ask learners to identify common errors and how to correct them.`,
      activity: `Learners write the steps for completing a small task related to “${title}”, then perform or simulate those steps in pairs. They should state the expected output and one safety or responsible-use rule.`,
      application: `Connect the lesson to school assignments, record keeping, communication, research, problem-solving, or protecting accounts and devices, as appropriate to the topic.`,
    };
  }
  if (
    /business|commerce|accounting|economics|marketing|insurance|office practice|entrepreneur|trade|finance|bookkeeping/.test(
      s,
    )
  ) {
    return {
      explanation: `Define “${title}” and explain its purpose in business or economic life. Identify the people, records, resources, or decisions involved, then describe the main process in a logical order. Clarify important vocabulary and distinguish related concepts that learners may confuse.`,
      example: `Worked example: use a small, realistic school or neighbourhood business scenario. Identify the information available, explain the decision or record required, work through the steps, and interpret the result. Use fictional figures and make all assumptions clear.`,
      activity: `In pairs, learners analyse a short scenario involving “${title}”. They identify the issue, list the relevant facts, recommend an appropriate action, and explain one likely consequence of their decision.`,
      application: `Relate the concept to responsible spending, saving, small businesses, markets, record keeping, customer service, or informed economic decisions, as appropriate.`,
    };
  }
  if (
    /history|government|civic|social studies|geography|religious|christian|islamic|security education|citizenship|culture|community/.test(
      s,
    )
  ) {
    return {
      explanation: `Introduce “${title}” by defining the central terms and explaining the people, places, institutions, beliefs, or events involved. Present information in a clear sequence and distinguish facts, interpretations, responsibilities, and examples. Encourage respectful discussion when viewpoints or traditions differ.`,
      example: `Case study: consider a familiar community or Nigerian example related to “${title}”. Identify the people or institutions involved, describe the issue or event, explain its causes or purpose, and discuss its effects or significance. Avoid treating one example as representative of every community.`,
      activity: `Learners create a short timeline, labelled map, comparison table, or cause-and-effect chart suited to “${title}”. They present their work and support their explanation with details from the lesson.`,
      application: `Discuss how the lesson can support responsible citizenship, community participation, cultural understanding, peaceful cooperation, or informed decisions in everyday life.`,
    };
  }
  if (
    /agriculture|farm|crop|livestock|food|nutrition|home economics|clothing|textile|cooking|family/.test(
      s,
    )
  ) {
    return {
      explanation: `Explain “${title}” through familiar home, food, farm, or community examples. Define the important terms, identify the resources or tools involved, and describe the recommended procedure in the correct order. Highlight hygiene, safe handling, resource conservation, and responsible practice where relevant.`,
      example: `Practical example: plan or demonstrate a small task related to “${title}”. Identify the materials needed, list the steps, describe the expected result, and explain how to work safely and avoid waste. Use real tools or materials only with appropriate supervision.`,
      activity: `Learners prepare a labelled chart or practical plan for “${title}”, including materials, procedure, expected outcome, and at least two safety or care instructions.`,
      application: `Connect the lesson to healthy living, household management, food production, nutrition, farming, or responsible use of resources as appropriate.`,
    };
  }
  return {
    explanation: `Introduce “${title}” by explaining its meaning, purpose, and importance within ${subjectName}. Define the main terms, break the topic into manageable ideas, and explain how those ideas relate to one another. Use familiar examples and check understanding before moving to the next concept.`,
    example: `Worked example: present a realistic situation related to “${title}”. Identify the main issue, apply the concept step by step, and explain why the chosen approach is suitable. Invite learners to suggest an alternative example and compare the results.`,
    activity: `Learners work individually or in pairs to create a short explanation, labelled diagram, comparison table, or solution related to “${title}”. They share their work and answer follow-up questions from classmates.`,
    application: `Ask learners to identify where “${title}” may be useful in school, at home, or in the wider community, and explain one practical benefit of understanding it.`,
  };
}

function buildLesson(
  topic: TopicSeed,
  subject: SubjectSeed,
  className: string,
) {
  const title = topic.title.trim();
  const approach = subjectApproach(subject.name, title);
  const termLabel = topic.term
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
  const objectives = [
    `Define ${title.toLowerCase()} and explain its main purpose or meaning.`,
    `Identify and describe the key concepts and vocabulary associated with ${title.toLowerCase()}.`,
    `Apply the ideas in ${title.toLowerCase()} to an appropriate example or activity.`,
    `Answer questions that demonstrate understanding of ${title.toLowerCase()}.`,
  ];

  const content: ContentBlock[] = [
    {
      type: ContentBlockType.TEXT,
      text: `LESSON OVERVIEW\nSubject: ${subject.name}\nClass: ${className}\nTerm: ${termLabel}\nTopic: ${title}\n\n${topic.description || `This lesson introduces ${title.toLowerCase()} in ${subject.name}.`} The lesson is designed to build understanding through explanation, examples, guided practice, and a short review.`,
    },
    {
      type: ContentBlockType.TEXT,
      text: `LEARNING OBJECTIVES\nBy the end of the lesson, learners should be able to:\n${objectives.map((item, i) => `${i + 1}. ${item}`).join("\n")}`,
    },
    {
      type: ContentBlockType.TEXT,
      text: `INTRODUCTION\nBegin with a short question about something learners may already know that connects to ${title.toLowerCase()}. Invite a few responses, correct misunderstandings gently, and explain why the topic matters. Introduce the lesson vocabulary before presenting the main explanation.`,
    },
    {
      type: ContentBlockType.TEXT,
      text: `MAIN LESSON\n${approach.explanation}\n\nKEY IDEAS TO REMEMBER\n• Understand the meaning of each key term before memorising details.\n• Connect each new idea to an example.\n• Explain the reason behind a process or answer, not only the final result.\n• Ask for clarification whenever a step or term is unclear.`,
    },
    {
      type: ContentBlockType.TEXT,
      text: `ILLUSTRATION / WORKED EXAMPLE\n${approach.example}`,
    },
    {
      type: ContentBlockType.TEXT,
      text: `GUIDED PRACTICE\n${approach.activity}`,
    },
    {
      type: ContentBlockType.TEXT,
      text: `REAL-LIFE CONNECTION\n${approach.application}`,
    },
    {
      type: ContentBlockType.TEXT,
      text: `LESSON SUMMARY\nIn this lesson, learners explored ${title.toLowerCase()} in ${subject.name}. They considered its key vocabulary, examined an example, and practised applying the ideas. Before the next lesson, learners should review their notes and be able to explain the main concept in their own words.`,
    },
    {
      type: ContentBlockType.TEXT,
      text: `ASSESSMENT / REVIEW QUESTIONS\n1. What is meant by ${title.toLowerCase()}?\n2. State and explain two important ideas covered in the lesson.\n3. Give one example related to ${title.toLowerCase()}.\n4. Apply what you have learnt to a new situation. Explain your answer.\n5. Which part of the lesson do you need to practise further, and why?\n\nHOMEWORK\nWrite a short explanation of ${title.toLowerCase()}, include two relevant examples, and prepare one question to ask during the next lesson.`,
    },
  ];

  return {
    title,
    slug: createSlug(title),
    topicId: topic._id,
    summary: `A ${className} ${subject.name} lesson introducing ${title.toLowerCase()}, with objectives, explanations, examples, guided practice, and review questions.`,
    objectives,
    content,
    estimatedMinutes: DEFAULT_ESTIMATED_MINUTES,
    status: LessonStatus.DRAFT,
    createdBy: new mongoose.Types.ObjectId(CREATED_BY),
  };
}

async function seedLessons() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from your .env file");
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  const [topics, subjects] = await Promise.all([
    Topic.find({ isActive: { $ne: false } })
      .select("_id title slug description subjectId term order")
      .sort({ subjectId: 1, term: 1, order: 1 })
      .lean<TopicSeed[]>(),
    Subject.find({}).select("_id name classId").lean<SubjectSeed[]>(),
  ]);

  const subjectMap = new Map(
    subjects.map((subject) => [String(subject._id), subject]),
  );
  const missingSubjects = new Set<string>();
  const operations: Parameters<typeof Lesson.bulkWrite>[0] = [];

  for (const topic of topics) {
    const subject = subjectMap.get(String(topic.subjectId));
    if (!subject) {
      missingSubjects.add(String(topic.subjectId));
      continue;
    }

    const lesson = buildLesson(topic, subject, classLabel(subject.classId));
    operations.push({
      updateOne: {
        // One starter lesson per topic. The topic's actual MongoDB _id is used.
        filter: { topicId: topic._id, slug: lesson.slug },
        update: {
          $set: {
            title: lesson.title,
            summary: lesson.summary,
            objectives: lesson.objectives,
            content: lesson.content,
            estimatedMinutes: lesson.estimatedMinutes,
            // Seeded lessons remain drafts until a teacher reviews them.
            status: LessonStatus.DRAFT,
          },
          $setOnInsert: {
            topicId: topic._id,
            slug: lesson.slug,
            createdBy: lesson.createdBy,
          },
          $unset: { publishedAt: "" },
        },
        upsert: true,
      },
    });
  }

  if (operations.length) {
    const result = await Lesson.bulkWrite(operations, { ordered: false });
    console.log(`Topics found: ${topics.length}`);
    console.log(`Lessons upserted: ${result.upsertedCount}`);
    console.log(`Lessons modified: ${result.modifiedCount}`);
    console.log(`Lessons matched: ${result.matchedCount}`);
  } else {
    console.log("No lessons to seed. Check that Topic documents exist.");
  }

  if (missingSubjects.size) {
    console.warn("Skipped topics because their subject was not found:");
    console.warn([...missingSubjects].join("\n"));
  }

  await mongoose.disconnect();
  console.log("Lesson seeding completed");
}

seedLessons().catch(async (error) => {
  console.error("Lesson seeding failed:", error);
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
