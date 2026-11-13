import dotenv from "dotenv";
import mongoose from "mongoose";
import Subject from "../models/Subject.ts";
import Topic from "../models/Topic.ts";
import { createSlug } from "../utils/createSlug.ts";

dotenv.config();

const CREATED_BY = "6ac62ef39d388499b8f1f7ca";
const TERMS = ["FIRST", "SECOND", "THIRD"] as const;
type Term = (typeof TERMS)[number];

const SUBJECTS = [
  {
    id: "6ac776104c5db40a24154c22",
    className: "JSS 1",
    name: "English Language",
  },
  {
    id: "6ac776104c5db40a24154c23",
    className: "JSS 1",
    name: "Mathematics",
  },
  {
    id: "6ac776104c5db40a24154c24",
    className: "JSS 1",
    name: "Basic Science",
  },
  {
    id: "6ac776104c5db40a24154c25",
    className: "JSS 1",
    name: "Basic Technology",
  },
  {
    id: "6ac776104c5db40a24154c26",
    className: "JSS 1",
    name: "Computer Studies",
  },
  {
    id: "6ac776104c5db40a24154c27",
    className: "JSS 1",
    name: "Social Studies",
  },
  {
    id: "6ac776104c5db40a24154c28",
    className: "JSS 1",
    name: "Civic Education",
  },
  {
    id: "6ac776104c5db40a24154c29",
    className: "JSS 1",
    name: "Business Studies",
  },
  {
    id: "6ac776104c5db40a24154c2a",
    className: "JSS 1",
    name: "Agricultural Science",
  },
  {
    id: "6ac776104c5db40a24154c2b",
    className: "JSS 1",
    name: "Home Economics",
  },
  {
    id: "6ac776104c5db40a24154c2c",
    className: "JSS 1",
    name: "Cultural and Creative Arts",
  },
  {
    id: "6ac776104c5db40a24154c2d",
    className: "JSS 1",
    name: "Physical and Health Education",
  },
  {
    id: "6ac776104c5db40a24154c2e",
    className: "JSS 1",
    name: "Christian Religious Studies",
  },
  {
    id: "6ac776104c5db40a24154c2f",
    className: "JSS 1",
    name: "Islamic Religious Studies",
  },
  {
    id: "6ac776104c5db40a24154c30",
    className: "JSS 1",
    name: "French",
  },
  {
    id: "6ac776104c5db40a24154c31",
    className: "JSS 1",
    name: "Nigerian Language",
  },
  {
    id: "6ac776104c5db40a24154c32",
    className: "JSS 1",
    name: "History",
  },
  {
    id: "6ac776104c5db40a24154c33",
    className: "JSS 1",
    name: "Security Education",
  },
  {
    id: "6ac776104c5db40a24154c34",
    className: "JSS 1",
    name: "Music",
  },
  {
    id: "6ac776104c5db40a24154c35",
    className: "JSS 1",
    name: "Literature",
  },
  {
    id: "6ac776104c5db40a24154c36",
    className: "JSS 2",
    name: "English Language",
  },
  {
    id: "6ac776104c5db40a24154c37",
    className: "JSS 2",
    name: "Mathematics",
  },
  {
    id: "6ac776104c5db40a24154c38",
    className: "JSS 2",
    name: "Basic Science",
  },
  {
    id: "6ac776104c5db40a24154c39",
    className: "JSS 2",
    name: "Basic Technology",
  },
  {
    id: "6ac776104c5db40a24154c3a",
    className: "JSS 2",
    name: "Computer Studies",
  },
  {
    id: "6ac776104c5db40a24154c3b",
    className: "JSS 2",
    name: "Social Studies",
  },
  {
    id: "6ac776104c5db40a24154c3c",
    className: "JSS 2",
    name: "Civic Education",
  },
  {
    id: "6ac776104c5db40a24154c3d",
    className: "JSS 2",
    name: "Business Studies",
  },
  {
    id: "6ac776104c5db40a24154c3e",
    className: "JSS 2",
    name: "Agricultural Science",
  },
  {
    id: "6ac776104c5db40a24154c3f",
    className: "JSS 2",
    name: "Home Economics",
  },
  {
    id: "6ac776104c5db40a24154c40",
    className: "JSS 2",
    name: "Cultural and Creative Arts",
  },
  {
    id: "6ac776104c5db40a24154c41",
    className: "JSS 2",
    name: "Physical and Health Education",
  },
  {
    id: "6ac776104c5db40a24154c42",
    className: "JSS 2",
    name: "Christian Religious Studies",
  },
  {
    id: "6ac776104c5db40a24154c43",
    className: "JSS 2",
    name: "Islamic Religious Studies",
  },
  {
    id: "6ac776104c5db40a24154c44",
    className: "JSS 2",
    name: "French",
  },
  {
    id: "6ac776104c5db40a24154c45",
    className: "JSS 2",
    name: "Nigerian Language",
  },
  {
    id: "6ac776104c5db40a24154c46",
    className: "JSS 2",
    name: "History",
  },
  {
    id: "6ac776104c5db40a24154c47",
    className: "JSS 2",
    name: "Security Education",
  },
  {
    id: "6ac776104c5db40a24154c48",
    className: "JSS 2",
    name: "Music",
  },
  {
    id: "6ac776104c5db40a24154c49",
    className: "JSS 2",
    name: "Literature",
  },
  {
    id: "6ac776114c5db40a24154c4a",
    className: "JSS 3",
    name: "English Language",
  },
  {
    id: "6ac776114c5db40a24154c4b",
    className: "JSS 3",
    name: "Mathematics",
  },
  {
    id: "6ac776114c5db40a24154c4c",
    className: "JSS 3",
    name: "Basic Science",
  },
  {
    id: "6ac776114c5db40a24154c4d",
    className: "JSS 3",
    name: "Basic Technology",
  },
  {
    id: "6ac776114c5db40a24154c4e",
    className: "JSS 3",
    name: "Computer Studies",
  },
  {
    id: "6ac776114c5db40a24154c4f",
    className: "JSS 3",
    name: "Social Studies",
  },
  {
    id: "6ac776114c5db40a24154c50",
    className: "JSS 3",
    name: "Civic Education",
  },
  {
    id: "6ac776114c5db40a24154c51",
    className: "JSS 3",
    name: "Business Studies",
  },
  {
    id: "6ac776114c5db40a24154c52",
    className: "JSS 3",
    name: "Agricultural Science",
  },
  {
    id: "6ac776114c5db40a24154c53",
    className: "JSS 3",
    name: "Home Economics",
  },
  {
    id: "6ac776114c5db40a24154c54",
    className: "JSS 3",
    name: "Cultural and Creative Arts",
  },
  {
    id: "6ac776114c5db40a24154c55",
    className: "JSS 3",
    name: "Physical and Health Education",
  },
  {
    id: "6ac776114c5db40a24154c56",
    className: "JSS 3",
    name: "Christian Religious Studies",
  },
  {
    id: "6ac776114c5db40a24154c57",
    className: "JSS 3",
    name: "Islamic Religious Studies",
  },
  {
    id: "6ac776114c5db40a24154c58",
    className: "JSS 3",
    name: "French",
  },
  {
    id: "6ac776114c5db40a24154c59",
    className: "JSS 3",
    name: "Nigerian Language",
  },
  {
    id: "6ac776114c5db40a24154c5a",
    className: "JSS 3",
    name: "History",
  },
  {
    id: "6ac776114c5db40a24154c5b",
    className: "JSS 3",
    name: "Security Education",
  },
  {
    id: "6ac776114c5db40a24154c5c",
    className: "JSS 3",
    name: "Music",
  },
  {
    id: "6ac776114c5db40a24154c5d",
    className: "JSS 3",
    name: "Literature",
  },
  {
    id: "6ac776114c5db40a24154c5e",
    className: "SS 1",
    name: "English Language",
  },
  {
    id: "6ac776114c5db40a24154c5f",
    className: "SS 1",
    name: "Mathematics",
  },
  {
    id: "6ac776114c5db40a24154c60",
    className: "SS 1",
    name: "Civic Education",
  },
  {
    id: "6ac776114c5db40a24154c61",
    className: "SS 1",
    name: "Computer Studies",
  },
  {
    id: "6ac776114c5db40a24154c62",
    className: "SS 1",
    name: "Agricultural Science",
  },
  {
    id: "6ac776114c5db40a24154c63",
    className: "SS 1",
    name: "Physical and Health Education",
  },
  {
    id: "6ac776114c5db40a24154c64",
    className: "SS 1",
    name: "Biology",
  },
  {
    id: "6ac776114c5db40a24154c65",
    className: "SS 1",
    name: "Chemistry",
  },
  {
    id: "6ac776114c5db40a24154c66",
    className: "SS 1",
    name: "Physics",
  },
  {
    id: "6ac776114c5db40a24154c67",
    className: "SS 1",
    name: "Further Mathematics",
  },
  {
    id: "6ac776114c5db40a24154c68",
    className: "SS 1",
    name: "Geography",
  },
  {
    id: "6ac776114c5db40a24154c69",
    className: "SS 1",
    name: "Technical Drawing",
  },
  {
    id: "6ac776114c5db40a24154c6a",
    className: "SS 1",
    name: "Health Science",
  },
  {
    id: "6ac776114c5db40a24154c6b",
    className: "SS 1",
    name: "Economics",
  },
  {
    id: "6ac776114c5db40a24154c6c",
    className: "SS 1",
    name: "Commerce",
  },
  {
    id: "6ac776114c5db40a24154c6d",
    className: "SS 1",
    name: "Financial Accounting",
  },
  {
    id: "6ac776114c5db40a24154c6e",
    className: "SS 1",
    name: "Marketing",
  },
  {
    id: "6ac776114c5db40a24154c6f",
    className: "SS 1",
    name: "Insurance",
  },
  {
    id: "6ac776114c5db40a24154c70",
    className: "SS 1",
    name: "Office Practice",
  },
  {
    id: "6ac776114c5db40a24154c71",
    className: "SS 1",
    name: "Business Studies",
  },
  {
    id: "6ac776114c5db40a24154c72",
    className: "SS 1",
    name: "Literature in English",
  },
  {
    id: "6ac776114c5db40a24154c73",
    className: "SS 1",
    name: "Government",
  },
  {
    id: "6ac776114c5db40a24154c74",
    className: "SS 1",
    name: "History",
  },
  {
    id: "6ac776114c5db40a24154c75",
    className: "SS 1",
    name: "Christian Religious Studies",
  },
  {
    id: "6ac776114c5db40a24154c76",
    className: "SS 1",
    name: "Islamic Religious Studies",
  },
  {
    id: "6ac776114c5db40a24154c77",
    className: "SS 1",
    name: "French",
  },
  {
    id: "6ac776114c5db40a24154c78",
    className: "SS 1",
    name: "Visual Arts",
  },
  {
    id: "6ac776114c5db40a24154c79",
    className: "SS 1",
    name: "Music",
  },
  {
    id: "6ac776114c5db40a24154c7a",
    className: "SS 1",
    name: "Nigerian Language",
  },
  {
    id: "6ac776114c5db40a24154c7b",
    className: "SS 2",
    name: "English Language",
  },
  {
    id: "6ac776114c5db40a24154c7c",
    className: "SS 2",
    name: "Mathematics",
  },
  {
    id: "6ac776114c5db40a24154c7d",
    className: "SS 2",
    name: "Civic Education",
  },
  {
    id: "6ac776114c5db40a24154c7e",
    className: "SS 2",
    name: "Computer Studies",
  },
  {
    id: "6ac776114c5db40a24154c7f",
    className: "SS 2",
    name: "Agricultural Science",
  },
  {
    id: "6ac776114c5db40a24154c80",
    className: "SS 2",
    name: "Physical and Health Education",
  },
  {
    id: "6ac776114c5db40a24154c81",
    className: "SS 2",
    name: "Biology",
  },
  {
    id: "6ac776114c5db40a24154c82",
    className: "SS 2",
    name: "Chemistry",
  },
  {
    id: "6ac776114c5db40a24154c83",
    className: "SS 2",
    name: "Physics",
  },
  {
    id: "6ac776114c5db40a24154c84",
    className: "SS 2",
    name: "Further Mathematics",
  },
  {
    id: "6ac776114c5db40a24154c85",
    className: "SS 2",
    name: "Geography",
  },
  {
    id: "6ac776114c5db40a24154c86",
    className: "SS 2",
    name: "Technical Drawing",
  },
  {
    id: "6ac776114c5db40a24154c87",
    className: "SS 2",
    name: "Health Science",
  },
  {
    id: "6ac776114c5db40a24154c88",
    className: "SS 2",
    name: "Economics",
  },
  {
    id: "6ac776114c5db40a24154c89",
    className: "SS 2",
    name: "Commerce",
  },
  {
    id: "6ac776114c5db40a24154c8a",
    className: "SS 2",
    name: "Financial Accounting",
  },
  {
    id: "6ac776114c5db40a24154c8b",
    className: "SS 2",
    name: "Marketing",
  },
  {
    id: "6ac776114c5db40a24154c8c",
    className: "SS 2",
    name: "Insurance",
  },
  {
    id: "6ac776114c5db40a24154c8d",
    className: "SS 2",
    name: "Office Practice",
  },
  {
    id: "6ac776114c5db40a24154c8e",
    className: "SS 2",
    name: "Business Studies",
  },
  {
    id: "6ac776114c5db40a24154c8f",
    className: "SS 2",
    name: "Literature in English",
  },
  {
    id: "6ac776114c5db40a24154c90",
    className: "SS 2",
    name: "Government",
  },
  {
    id: "6ac776114c5db40a24154c91",
    className: "SS 2",
    name: "History",
  },
  {
    id: "6ac776114c5db40a24154c92",
    className: "SS 2",
    name: "Christian Religious Studies",
  },
  {
    id: "6ac776114c5db40a24154c93",
    className: "SS 2",
    name: "Islamic Religious Studies",
  },
  {
    id: "6ac776114c5db40a24154c94",
    className: "SS 2",
    name: "French",
  },
  {
    id: "6ac776114c5db40a24154c95",
    className: "SS 2",
    name: "Visual Arts",
  },
  {
    id: "6ac776114c5db40a24154c96",
    className: "SS 2",
    name: "Music",
  },
  {
    id: "6ac776114c5db40a24154c97",
    className: "SS 2",
    name: "Nigerian Language",
  },
  {
    id: "6ac776114c5db40a24154c98",
    className: "SS 3",
    name: "English Language",
  },
  {
    id: "6ac776114c5db40a24154c99",
    className: "SS 3",
    name: "Mathematics",
  },
  {
    id: "6ac776114c5db40a24154c9a",
    className: "SS 3",
    name: "Civic Education",
  },
  {
    id: "6ac776114c5db40a24154c9b",
    className: "SS 3",
    name: "Computer Studies",
  },
  {
    id: "6ac776114c5db40a24154c9c",
    className: "SS 3",
    name: "Agricultural Science",
  },
  {
    id: "6ac776114c5db40a24154c9d",
    className: "SS 3",
    name: "Physical and Health Education",
  },
  {
    id: "6ac776114c5db40a24154c9e",
    className: "SS 3",
    name: "Biology",
  },
  {
    id: "6ac776114c5db40a24154c9f",
    className: "SS 3",
    name: "Chemistry",
  },
  {
    id: "6ac776114c5db40a24154ca0",
    className: "SS 3",
    name: "Physics",
  },
  {
    id: "6ac776114c5db40a24154ca1",
    className: "SS 3",
    name: "Further Mathematics",
  },
  {
    id: "6ac776114c5db40a24154ca2",
    className: "SS 3",
    name: "Geography",
  },
  {
    id: "6ac776114c5db40a24154ca3",
    className: "SS 3",
    name: "Technical Drawing",
  },
  {
    id: "6ac776114c5db40a24154ca4",
    className: "SS 3",
    name: "Health Science",
  },
  {
    id: "6ac776114c5db40a24154ca5",
    className: "SS 3",
    name: "Economics",
  },
  {
    id: "6ac776114c5db40a24154ca6",
    className: "SS 3",
    name: "Commerce",
  },
  {
    id: "6ac776114c5db40a24154ca7",
    className: "SS 3",
    name: "Financial Accounting",
  },
  {
    id: "6ac776114c5db40a24154ca8",
    className: "SS 3",
    name: "Marketing",
  },
  {
    id: "6ac776114c5db40a24154ca9",
    className: "SS 3",
    name: "Insurance",
  },
  {
    id: "6ac776114c5db40a24154caa",
    className: "SS 3",
    name: "Office Practice",
  },
  {
    id: "6ac776114c5db40a24154cab",
    className: "SS 3",
    name: "Business Studies",
  },
  {
    id: "6ac776114c5db40a24154cac",
    className: "SS 3",
    name: "Literature in English",
  },
  {
    id: "6ac776114c5db40a24154cad",
    className: "SS 3",
    name: "Government",
  },
  {
    id: "6ac776114c5db40a24154cae",
    className: "SS 3",
    name: "History",
  },
  {
    id: "6ac776114c5db40a24154caf",
    className: "SS 3",
    name: "Christian Religious Studies",
  },
  {
    id: "6ac776114c5db40a24154cb0",
    className: "SS 3",
    name: "Islamic Religious Studies",
  },
  {
    id: "6ac776114c5db40a24154cb1",
    className: "SS 3",
    name: "French",
  },
  {
    id: "6ac776114c5db40a24154cb2",
    className: "SS 3",
    name: "Visual Arts",
  },
  {
    id: "6ac776114c5db40a24154cb3",
    className: "SS 3",
    name: "Music",
  },
  {
    id: "6ac776114c5db40a24154cb4",
    className: "SS 3",
    name: "Nigerian Language",
  },
] as const;

