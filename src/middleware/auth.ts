import jwt from "jsonwebtoken";
import User from "../models/User.ts";

export const protect = async (req: any, res: any, next: any) => {
  try {
    const token = req.cookies.accessToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required!",
      });
    }

    const jwtSecret = process.env.JWT_SECRET || "dev-secret";
    const decoded: any = jwt.verify(token, jwtSecret);
    const account = await User.findById(decoded?.id);

    if (!account) {
      return res.status(401).json({
        success: false,
        message: "Account no longer exists",
      });
    }

    req.user = account;
    req.role = decoded.role;

    next();
  } catch (error: any) {
    res.status(401).json({
      success: false,
      message: error.message || "Invalid or expired authentication token",
    });
  }
};
