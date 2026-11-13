import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
const url = process.env.MONGODB_URI ?? "";

const connectDB = async () => {
  try {
    const connection = await mongoose.connect(url, {
      allowPartialTrustChain: true,
    });

    console.log(`MongoDB connected: ${connection.connection.host}`);
  } catch (error: any) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

export default connectDB;
