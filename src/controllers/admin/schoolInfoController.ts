import SchoolInfo from "../../models/SchoolInfo.ts";
import type { Request, Response, NextFunction } from "express";
import { fail } from "../../utils/helperFunctions.ts";

export const createSchoolInfo = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { name, term, address, email, phoneNumber } = req.body;

    const info = await SchoolInfo.create({
      name: name,
      term: term,
      email: email,
      phoneNumber: phoneNumber,
      address: address,
    });

    res.status(201).json({
      success: true,
      message: "School info created successfully!",
      data: info,
    });
  } catch (error) {
    next(error);
  }
};

export const updateSchoolInfo = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    const info = await SchoolInfo.findByIdAndUpdate(id, req.body, {
      returnDocument: "after",
      runValidators: true,
    });

    if (!info) {
      res.status(404).json({
        success: false,
        message: "School info not found.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "School info updated successfully!",
      data: info,
    });
  } catch (error) {
    next(error);
  }
};

export const getSchoolInfo = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const info = await SchoolInfo.findOne().sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      data: info,
    });
  } catch (error) {
    next(error);
  }
};

export const uploadSchoolLogo = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const { logo } = req.body;

    const info = await SchoolInfo.findOneAndUpdate(
      {
        _id: id,
      },
      {
        logo: logo,
      },
    );

    if (!info) {
      fail("Info not found!", 404);
    }

    res.status(200).json({
      success: true,
      message: "School logo uploaded successfully!",
      data: info,
    });
  } catch (error) {
    next(error);
  }
};
