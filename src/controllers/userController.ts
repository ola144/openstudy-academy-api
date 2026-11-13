import User from "../models/User.ts";
import type { NextFunction, Response } from "express";
import { type AuthenticatedRequest } from "../utils/auth.type.ts";
import { fail } from "../utils/helperFunctions.ts";

export const getLoggedUser = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const queryUser = await User.findById(req?.user?.id).populate("classId");

    const userObj = queryUser?.toObject();

    const { classId, ...userData } = userObj as unknown as any;

    const user = {
      ...userData,
      class: classId ?? null,
    };

    res.status(200).json({
      success: true,
      message: "User fetched successfully!",
      user: user,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to get user",
    });
  }
};

export const updateUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await User.findById(req?.user?.id).select("+password");

    const { firstName, lastName, oldPassword, newPassword } = req.body;

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Student not found!",
      });
    }

    if (oldPassword.trim() && newPassword.trim()) {
      const isOldPasswordValid = await user.comparePassword(oldPassword);

      if (!isOldPasswordValid) {
        return res.status(400).json({
          success: false,
          message: "Old password provided is incorrect!",
        });
      }
    }

    if (firstName.trim()) {
      user.firstName = firstName;
    }

    if (lastName.trim()) {
      user.lastName = lastName;
    }

    if (newPassword.trim()) {
      user.password = newPassword;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "User updated successfully!",
      user: user,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update user",
    });
  }
};

export const updateStudent = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const user = await User.findById(req?.params?.id);

    const { firstName, lastName, classId } = req.body;

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Student not found!",
      });
    }

    if (firstName.trim()) {
      user.firstName = firstName;
    }

    if (lastName.trim()) {
      user.lastName = lastName;
    }

    if (classId.trim()) {
      user.classId = classId;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Student updated successfully!",
      user: user,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update student",
    });
  }
};

export const uploladProfilePicture = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.user?.id;

    const { image } = req.body;

    if (!id) {
      fail("Account not found!", 404);
    }

    const user = await User.findOneAndUpdate(
      {
        _id: id,
      },
      {
        profilePic: image,
      },
      { returnDocument: "after" },
    );

    res.status(200).json({
      success: true,
      message: "Profile picture uploaded successfully!",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};
