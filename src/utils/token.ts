import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import crypto from "crypto";

interface TokenPayload {
  sub: string;
  role: string;
  companyId?: string;
}

const isProduction = process.env.NODE_ENV === "production";

export const accessCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? ("none" as const) : ("lax" as const),
  path: "/api/v1",
  maxAge: 15 * 60 * 1000,
};

export const refreshCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? ("none" as const) : ("lax" as const),
  path: "/api/v1/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// Function to generate a JWT token
export const generateToken = (userId: string) => {
  const jwtSecret = process.env.JWT_SECRET || "dev-secret";
  const expiresIn = (process.env.JWT_EXPIRES_IN || "15m") as
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
  options = {},
): void {
  res.cookie(
    cookieName,
    token,
    options,
    //   {
    //   httpOnly: true,
    //   secure: process.env.NODE_ENV === "production",
    //   // true
    //   sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    //   // || "none",
    //   path: "/api/v1/auth",
    //   maxAge: 7 * 60 * 60 * 1000,
    //   // expires: new Date(Date.now() + 7 * 60 * 60 * 1000), // 7 hours
    //   // expires: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    // }
  );
}

export const generateRandomToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

export const hashToken = (token: any) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

export const generateRefreshToken = (userId: string) => {
  const jwtSecret = process.env.REFRESH_TOKEN_SECRET || "dev-secret";
  const expiresIn = (process.env.REFRESH_TOKEN_EXPIRES_IN || "7d") as
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

export const verifyRefreshToken = (token: string) => {
  const jwtSecret = process.env.REFRESH_TOKEN_SECRET || "dev-secret";

  return jwt.verify(token, jwtSecret) as jwt.JwtPayload;
};