const TOPICS_BY_SUBJECT: Record<string, Record<Term, string[]>> = {
  "Agricultural Science": {
    FIRST: [
      "Meaning, Scope and Importance of Agriculture",
      "Branches of Agriculture",
      "Types of Farming",
      "Agricultural Tools and Their Uses",
    ],
    SECOND: [
      "Soil Formation and Types of Soil",
      "Soil Fertility and Conservation",
      "Crop Production and Farm Operations",
      "Farm Records and Measurement",
    ],
    THIRD: [
      "Livestock Production",
      "Pests, Diseases and Their Control",
      "Agricultural Marketing and Extension",
      "Agricultural Challenges and Sustainable Practices",
    ],
  },
  "Basic Science": {
    FIRST: [
      "Living and Non-living Things",
      "Characteristics and Classification of Living Things",
      "The Human Body and Its Systems",
      "Matter and Its Properties",
    ],
    SECOND: [
      "Energy, Forms and Transformation",
      "Force and Simple Machines",
      "Air, Water and the Environment",
      "Soil and Its Uses",
    ],
    THIRD: [
      "Plants and Their Functions",
      "Reproduction and Growth",
      "Health, Hygiene and Disease Prevention",
      "Safety, First Aid and Environmental Conservation",
    ],
  },
  "Basic Technology": {
    FIRST: [
      "Introduction to Technology and Safety",
      "Materials and Their Properties",
      "Drawing Instruments and Basic Technical Drawing",
      "Woodwork and Metalwork Tools",
    ],
    SECOND: [
      "Simple Machines and Mechanisms",
      "Building Materials and Construction",
      "Basic Electricity and Electronics",
      "Maintenance of Tools and Equipment",
    ],
    THIRD: [
      "Energy and Power in Technology",
      "Design Process and Problem Solving",
      "Technology in Transportation and Communication",
      "Workshop Projects and Revision",
    ],
  },
  Biology: {
    FIRST: [
      "Characteristics and Classification of Living Things",
      "Cell Structure and Organisation",
      "Nutrition in Plants and Animals",
      "Ecological Concepts",
    ],
    SECOND: [
      "Transport Systems in Plants and Animals",
      "Respiration and Energy Release",
      "Excretion and Homeostasis",
      "Growth, Reproduction and Development",
    ],
    THIRD: [
      "Genetics and Inheritance",
      "Evolution and Adaptation",
      "Ecosystems and Population Studies",
      "Conservation and Environmental Management",
    ],
  },
  "Business Studies": {
    FIRST: [
      "Introduction to Business and Commerce",
      "Office Organisation and Procedures",
      "Communication in Business",
      "Entrepreneurship and Business Opportunities",
    ],
    SECOND: [
      "Bookkeeping and Source Documents",
      "Cash Book and Simple Accounts",
      "Marketing, Trade and Distribution",
      "Consumer Rights and Responsibilities",
    ],
    THIRD: [
      "Business Documents and Correspondence",
      "Banking and Financial Services",
      "Business Ethics and Record Keeping",
      "Small Business Planning and Revision",
    ],
  },
  Chemistry: {
    FIRST: [
      "Nature of Matter and Measurement",
      "Atomic Structure and Periodic Table",
      "Chemical Bonding and Formulae",
      "Chemical Reactions and Equations",
    ],
    SECOND: [
      "Acids, Bases and Salts",
      "Mole Concept and Stoichiometry",
      "States of Matter and Gas Laws",
      "Rates of Reaction and Chemical Equilibrium",
    ],
    THIRD: [
      "Oxidation, Reduction and Electrolysis",
      "Organic Chemistry and Hydrocarbons",
      "Metals, Non-metals and Their Compounds",
      "Environmental Chemistry and Laboratory Practice",
    ],
  },
  "Christian Religious Studies": {
    FIRST: [
      "Creation and God's Relationship with Humanity",
      "Leadership, Obedience and Faith in the Old Testament",
      "Covenants and God's Promises",
      "Prophets and Social Justice",
    ],
    SECOND: [
      "The Birth, Ministry and Teachings of Jesus",
      "Parables and Miracles of Jesus",
      "Death and Resurrection of Jesus",
      "Discipleship and Christian Living",
    ],
    THIRD: [
      "The Early Church and the Apostles",
      "Christian Values and Moral Decisions",
      "Peace, Service and Responsibility",
      "Revision and Application of Biblical Teachings",
    ],
  },
  "Civic Education": {
    FIRST: [
      "Meaning and Importance of Civic Education",
      "Values, Integrity and Self-Reliance",
      "Human Rights and Responsibilities",
      "The Constitution and Rule of Law",
    ],
    SECOND: [
      "Democracy and Democratic Institutions",
      "Citizenship, National Identity and Patriotism",
      "Government and Public Institutions",
      "Elections and Political Participation",
    ],
    THIRD: [
      "Peace, Conflict Resolution and Tolerance",
      "Corruption and Accountability",
      "Traffic Regulations and Public Safety",
      "Community Development and Revision",
    ],
  },
  Commerce: {
    FIRST: [
      "Meaning, Scope and Importance of Commerce",
      "Occupation, Production and Trade",
      "Home Trade and Retailing",
      "Wholesale Trade and Distribution Channels",
    ],
    SECOND: [
      "International Trade and Trade Documents",
      "Transportation, Warehousing and Communication",
      "Banking, Insurance and Financial Services",
      "Advertising and Sales Promotion",
    ],
    THIRD: [
      "Business Units and Forms of Business Ownership",
      "Chambers of Commerce and Trade Associations",
      "Consumer Protection and Trade Regulations",
      "E-commerce and Revision",
    ],
  },
  "Computer Studies": {
    FIRST: [
      "Computer Fundamentals and History",
      "Computer Hardware and Software",
      "Input, Output and Storage Devices",
      "Operating Systems and File Management",
    ],
    SECOND: [
      "Word Processing and Document Formatting",
      "Spreadsheets and Basic Formulas",
      "Presentation Software and Digital Communication",
      "Internet, Research and Online Safety",
    ],
    THIRD: [
      "Algorithms, Flowcharts and Problem Solving",
      "Introduction to Programming Concepts",
      "Databases and Information Management",
      "Cybersecurity, Ethics and Practical Project",
    ],
  },
  "Cultural and Creative Arts": {
    FIRST: [
      "Meaning and Elements of Art",
      "Drawing, Shading and Colour Theory",
      "Music Elements and Rhythm",
      "Nigerian Culture, Festivals and Traditions",
    ],
    SECOND: [
      "Painting, Printmaking and Design",
      "Drama, Storytelling and Performance",
      "Dance, Movement and Choreography",
      "Crafts, Textiles and Local Materials",
    ],
    THIRD: [
      "Sculpture and Three-Dimensional Art",
      "Art Appreciation and Cultural Heritage",
      "Creative Production and Exhibition",
      "Copyright, Careers in the Arts and Revision",
    ],
  },
  Economics: {
    FIRST: [
      "Meaning, Scope and Basic Concepts of Economics",
      "Scarcity, Choice and Opportunity Cost",
      "Demand, Supply and Market Equilibrium",
      "Production, Factors of Production and Productivity",
    ],
    SECOND: [
      "Elasticity of Demand and Supply",
      "Costs, Revenue and Market Structures",
      "Money, Banking and Financial Institutions",
      "National Income and Economic Growth",
    ],
    THIRD: [
      "Inflation, Unemployment and Business Cycles",
      "Public Finance, Taxation and Budgeting",
      "International Trade and Balance of Payments",
      "Economic Development and Nigerian Economic Issues",
    ],
  },
  "English Language": {
    FIRST: [
      "Parts of Speech and Sentence Structure",
      "Reading Comprehension and Vocabulary",
      "Tenses, Concord and Verbs",
      "Essay Writing: Narrative and Descriptive",
    ],
    SECOND: [
      "Phrases, Clauses and Complex Sentences",
      "Summary Writing and Note Making",
      "Formal and Informal Letter Writing",
      "Oral English: Sounds, Stress and Intonation",
    ],
    THIRD: [
      "Argumentative and Expository Writing",
      "Figures of Speech and Literary Devices",
      "Comprehension, Inference and Critical Reading",
      "Speech Writing, Revision and Examination Practice",
    ],
  },
  "Financial Accounting": {
    FIRST: [
      "Introduction to Accounting and Accounting Concepts",
      "Source Documents and Books of Original Entry",
      "Double Entry Principles and Ledger Accounts",
      "Trial Balance and Correction of Errors",
    ],
    SECOND: [
      "Cash Book, Petty Cash and Bank Reconciliation",
      "Depreciation and Provision for Bad Debts",
      "Control Accounts and Subsidiary Ledgers",
      "Trading, Profit and Loss Account",
    ],
    THIRD: [
      "Balance Sheet and Financial Statements",
      "Partnership Accounts",
      "Company Accounts and Shares",
      "Incomplete Records, Interpretation and Revision",
    ],
  },
  French: {
    FIRST: [
      "Alphabet, Greetings and Classroom Expressions",
      "Articles, Nouns, Gender and Number",
      "Present Tense of Common Verbs",
      "Numbers, Dates, Family and Descriptions",
    ],
    SECOND: [
      "Adjectives, Possessives and Demonstratives",
      "Daily Routines, Food and Shopping",
      "Past and Future Tenses",
      "Asking Questions and Giving Directions",
    ],
    THIRD: [
      "Travel, Health and Everyday Situations",
      "Reading Comprehension and Guided Writing",
      "Conversation, Pronunciation and Listening",
      "French Culture, Revision and Oral Practice",
    ],
  },
  "Further Mathematics": {
    FIRST: [
      "Functions, Relations and Graphs",
      "Quadratic Equations and Inequalities",
      "Sequences, Series and Mathematical Induction",
      "Binomial Theorem and Algebraic Techniques",
    ],
    SECOND: [
      "Differentiation and Its Applications",
      "Integration and Area Under Curves",
      "Vectors, Matrices and Transformations",
      "Trigonometric Identities and Equations",
    ],
    THIRD: [
      "Coordinate Geometry and Conic Sections",
      "Complex Numbers and De Moivre's Theorem",
      "Probability Distributions and Statistics",
      "Mechanics, Modelling and Revision",
    ],
  },
  Geography: {
    FIRST: [
      "The Earth, Solar System and Map Reading",
      "Scale, Bearings, Direction and Map Interpretation",
      "Weather, Climate and Atmospheric Processes",
      "Rocks, Minerals and Landforms",
    ],
    SECOND: [
      "Weathering, Erosion and Mass Movement",
      "Rivers, Coasts and Glacial Processes",
      "Population, Settlement and Migration",
      "Agriculture, Mining and Industrial Activities",
    ],
    THIRD: [
      "Transportation, Trade and Urbanisation",
      "Environmental Resources and Conservation",
      "Geography of Nigeria and West Africa",
      "Fieldwork, Data Presentation and Map Skills",
    ],
  },
  Government: {
    FIRST: [
      "Meaning, Scope and Basic Concepts of Government",
      "The State, Nation, Sovereignty and Legitimacy",
      "Constitutions and Constitutional Development",
      "Forms and Systems of Government",
    ],
    SECOND: [
      "Organs of Government and Separation of Powers",
      "Political Parties, Pressure Groups and Public Opinion",
      "Electoral Systems and Political Participation",
      "Public Administration and the Civil Service",
    ],
    THIRD: [
      "Federalism and Intergovernmental Relations",
      "Nigerian Political Development",
      "International Relations and Organisations",
      "Political Ideologies, Governance and Revision",
    ],
  },
  "Health Science": {
    FIRST: [
      "Personal Health, Hygiene and Wellness",
      "Human Body Systems and Their Functions",
      "Nutrition, Balanced Diet and Deficiency Diseases",
      "Growth, Development and Reproductive Health",
    ],
    SECOND: [
      "Communicable and Non-communicable Diseases",
      "First Aid, Safety and Emergency Response",
      "Mental Health and Healthy Relationships",
      "Environmental Health, Sanitation and Waste Management",
    ],
    THIRD: [
      "Substance Use and Abuse Prevention",
      "Family Life and Public Health",
      "Disease Prevention and Health Services",
      "Health Education, Community Outreach and Revision",
    ],
  },
  History: {
    FIRST: [
      "Meaning, Sources and Methods of Studying History",
      "Early Nigerian Societies and Civilisations",
      "Pre-colonial States and Kingdoms",
      "Trade, Migration and Cultural Exchange",
    ],
    SECOND: [
      "European Contact and the Transatlantic Slave Trade",
      "Colonial Rule and Resistance in Nigeria",
      "Nationalism and the Independence Movement",
      "Constitutional Development in Nigeria",
    ],
    THIRD: [
      "Nigeria after Independence",
      "Military Rule and Democratic Transitions",
      "West African Regional History",
      "Historical Evidence, Citizenship and Revision",
    ],
  },
  "Home Economics": {
    FIRST: [
      "Introduction to Home Economics and Family Living",
      "Food Groups, Nutrition and Meal Planning",
      "Kitchen Safety, Hygiene and Food Preparation",
      "Textiles, Fibres and Clothing Care",
    ],
    SECOND: [
      "Food Preservation and Storage",
      "Clothing Construction and Basic Stitches",
      "Home Management, Budgeting and Consumer Choices",
      "Family Relationships and Child Development",
    ],
    THIRD: [
      "Housing, Interior Decoration and Home Safety",
      "Laundry, Clothing Repairs and Care Labels",
      "Entrepreneurship in Home Economics",
      "Practical Projects, Hygiene and Revision",
    ],
  },
  Insurance: {
    FIRST: [
      "Meaning, Principles and Importance of Insurance",
      "Risks, Perils and Risk Management",
      "Types of Insurance and Insurable Interest",
      "Insurance Contracts and Policy Documents",
    ],
    SECOND: [
      "Life and General Insurance",
      "Premiums, Claims and Underwriting",
      "Insurance Intermediaries and Distribution",
      "Insurance Regulation and Consumer Rights",
    ],
    THIRD: [
      "Reinsurance and Pooling of Risks",
      "Marine, Motor and Property Insurance",
      "Social Insurance and Pensions",
      "Insurance Practice, Case Studies and Revision",
    ],
  },
  "Islamic Religious Studies": {
    FIRST: [
      "The Qur'an: Revelation, Preservation and Guidance",
      "Hadith: Meaning, Sources and Importance",
      "Tawhid, Faith and the Articles of Belief",
      "Worship, Purification and Prayer",
    ],
    SECOND: [
      "The Life and Mission of Prophet Muhammad",
      "The Hijrah and Establishment of the Muslim Community",
      "Moral Teachings: Honesty, Justice and Compassion",
      "Zakat, Fasting and Hajj",
    ],
    THIRD: [
      "Islamic Family and Social Responsibilities",
      "Islamic History and the Rightly Guided Caliphs",
      "Peace, Tolerance and Relations with Others",
      "Application of Islamic Teachings and Revision",
    ],
  },
  Literature: {
    FIRST: [
      "Introduction to Literature and Literary Genres",
      "Elements of Prose Fiction",
      "Plot, Setting, Characterisation and Theme",
      "Reading and Analysing Short Stories",
    ],
    SECOND: [
      "Poetry: Form, Rhythm, Imagery and Sound",
      "Drama: Dialogue, Conflict and Stagecraft",
      "Figures of Speech and Literary Devices",
      "Character and Theme Analysis",
    ],
    THIRD: [
      "Narrative Voice, Style and Point of View",
      "Comparative Analysis of Literary Texts",
      "Context, Culture and Interpretation",
      "Critical Essays and Examination Practice",
    ],
  },
  "Literature in English": {
    FIRST: [
      "Literary Genres and Critical Appreciation",
      "Prose: Plot, Setting, Character and Theme",
      "African Prose and Cultural Contexts",
      "Narrative Technique and Point of View",
    ],
    SECOND: [
      "Poetry: Form, Diction, Imagery and Tone",
      "Poetic Devices, Rhythm and Structure",
      "Drama: Conflict, Character and Dramatic Techniques",
      "Themes and Context in Prescribed Texts",
    ],
    THIRD: [
      "Comparative Study of Prescribed Texts",
      "Literary Criticism and Interpretation",
      "Style, Symbolism and Social Issues",
      "Essay Writing and Examination Practice",
    ],
  },
  Marketing: {
    FIRST: [
      "Meaning, Scope and Functions of Marketing",
      "Market Research and Consumer Behaviour",
      "Market Segmentation, Targeting and Positioning",
      "Product Planning, Branding and Packaging",
    ],
    SECOND: [
      "Pricing Methods and Strategies",
      "Channels of Distribution and Logistics",
      "Promotion, Advertising and Public Relations",
      "Personal Selling and Sales Management",
    ],
    THIRD: [
      "Digital Marketing and E-commerce",
      "Marketing Planning and Budgeting",
      "Customer Service and Relationship Management",
      "Marketing Ethics, Case Studies and Revision",
    ],
  },
  Mathematics: {
    FIRST: [
      "Number Bases, Integers and Fractions",
      "Fractions, Decimals, Percentages and Ratios",
      "Algebraic Expressions and Simple Equations",
      "Indices, Standard Form and Approximation",
    ],
    SECOND: [
      "Linear Equations, Inequalities and Graphs",
      "Angles, Polygons and Geometrical Constructions",
      "Perimeter, Area, Surface Area and Volume",
      "Sets, Statistics and Data Representation",
    ],
    THIRD: [
      "Coordinate Geometry and Mensuration",
      "Trigonometry and Pythagoras' Theorem",
      "Probability and Interpretation of Data",
      "Word Problems, Revision and Examination Practice",
    ],
  },
  Music: {
    FIRST: [
      "Elements of Music: Pitch, Rhythm and Tempo",
      "Musical Notation, Staff and Clefs",
      "Scales, Intervals and Simple Melodies",
      "Nigerian Musical Instruments and Ensembles",
    ],
    SECOND: [
      "Time Signatures, Note Values and Rests",
      "Harmony, Chords and Musical Forms",
      "African Music, Dance and Performance Traditions",
      "Composition, Singing and Instrumental Practice",
    ],
    THIRD: [
      "Music History and Major Musical Traditions",
      "Listening Skills and Aural Training",
      "Music Technology, Recording and Production",
      "Performance, Appreciation and Revision",
    ],
  },
  "Nigerian Language": {
    FIRST: [
      "Alphabet, Sounds and Correct Pronunciation",
      "Greetings, Introductions and Everyday Expressions",
      "Nouns, Pronouns and Simple Sentences",
      "Family, Community and Cultural Vocabulary",
    ],
    SECOND: [
      "Verbs, Tenses and Sentence Patterns",
      "Reading Comprehension and Oral Narratives",
      "Proverbs, Idioms, Folktales and Poetry",
      "Writing Short Messages and Descriptions",
    ],
    THIRD: [
      "Traditional Institutions, Festivals and Customs",
      "Extended Reading and Guided Composition",
      "Translation, Conversation and Public Speaking",
      "Language Preservation, Revision and Assessment",
    ],
  },
  "Office Practice": {
    FIRST: [
      "The Office: Functions, Layout and Organisation",
      "Office Equipment, Supplies and Maintenance",
      "Filing Systems and Records Management",
      "Business Communication and Telephone Etiquette",
    ],
    SECOND: [
      "Incoming and Outgoing Mail Procedures",
      "Meetings, Agendas, Minutes and Scheduling",
      "Word Processing, Spreadsheets and Office Technology",
      "Data Protection, Confidentiality and Office Ethics",
    ],
    THIRD: [
      "Stock Control and Office Purchasing",
      "Travel Arrangements and Reception Duties",
      "Customer Service and Workplace Relations",
      "Office Procedures, Practical Tasks and Revision",
    ],
  },
  "Physical and Health Education": {
    FIRST: [
      "Physical Fitness, Wellness and Exercise Principles",
      "Fundamental Motor Skills and Movement",
      "Athletics: Running, Jumping and Throwing",
      "Personal Hygiene, Nutrition and Safety",
    ],
    SECOND: [
      "Team Sports: Rules, Skills and Tactics",
      "Gymnastics, Dance and Recreational Activities",
      "Human Body Responses to Exercise",
      "First Aid, Injury Prevention and Sportsmanship",
    ],
    THIRD: [
      "Individual and Indigenous Sports",
      "Training Methods and Fitness Assessment",
      "Drug Use, Health Risks and Healthy Lifestyle",
      "Sports Organisation, Practical Assessment and Revision",
    ],
  },
  Physics: {
    FIRST: [
      "Physical Quantities, Units and Measurement",
      "Scalars, Vectors and Motion",
      "Force, Equilibrium and Newton's Laws",
      "Work, Energy, Power and Machines",
    ],
    SECOND: [
      "Heat, Temperature and Thermal Expansion",
      "Waves, Sound and Wave Properties",
      "Light, Reflection, Refraction and Lenses",
      "Electric Fields, Current and Circuits",
    ],
    THIRD: [
      "Magnetism and Electromagnetic Induction",
      "Electronics and Electrical Safety",
      "Atomic Physics, Radioactivity and Nuclear Energy",
      "Practical Physics, Graphs and Experimental Skills",
    ],
  },
  "Security Education": {
    FIRST: [
      "Meaning and Importance of Personal Security",
      "Identifying Risks, Hazards and Unsafe Situations",
      "Home, School and Community Safety",
      "Emergency Contacts and Reporting Procedures",
    ],
    SECOND: [
      "Road Safety and Transport Security",
      "Digital Safety, Privacy and Cyberbullying",
      "Conflict Prevention and Peaceful Communication",
      "Fire Safety, First Aid and Emergency Preparedness",
    ],
    THIRD: [
      "Community Policing and Public Safety",
      "Human Trafficking, Abuse and Exploitation Awareness",
      "Disaster Preparedness and Response",
      "Responsible Citizenship, Revision and Practical Drills",
    ],
  },
  "Social Studies": {
    FIRST: [
      "Self, Family and Social Relationships",
      "Culture, Values and Socialisation",
      "Community, Social Institutions and Cooperation",
      "Human Needs, Resources and the Environment",
    ],
    SECOND: [
      "Population, Migration and Settlement",
      "Social Problems and Their Prevention",
      "Leadership, Cooperation and Conflict Resolution",
      "Work, Occupations and Economic Activities",
    ],
    THIRD: [
      "National Integration and Cultural Diversity",
      "Environmental Problems and Sustainable Living",
      "Globalisation, Media and Social Change",
      "Community Project, Citizenship and Revision",
    ],
  },
  "Technical Drawing": {
    FIRST: [
      "Drawing Instruments, Lines and Lettering",
      "Geometrical Constructions and Plane Figures",
      "Scales, Dimensioning and Orthographic Principles",
      "Orthographic Projection of Simple Solids",
    ],
    SECOND: [
      "Isometric and Oblique Drawing",
      "Sectional Views and Auxiliary Views",
      "Loci, Tangencies and Engineering Curves",
      "Developments and Intersections of Solids",
    ],
    THIRD: [
      "Assembly and Exploded Drawings",
      "Building and Structural Drawing Basics",
      "Interpretation of Working Drawings",
      "CAD Fundamentals, Drawing Practice and Revision",
    ],
  },
  "Visual Arts": {
    FIRST: [
      "Elements and Principles of Visual Art",
      "Drawing, Observation and Shading",
      "Colour Theory, Mixing and Application",
      "Design, Pattern and Composition",
    ],
    SECOND: [
      "Painting Media, Techniques and Styles",
      "Sculpture, Modelling and Three-Dimensional Form",
      "Printmaking and Reproduction Techniques",
      "Textiles, Crafts and Indigenous Art Forms",
    ],
    THIRD: [
      "Art History and Nigerian Art Traditions",
      "Art Criticism, Appreciation and Interpretation",
      "Portfolio Development and Exhibition Planning",
      "Digital Art, Careers and Revision",
    ],
  },
};

