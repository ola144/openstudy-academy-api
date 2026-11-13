import express from "express";
import { protect } from "../middleware/auth.ts";
import {
  getLoggedUser,
  updateStudent,
  updateUser,
  uploladProfilePicture,
} from "../controllers/userController.ts";
import { authorize } from "../middleware/role.ts";
import { UserRole } from "../models/User.ts";

const router = express.Router();

router.use(protect);

router.get("/", getLoggedUser);
router.patch("/update-user", updateUser);
router.patch("/upload-profile-pic", uploladProfilePicture);

export default router;
