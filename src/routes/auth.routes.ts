import express from "express";
import {
  register,
  login,
  logout,
  verifyEmail,
  getMe,
  createPassword,
  resendPasswordCreation,
} from "../controllers/authController.ts";
import { protect } from "../middleware/auth.ts";
import { loginRateLimiter } from "../middleware/loginRateLimiter.ts";

const router = express.Router();

router.post("/register", register);
router.post("/login", loginRateLimiter, login);
router.post("/logout", logout);
router.post("/create-password", createPassword);
router.get("/verify-email/:token", verifyEmail);
router.get("/resend-invitation/:id", protect, resendPasswordCreation);
router.get("/me", protect, getMe);

export default router;