async function seedTopics() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from environment variables.");
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB.");

  const subjectIds = SUBJECTS.map((subject) => subject.id);
  const existingSubjects = await Subject.find({ _id: { $in: subjectIds } })
    .select("_id name classId")
    .lean()
    .exec();

  const existingById = new Map(
    existingSubjects.map((subject) => [String(subject._id), subject]),
  );

  const missingSubjectIds = SUBJECTS.filter(
    (subject) => !existingById.has(subject.id),
  );
  if (missingSubjectIds.length) {
    console.warn(
      `Warning: ${missingSubjectIds.length} subject IDs from the supplied export were not found in the database.`,
    );
    for (const subject of missingSubjectIds) {
      console.warn(
        `Missing ${subject.className} / ${subject.name}: ${subject.id}`,
      );
    }
  }

  const operations: Parameters<typeof Topic.bulkWrite>[0] = [];
  let plannedTopics = 0;

  for (const subjectRef of SUBJECTS) {
    const subject = existingById.get(subjectRef.id);
    if (!subject) continue;

    const termTopics = TOPICS_BY_SUBJECT[subjectRef.name];
    if (!termTopics) {
      console.warn(
        `No topic template for subject: ${subjectRef.name} (${subjectRef.id})`,
      );
      continue;
    }

    for (const term of TERMS) {
      for (const [index, title] of termTopics[term].entries()) {
        const slug = createSlug(title);

        operations.push({
          updateOne: {
            filter: {
              subjectId: new mongoose.Types.ObjectId(subjectRef.id),
              term,
              slug,
            },
            update: {
              $set: {
                title,
                order: index + 1,
                isActive: true,
              },
              $setOnInsert: {
                subjectId: new mongoose.Types.ObjectId(subjectRef.id),
                term,
                slug,
                description: `${title} — ${term.toLowerCase()} term starter topic for ${subjectRef.className}`,
                createdBy: new mongoose.Types.ObjectId(CREATED_BY),
              },
            },
            upsert: true,
          },
        });
        plannedTopics += 1;
      }
    }
  }

  if (operations.length === 0) {
    console.log(
      "No topic operations generated. Check the supplied subject IDs.",
    );
    return;
  }

  const result = await Topic.bulkWrite(operations, { ordered: false });
  console.log("Topic seeding complete.");
  console.log(`Subjects in export: ${SUBJECTS.length}`);
  console.log(`Subjects found in database: ${existingSubjects.length}`);
  console.log(`Topic records planned: ${plannedTopics}`);
  console.log(`Inserted: ${result.upsertedCount}`);
  console.log(`Updated: ${result.modifiedCount}`);
  console.log(
    "Existing matching topics are updated/upserted; unrelated topics are not deleted.",
  );
}

seedTopics()
  .catch((error) => {
    console.error("Topic seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
