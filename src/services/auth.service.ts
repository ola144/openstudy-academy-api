import User from "../models/User.ts";
import {
  generateRefreshToken,
  generateToken,
  verifyRefreshToken,
} from "../utils/token.ts";
import jwt from "jsonwebtoken";

export const refreshAccessToken = async (refreshToken: string) => {
  if (!refreshToken) {
    throw new Error("Refresh token is required.");
  }

  let decoded: jwt.JwtPayload;

  try {
    const verified = verifyRefreshToken(refreshToken);

    if (
      typeof verified === "string" ||
      !verified.id ||
      typeof verified.id !== "string"
    ) {
      throw new Error("Invalid refresh token payload.");
    }

    decoded = verified;
  } catch {
    throw new Error("Invalid or expired refresh token.");
  }

  const user = await User.findById(decoded.id);

  if (!user) {
    throw new Error("User account not found.");
  }

  if (!user.isActive) {
    throw new Error("Your account has been deactivated.");
  }

  const accessToken = generateToken(user._id.toString());

  const newRefreshToken = generateRefreshToken(user._id.toString());

  return {
    accessToken,
    refreshToken: newRefreshToken,
  };
};
