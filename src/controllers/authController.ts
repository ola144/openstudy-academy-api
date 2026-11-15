import type { Request, Response, NextFunction } from "express";
import User from "../models/User.ts";
import * as teacherService from "../services/admin.teacher.ts";
import { sendVerificationEmail } from "../utils/email.ts";
import {
  accessCookieOptions,
  generateRandomToken,
  generateToken,
  hashToken,
  refreshCookieOptions,
  storeTokenInCookie,
} from "../utils/token.ts";
import {
  LOGIN_BLOCK_DURATION_MS,
  MAX_FAILED_LOGIN_ATTEMPTS,
} from "../utils/authSecurity.ts";
import { refreshAccessToken } from "../services/auth.service.ts";

const register = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, password, role, classId, department } =
      req.body;

    // Check if the user already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }

    const verificationToken = generateRandomToken();

    const hashedVerificationToken = hashToken(verificationToken);

    // Create a new user
    const newUser = new User({
      firstName,
      lastName,
      email,
      classId,
      department,
      password,
      emailVerificationToken: hashedVerificationToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      role,
    });

    await newUser.save();

    await sendVerificationEmail(
      email,
      `${firstName} ${lastName}`,
      verificationToken,
    );

    res.status(201).json({
      success: true,
      message:
        "Registration successful. Please check your email to verify your account.",
    });
  } catch (error: any) {
    console.error("Error during registration:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Find the user by email
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email or password" });
    }

    const now = new Date();

    if (
      user.loginBlockedUntil &&
      user.loginBlockedUntil.getTime() > now.getTime()
    ) {
      return res.status(429).json({
        success: false,
        message: "Unable to log in right now. Please try again later.",
      });
    }

    if (
      user.loginBlockedUntil &&
      user.loginBlockedUntil.getTime() <= now.getTime()
    ) {
      user.failedLoginAttempts = 0;
      user.loginBlockedUntil = null;
    }

    // Compare the provided password with the hashed password in the database
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      user.failedLoginAttempts = (user.failedLoginAttempts ?? 0) + 1;

      if (user.failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
        user.loginBlockedUntil = new Date(Date.now() + LOGIN_BLOCK_DURATION_MS);
      }

      await user.save();

      return res
        .status(400)
        .json({ success: false, message: "Invalid email or password. " });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email first",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account is deactivated. Reach to admin for more info.",
      });
    }

    user.failedLoginAttempts = 0;
    user.loginBlockedUntil = null;

    await user.save();

    const token = generateToken(user._id.toString());

    // Store the token in a cookie
    storeTokenInCookie(res, token, "accessToken", accessCookieOptions);

    await User.findByIdAndUpdate(user._id, {
      lastLoginAt: new Date(),
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error("Error during login:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

const logout = async (req: Request, res: Response) => {
  try {
    // Clear the accessToken cookie
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    res.status(200).json({ success: true, message: "Logout successful" });
  } catch (error: any) {
    console.error("Error during logout:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const hashedToken = hashToken(token);

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: {
        $gt: new Date(),
      },
    }).select("+emailVerificationToken +emailVerificationExpires");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification link!",
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Email verified successsfully!",
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

const getMe = async (req: any, res: Response) => {
  try {
    return res.status(200).json({
      success: true,
      message: "User fetched successfully!",
      user: {
        id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
        classId: req.user.classId?.toString(),
        isEmailVerified: req.user.isEmailVerified,
      },
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to get user",
    });
  }
};

const createPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await teacherService.createPassword(req.body);

    return res.status(200).json({
      success: true,
      message: "Password created successfully",
    });
  } catch (error: any) {
    next(error);
    res.status(400).json({
      success: false,
      message: error.message || "Internal server error!",
    });
  }
};

const resendPasswordCreation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await teacherService.resendTeacherInvitation(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Password creation resent successfully",
    });
  } catch (error: any) {
    next(error);
    res.status(400).json({
      success: false,
      message: error.message || "Internal server error!",
    });
  }
};

const refreshTokenController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token not provided.",
      });
    }

    const result = await refreshAccessToken(refreshToken);

    storeTokenInCookie(
      res,
      result.refreshToken,
      "refreshToken",
      refreshCookieOptions,
    );
    storeTokenInCookie(
      res,
      result.accessToken,
      "accessToken",
      accessCookieOptions,
    );

    return res.status(200).json({
      success: true,
      message: "Token refreshed successfully.",
    });
  } catch (error) {
    next(error);
  }
};

export {
  register,
  login,
  logout,
  verifyEmail,
  getMe,
  createPassword,
  resendPasswordCreation,
  refreshTokenController,
};
