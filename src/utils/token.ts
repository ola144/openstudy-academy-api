import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import crypto from "crypto";

// Function to generate a JWT token
export const generateToken = (userId: string) => {
  const jwtSecret = process.env.JWT_SECRET || "dev-secret";
  const expiresIn = process.env.JWT_EXPIRES_IN as
    | SignOptions["expiresIn"]
    | undefined;

  return jwt.sign(
    {
      id: userId,
    },
    jwtSecret,
    {
      expiresIn,
    },
  );
};

// Store token in cookie
export function storeTokenInCookie(
  res: any,
  token: string,
  cookieName: string,
): void {
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // true
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    // || "none",
    path: "/",
    maxAge: 7 * 60 * 60 * 1000,
    // expires: new Date(Date.now() + 7 * 60 * 60 * 1000), // 7 hours
    // expires: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
  });
}

export const generateRandomToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

export const hashToken = (token: any) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};
